const { getClientIp, rateLimit, requireAuthenticatedUser, sendJson } = require('../_security');

const MAX_BODY_LENGTH = 40_000;

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

function clampText(value, maxLength) {
  return String(value || '').slice(0, maxLength);
}

function compactItems(items, maxItems) {
  return (Array.isArray(items) ? items : []).slice(0, maxItems).map(item => ({
    name: clampText(item.name, 120),
    description: clampText(item.description, 220),
    quantity: Number(item.quantity || 0),
    unit: clampText(item.unit || 'ea', 24),
    unitCost: Number(item.unitCost ?? item.unitPrice ?? 0),
    category: clampText(item.category || 'material', 40),
    isLabor: Boolean(item.isLabor || item.category === 'labor'),
  }));
}

const copilotSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'confidence', 'sections', 'warnings', 'questions'],
  properties: {
    summary: { type: 'string' },
    confidence: { type: 'number' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'description', 'items'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'description', 'quantity', 'unit', 'unitCost', 'category', 'clientVisible', 'notes'],
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' },
                unitCost: { type: 'number' },
                category: {
                  type: 'string',
                  enum: ['labor', 'material', 'equipment', 'subcontractor', 'other', 'allowance'],
                },
                clientVisible: { type: 'boolean' },
                notes: { type: 'string' },
              },
            },
          },
        },
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
    questions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 500, { error: 'Estimate Copilot is not configured' });
  }

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });

  const limit = rateLimit(auth.userId || getClientIp(req), { name: 'estimate-copilot', windowMs: 60_000, max: 12 });
  if (!limit.ok) {
    return sendJson(res, 429, { error: 'Too many Estimate Copilot requests. Try again shortly.' }, { 'Retry-After': String(limit.retryAfter) });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Invalid request body' });
  }

  const prompt = clampText(body.prompt, 3000).trim();
  const estimate = body.estimate && typeof body.estimate === 'object' ? body.estimate : {};
  if (!prompt && !clampText(estimate.notes, 2000) && !clampText(body.voiceTranscript, 3000)) {
    return sendJson(res, 400, { error: 'Add scope notes or a Copilot request first' });
  }

  const input = [
    {
      role: 'system',
      content: [
        'You are Estimate Copilot for a residential construction estimating app.',
        'Create practical draft estimate sections from job notes, current estimate context, and a limited price book.',
        'Prefer using provided price book names and costs when they clearly match.',
        'If a quantity is unknown, choose a conservative placeholder quantity of 1 and add a question.',
        'Separate labor and materials when useful. Include obvious missing scope as warnings or questions.',
        'Do not invent permit requirements as facts; phrase them as confirmation questions.',
        'Return only JSON that matches the schema.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({
        request: prompt,
        estimate: {
          name: clampText(estimate.name, 160),
          projectType: clampText(estimate.projectType, 60),
          address: clampText(estimate.address, 240),
          markupPercent: Number(estimate.markupPercent || 0),
          notes: clampText(estimate.notes, 2500),
          currentItems: compactItems(estimate.currentItems, 80),
        },
        jobWalkNotes: clampText(body.voiceTranscript, 3500),
        priceBook: {
          materials: compactItems(body.materials, 80),
          laborRates: compactItems(body.laborRates, 60),
        },
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
        model: process.env.OPENAI_ESTIMATE_COPILOT_MODEL || 'gpt-4o-mini',
        input,
        text: {
          format: {
            type: 'json_schema',
            name: 'estimate_copilot_draft',
            strict: true,
            schema: copilotSchema,
          },
        },
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return sendJson(res, response.status === 401 ? 500 : 502, {
        error: data.error?.message || 'Estimate Copilot failed',
      });
    }

    const outputText = extractOutputText(data);
    if (!outputText) return sendJson(res, 502, { error: 'Estimate Copilot returned no output' });

    return sendJson(res, 200, JSON.parse(outputText));
  } catch (error) {
    return sendJson(res, 502, { error: error instanceof Error ? error.message : 'Estimate Copilot failed' });
  }
};
