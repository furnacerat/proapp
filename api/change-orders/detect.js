const { getClientIp, rateLimit, requireAuthenticatedUser, sendJson } = require('../_security');

const MAX_BODY_LENGTH = 45_000;

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

function limitArray(value, limit) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

const detectionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'riskLevel', 'candidates', 'questions', 'warnings'],
  properties: {
    summary: { type: 'string' },
    riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'amount', 'confidence', 'priority', 'evidence', 'recommendedAction', 'clientMessage'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          amount: { type: 'number' },
          confidence: { type: 'number' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          evidence: {
            type: 'array',
            items: { type: 'string' },
          },
          recommendedAction: { type: 'string' },
          clientMessage: { type: 'string' },
        },
      },
    },
    questions: {
      type: 'array',
      items: { type: 'string' },
    },
    warnings: {
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
    return sendJson(res, 500, { error: 'Change Order Detector is not configured' });
  }

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });

  const limit = rateLimit(auth.userId || getClientIp(req), { name: 'change-order-detector', windowMs: 60_000, max: 12 });
  if (!limit.ok) {
    return sendJson(res, 429, { error: 'Too many detector requests. Try again shortly.' }, { 'Retry-After': String(limit.retryAfter) });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Invalid request body' });
  }

  if (!body.job || typeof body.job !== 'object' || !body.job.name) {
    return sendJson(res, 400, { error: 'job is required' });
  }

  const payload = {
    customPrompt: clampText(body.customPrompt, 2000),
    job: body.job,
    estimate: body.estimate || null,
    metrics: body.metrics || {},
    existingChangeOrders: limitArray(body.existingChangeOrders, 30),
    dailyLogs: limitArray(body.dailyLogs, 40),
    issues: limitArray(body.issues, 30),
    punchList: limitArray(body.punchList, 30),
    notes: limitArray(body.notes, 30),
    tasks: limitArray(body.tasks, 40),
    expenses: limitArray(body.expenses, 60),
    allowances: limitArray(body.allowances, 20),
    materialOrders: limitArray(body.materialOrders, 20),
    shoppingLists: limitArray(body.shoppingLists, 20),
  };

  const input = [
    {
      role: 'system',
      content: [
        'You are a change order risk detector for a residential construction operations app.',
        'Find work that appears outside the approved scope or contract: hidden conditions, customer-requested additions, material upgrades, allowance overruns, rework caused by owner changes, extra labor, and procurement changes.',
        'Do not duplicate existing change orders. Do not flag normal in-scope production work. Each candidate must have concrete evidence from the supplied data.',
        'If cost cannot be estimated from the data, use amount 0 and explain what should be confirmed. Keep descriptions ready for a contractor to review before sending to a customer.',
        'Return JSON only.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify(payload),
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
        model: process.env.OPENAI_CHANGE_ORDER_DETECTOR_MODEL || 'gpt-4o-mini',
        input,
        text: {
          format: {
            type: 'json_schema',
            name: 'change_order_detection',
            strict: true,
            schema: detectionSchema,
          },
        },
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return sendJson(res, response.status === 401 ? 500 : 502, {
        error: data.error?.message || 'Change order detection failed',
      });
    }

    const outputText = extractOutputText(data);
    if (!outputText) return sendJson(res, 502, { error: 'Change order detection returned no output' });

    return sendJson(res, 200, JSON.parse(outputText));
  } catch (error) {
    return sendJson(res, 502, { error: error instanceof Error ? error.message : 'Change order detection failed' });
  }
};
