const MAX_BODY_LENGTH = 30_000;
const { getClientIp, rateLimit, requireAuthenticatedUser, sendJson } = require('../_security');

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);

  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_BODY_LENGTH) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  const parts = Array.isArray(data.output) ? data.output.flatMap(item => item.content || []) : [];
  return parts.map(part => part.text || '').join('').trim();
}

const commandSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'jobId', 'jobName', 'title', 'items', 'missingFields', 'confidence', 'message'],
  properties: {
    intent: {
      type: 'string',
      enum: ['create_shopping_list', 'unknown'],
    },
    jobId: { type: 'string' },
    jobName: { type: 'string' },
    title: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unit', 'category', 'urgent', 'notes'],
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          category: {
            type: 'string',
            enum: ['material', 'hardware', 'supply', 'tool', 'rental', 'other'],
          },
          urgent: { type: 'boolean' },
          notes: { type: 'string' },
        },
      },
    },
    missingFields: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['job', 'items'],
      },
    },
    confidence: { type: 'number' },
    message: { type: 'string' },
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 500, { error: 'OpenAI command parsing is not configured' });
  }

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });

  const limit = rateLimit(auth.userId || getClientIp(req), { name: 'voice-command', windowMs: 60_000, max: 30 });
  if (!limit.ok) {
    return sendJson(res, 429, { error: 'Too many voice command requests. Try again shortly.' }, { 'Retry-After': String(limit.retryAfter) });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Invalid request body' });
  }

  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
  const jobs = Array.isArray(body.jobs) ? body.jobs.slice(0, 100) : [];

  if (!transcript) return sendJson(res, 400, { error: 'transcript is required' });

  const input = [
    {
      role: 'system',
      content: [
        'You parse voice commands for a residential construction operations app.',
        'Only create shopping-list commands are supported right now.',
        'Choose jobId only from the provided jobs list. If unsure, leave jobId empty and include missingFields job.',
        'Extract concrete shopping items. Remove filler words and command phrasing.',
        'For unspecified quantities use 1 and unit ea.',
        'Set confidence from 0 to 1.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({
        transcript,
        supportedIntents: ['create_shopping_list'],
        categories: ['material', 'hardware', 'supply', 'tool', 'rental', 'other'],
        jobs: jobs.map(job => ({
          id: String(job.id || ''),
          name: String(job.name || ''),
          customer: String(job.customer || ''),
          address: String(job.address || ''),
          status: String(job.status || ''),
        })),
      }),
    },
  ];

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_COMMAND_MODEL || 'gpt-4o-mini',
        input,
        text: {
          format: {
            type: 'json_schema',
            name: 'builder_voice_command',
            strict: true,
            schema: commandSchema,
          },
        },
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return sendJson(res, response.status === 401 ? 500 : 502, {
        error: data.error?.message || 'OpenAI command parsing failed',
      });
    }

    const outputText = extractOutputText(data);
    if (!outputText) return sendJson(res, 502, { error: 'OpenAI command parsing returned no output' });

    return sendJson(res, 200, JSON.parse(outputText));
  } catch (error) {
    return sendJson(res, 502, { error: error instanceof Error ? error.message : 'OpenAI command parsing failed' });
  }
};
