export interface PricingLookupRequest {
  query: string;
  supplier?: string;
  location?: string;
}

export interface PricingLookupResult {
  title: string;
  price: number;
  displayPrice: string;
  source: string;
  link: string;
  thumbnail: string;
  rating: number | null;
  reviews: number | null;
}

export async function lookupPricing({ query, supplier, location }: PricingLookupRequest): Promise<PricingLookupResult[]> {
  const response = await fetch('/api/pricing/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, supplier, location }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || 'Pricing lookup failed');
  }

  return Array.isArray(data) ? data : [];
}
