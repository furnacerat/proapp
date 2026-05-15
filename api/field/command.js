const { getClientIp, rateLimit, requireAuthenticatedUser, sendJson } = require('../_security');

const MAX_BODY_LENGTH = 30_000;

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

const fieldCommandSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'intent',
    'jobId',
    'taskId',
    'title',
    'content',
    'hours',
    'startTime',
    'endTime',
    'materials',
    'punchItem',
    'missingFields',
    'confidence',
    'message',
  ],
  properties: {
    intent: {
      type: 'string',
      enum: ['log_time', 'add_daily_log', 'add_note', 'request_materials', 'add_punch_item', 'complete_task', 'unknown'],
    },
    jobId: { type: 'string' },
    taskId: { type: 'string' },
    title: { type: 'string' },
    content: { type: 'string' },
    hours: { type: 'number' },
    startTime: { type: 'string' },
    endTime: { type: 'string' },
    materials: {
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
            enum: ['material', 'tool', 'supply', 'hardware', 'rental', 'other'],
          },
          urgent: { type: 'boolean' },
          notes: { type: 'string' },
        },
      },
    },
    punchItem: { type: 'string' },
    missingFields: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['job', 'worker', 'content', 'hours', 'materials', 'punchItem', 'task'],
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
    return sendJson(res, 500, { error: 'Field Voice Assistant is not configured' });
  }

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });

  const limit = rateLimit(auth.userId || getClientIp(req), { name: 'field-command', windowMs: 60_000, max: 24 });
  if (!limit.ok) {
    return sendJson(res, 429, { error: 'Too many field voice requests. Try again shortly.' }, { 'Retry-After': String(limit.retryAfter) });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Invalid request body' });
  }

  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
  const activeJobId = typeof body.activeJobId === 'string' ? body.activeJobId : '';
  const jobs = Array.isArray(body.jobs) ? body.jobs.slice(0, 80) : [];
  const tasks = Array.isArray(body.tasks) ? body.tasks.slice(0, 120) : [];

  if (!transcript) return sendJson(res, 400, { error: 'transcript is required' });

  const input = [
    {
      role: 'system',
      content: [
        'You parse short voice commands for a construction Field Mode screen.',
        'Supported intents: log_time, add_daily_log, add_note, request_materials, add_punch_item, complete_task.',
        'Choose jobId only from the provided jobs list. Prefer activeJobId when the speaker says this job, current job, here, or does not name a job.',
        'Choose taskId only from the provided tasks list for complete_task. If unsure, leave taskId empty and include missingFields task.',
        'For log_time, extract hours, startTime, and endTime when spoken. Use 0 or empty strings for unknown values.',
        'For add_daily_log and add_note, put the spoken jobsite details in content.',
        'For request_materials, extract concrete material/tool/supply items. Default quantity to 1 and unit to ea.',
        'For add_punch_item, put the punch item description in punchItem.',
        'Set confidence from 0 to 1 and include missingFields when the action cannot run safely.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({
        transcript,
        activeJobId,
        jobs: jobs.map(job => ({
          id: String(job.id || ''),
          name: String(job.name || ''),
          customer: String(job.customer || ''),
          address: String(job.address || ''),
          status: String(job.status || ''),
        })),
        tasks: tasks.map(task => ({
          id: String(task.id || ''),
          title: String(task.title || ''),
          description: String(task.description || ''),
          jobId: String(task.jobId || ''),
          priority: String(task.priority || ''),
          dueDate: String(task.dueDate || ''),
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
        model: process.env.OPENAI_FIELD_COMMAND_MODEL || 'gpt-4o-mini',
        input,
        text: {
          format: {
            type: 'json_schema',
            name: 'field_voice_command',
            strict: true,
            schema: fieldCommandSchema,
          },
        },
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return sendJson(res, response.status === 401 ? 500 : 502, {
        error: data.error?.message || 'Field command parsing failed',
      });
    }

    const outputText = extractOutputText(data);
    if (!outputText) return sendJson(res, 502, { error: 'Field command parsing returned no output' });

    return sendJson(res, 200, JSON.parse(outputText));
  } catch (error) {
    return sendJson(res, 502, { error: error instanceof Error ? error.message : 'Field command parsing failed' });
  }
};
