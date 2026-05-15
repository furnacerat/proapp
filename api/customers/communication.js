const { getClientIp, rateLimit, requireAuthenticatedUser, sendJson } = require('../_security');

const MAX_BODY_LENGTH = 35_000;

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

const communicationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['subject', 'body', 'sms', 'tone', 'callToAction', 'warnings'],
  properties: {
    subject: { type: 'string' },
    body: { type: 'string' },
    sms: { type: 'string' },
    tone: { type: 'string' },
    callToAction: { type: 'string' },
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
    return sendJson(res, 500, { error: 'Customer Communication Generator is not configured' });
  }

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });

  const limit = rateLimit(auth.userId || getClientIp(req), { name: 'customer-communication', windowMs: 60_000, max: 18 });
  if (!limit.ok) {
    return sendJson(res, 429, { error: 'Too many communication requests. Try again shortly.' }, { 'Retry-After': String(limit.retryAfter) });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Invalid request body' });
  }

  const purpose = clampText(body.purpose, 80) || 'general_update';
  const channel = ['email', 'sms'].includes(body.channel) ? body.channel : 'email';
  const customPrompt = clampText(body.customPrompt, 2000);
  const customer = body.customer && typeof body.customer === 'object' ? body.customer : {};
  if (!customer.name) return sendJson(res, 400, { error: 'customer is required' });

  const input = [
    {
      role: 'system',
      content: [
        'You write customer communications for a residential construction company.',
        'Be clear, warm, professional, and specific. Avoid overpromising dates, costs, or completion unless provided in context.',
        'For invoice reminders, be courteous and direct. For delays or issues, own the update without blame.',
        'Use plain language a homeowner can understand.',
        'Return both an email body and a concise SMS version.',
        'Do not include placeholders like [date] unless the field is truly unknown; add those unknowns to warnings instead.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({
        purpose,
        channel,
        customPrompt,
        company: {
          name: clampText(body.company?.name, 120),
          phone: clampText(body.company?.phone, 80),
          email: clampText(body.company?.email, 120),
        },
        customer: {
          name: clampText(customer.name, 120),
          company: clampText(customer.company, 120),
          email: clampText(customer.email, 120),
          phone: clampText(customer.phone, 80),
          address: clampText(customer.address, 240),
          notes: clampText(customer.notes, 2000),
        },
        context: {
          status: clampText(body.context?.status, 80),
          balanceDue: Number(body.context?.balanceDue || 0),
          lifetimeValue: Number(body.context?.lifetimeValue || 0),
          portalLink: clampText(body.context?.portalLink, 500),
          jobs: Array.isArray(body.context?.jobs) ? body.context.jobs.slice(0, 8) : [],
          estimates: Array.isArray(body.context?.estimates) ? body.context.estimates.slice(0, 8) : [],
          invoices: Array.isArray(body.context?.invoices) ? body.context.invoices.slice(0, 8) : [],
          recentNotes: Array.isArray(body.context?.recentNotes) ? body.context.recentNotes.slice(0, 8) : [],
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
        model: process.env.OPENAI_CUSTOMER_COMMUNICATION_MODEL || 'gpt-4o-mini',
        input,
        text: {
          format: {
            type: 'json_schema',
            name: 'customer_communication_draft',
            strict: true,
            schema: communicationSchema,
          },
        },
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return sendJson(res, response.status === 401 ? 500 : 502, {
        error: data.error?.message || 'Communication generation failed',
      });
    }

    const outputText = extractOutputText(data);
    if (!outputText) return sendJson(res, 502, { error: 'Communication generation returned no output' });

    return sendJson(res, 200, JSON.parse(outputText));
  } catch (error) {
    return sendJson(res, 502, { error: error instanceof Error ? error.message : 'Communication generation failed' });
  }
};
