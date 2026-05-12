const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function readRawBody(req) {
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
  formData.append('file', new Blob([audioBuffer], { type: contentType }), 'job-walk.webm');

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
