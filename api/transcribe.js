const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI transcription is not configured' });
  }

  const contentType = req.headers['content-type'] || 'audio/webm';
  if (!String(contentType).startsWith('audio/')) {
    return res.status(400).json({ error: 'Expected an audio upload' });
  }

  let audioBuffer;
  try {
    audioBuffer = await readRawBody(req);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Could not read audio upload' });
  }

  if (!audioBuffer.length) {
    return res.status(400).json({ error: 'Audio upload is empty' });
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
      return res.status(response.status === 401 ? 500 : 502).json({
        error: data.error?.message || 'OpenAI transcription failed',
      });
    }

    return res.status(200).json({ text: data.text || '' });
  } catch {
    return res.status(502).json({ error: 'OpenAI transcription failed' });
  }
};
