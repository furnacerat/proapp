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
  required: [
    'intent',
    'jobId',
    'jobName',
    'customerId',
    'customerName',
    'estimateId',
    'title',
    'content',
    'dueDate',
    'priority',
    'shoppingListMode',
    'items',
    'estimateItem',
    'missingFields',
    'confidence',
    'message',
  ],
  properties: {
    intent: {
      type: 'string',
      enum: [
        'create_shopping_list',
        'create_task',
        'add_daily_log',
        'add_note',
        'add_photo_note',
        'add_estimate_item',
        'open_job',
        'open_customer',
        'schedule_follow_up',
        'unknown',
      ],
    },
    jobId: { type: 'string' },
    jobName: { type: 'string' },
    customerId: { type: 'string' },
    customerName: { type: 'string' },
    estimateId: { type: 'string' },
    title: { type: 'string' },
    content: { type: 'string' },
    dueDate: { type: 'string' },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'urgent'],
    },
    shoppingListMode: {
      type: 'string',
      enum: ['new', 'append', 'ask'],
    },
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
    estimateItem: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'description', 'quantity', 'unit', 'unitPrice', 'category'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        quantity: { type: 'number' },
        unit: { type: 'string' },
        unitPrice: { type: 'number' },
        category: {
          type: 'string',
          enum: ['labor', 'material', 'equipment', 'subcontractor', 'other', 'allowance'],
        },
      },
    },
    missingFields: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['job', 'customer', 'estimate', 'title', 'content', 'items', 'dueDate'],
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
  const customers = Array.isArray(body.customers) ? body.customers.slice(0, 100) : [];
  const estimates = Array.isArray(body.estimates) ? body.estimates.slice(0, 100) : [];

  if (!transcript) return sendJson(res, 400, { error: 'transcript is required' });

  const input = [
    {
      role: 'system',
      content: [
        'You parse voice commands for a residential construction operations app.',
        'Supported intents: create_shopping_list, create_task, add_daily_log, add_note, add_photo_note, add_estimate_item, open_job, open_customer, schedule_follow_up.',
        'Choose jobId only from the provided jobs list. If unsure, leave jobId empty and include missingFields job.',
        'Choose customerId only from the provided customers list. If unsure for open_customer, leave customerId empty and include missingFields customer.',
        'Choose estimateId only from the provided estimates list. If an estimate item targets a job with one linked estimate, use that estimateId.',
        'Extract concrete shopping items. Remove filler words and command phrasing.',
        'For unspecified quantities use 1 and unit ea.',
        'For shoppingListMode: use append only when the speaker clearly says append/add to an existing/current/open list, new only when they clearly ask for a new list, otherwise ask.',
        'For create_task and schedule_follow_up, put the task title in title and details in content. Use ISO yyyy-mm-dd for dueDate when stated, otherwise empty.',
        'For add_daily_log, add_note, and add_photo_note, put the spoken note/log details in content.',
        'For add_estimate_item, fill estimateItem. Use unitPrice 0 when no price is spoken.',
        'Set confidence from 0 to 1.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({
        transcript,
        supportedIntents: [
          'create_shopping_list',
          'create_task',
          'add_daily_log',
          'add_note',
          'add_photo_note',
          'add_estimate_item',
          'open_job',
          'open_customer',
          'schedule_follow_up',
        ],
        categories: ['material', 'hardware', 'supply', 'tool', 'rental', 'other'],
        jobs: jobs.map(job => ({
          id: String(job.id || ''),
          name: String(job.name || ''),
          customer: String(job.customer || ''),
          address: String(job.address || ''),
          status: String(job.status || ''),
          estimateId: String(job.estimateId || ''),
          customerId: String(job.customerId || ''),
        })),
        customers: customers.map(customer => ({
          id: String(customer.id || ''),
          name: String(customer.name || ''),
          company: String(customer.company || ''),
          address: String(customer.address || ''),
        })),
        estimates: estimates.map(estimate => ({
          id: String(estimate.id || ''),
          estimateNumber: String(estimate.estimateNumber || ''),
          name: String(estimate.name || ''),
          customerId: String(estimate.customerId || ''),
          status: String(estimate.status || ''),
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
