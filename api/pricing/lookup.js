const MAX_QUERY_LENGTH = 120;

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);

  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10_000) {
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

function parsePrice(rawPrice) {
  if (typeof rawPrice === 'number') return rawPrice;
  if (!rawPrice || typeof rawPrice !== 'string') return null;
  const match = rawPrice.replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : null;
}

function normalizeResult(item) {
  const price = parsePrice(item.extracted_price ?? item.price);
  return {
    title: item.title || '',
    price,
    displayPrice: item.price || (price !== null ? `$${price.toFixed(2)}` : ''),
    source: item.source || item.seller || item.merchant || '',
    link: item.link || item.product_link || '',
    thumbnail: item.thumbnail || item.serpapi_thumbnail || '',
    rating: item.rating ?? null,
    reviews: item.reviews ?? null,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.SERPAPI_KEY) {
    return res.status(500).json({ error: 'Pricing lookup is not configured' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const supplier = typeof body.supplier === 'string' ? body.supplier.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim() : '';

  if (!query) return res.status(400).json({ error: 'query is required' });
  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: `query must be ${MAX_QUERY_LENGTH} characters or less` });
  }

  const searchQuery = supplier ? `${query} ${supplier}` : query;
  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: searchQuery,
    api_key: process.env.SERPAPI_KEY,
  });
  if (location) params.set('location', location);

  try {
    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
      return res.status(502).json({ error: 'SerpApi request failed' });
    }

    const results = Array.isArray(data.shopping_results)
      ? data.shopping_results.map(normalizeResult).filter(item => item.title && item.price !== null)
      : [];

    return res.status(200).json(results);
  } catch {
    return res.status(502).json({ error: 'SerpApi request failed' });
  }
};

