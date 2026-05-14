const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const { getClientIp, rateLimit, requireAuthenticatedUser, sendJson } = require('./_security');

function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body));
  if (req.body instanceof ArrayBuffer) return Promise.resolve(Buffer.from(req.body));
  if (req.body && typeof req.body === 'object' && req.body.type === 'Buffer' && Array.isArray(req.body.data)) {
    return Promise.resolve(Buffer.from(req.body.data));
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_AUDIO_BYTES) {
        reject(new Error('Audio file is too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function audioFileName(contentType) {
  const type = String(contentType).split(';')[0].toLowerCase();
  if (type.includes('mp4')) return 'builder-command.mp4';
  if (type.includes('mpeg') || type.includes('mp3')) return 'builder-command.mp3';
  if (type.includes('wav')) return 'builder-command.wav';
  if (type.includes('ogg')) return 'builder-command.ogg';
  return 'builder-command.webm';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 500, { error: 'OpenAI transcription is not configured' });
  }

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });

  const limit = rateLimit(auth.userId || getClientIp(req), { name: 'transcribe', windowMs: 60_000, max: 12 });
  if (!limit.ok) {
    return sendJson(res, 429, { error: 'Too many voice requests. Try again shortly.' }, { 'Retry-After': String(limit.retryAfter) });
  }

  const contentType = req.headers['content-type'] || 'audio/webm';
  if (!String(contentType).startsWith('audio/')) {
    return sendJson(res, 400, { error: 'Expected an audio upload' });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > MAX_AUDIO_BYTES) {
    return sendJson(res, 413, { error: 'Audio file is too large' });
  }

  let audioBuffer;
  try {
    audioBuffer = await readRawBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Could not read audio upload' });
  }

  if (!audioBuffer.length) {
    return sendJson(res, 400, { error: 'Audio upload is empty' });
  }

  const formData = new FormData();
  formData.append('model', process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe');
  formData.append('language', 'en');
  formData.append(
    'prompt',
    'Transcribe a residential construction job walkthrough for an estimate. Keep measurements, room names, material names, and add/remove instructions clear.'
  );
  formData.append('file', new Blob([audioBuffer], { type: contentType }), audioFileName(contentType));

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return sendJson(res, response.status === 401 ? 500 : 502, {
        error: data.error?.message || 'OpenAI transcription failed',
      });
    }

    return sendJson(res, 200, { text: data.text || '' });
  } catch {
    return sendJson(res, 502, { error: 'OpenAI transcription failed' });
  }
};
