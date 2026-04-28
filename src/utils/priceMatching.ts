import type { Material } from '../data/types';
import { lookupPricing, type PricingLookupResult } from '../services/pricingLookupService';
import type { PricingPreferences } from './pricing';

export interface ScoredPricingMatch extends PricingLookupResult {
  confidence: number;
}

export interface PricingMatchSet {
  bestMatch: ScoredPricingMatch | null;
  alternativeMatches: ScoredPricingMatch[];
}

const normalize = (value = '') => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const tokens = (value = '') => normalize(value).split(' ').filter(token => token.length > 1);

const includesAny = (haystack: string, needles: string[]) => needles.some(needle => needle && haystack.includes(normalize(needle)));

export function scorePricingResult(material: Material, result: PricingLookupResult): number {
  const materialTokens = tokens(`${material.name} ${material.category || ''}`);
  const title = normalize(result.title);
  const source = normalize(result.source);
  const supplier = normalize(material.preferredSupplier || material.supplier || '');
  const sku = normalize(material.sku || '');
  const model = normalize(material.modelNumber || '');
  const unit = normalize(material.unit || '');

  const tokenHits = materialTokens.filter(token => title.includes(token)).length;
  const nameScore = materialTokens.length ? (tokenHits / materialTokens.length) * 45 : 0;
  const supplierScore = supplier && source.includes(supplier) ? 20 : 0;
  const skuScore = sku && title.includes(sku) ? 20 : 0;
  const modelScore = model && title.includes(model) ? 20 : 0;
  const unitScore = unit && includesAny(title, [unit, unit === 'ea' ? 'each' : '', unit === 'sf' ? 'sq ft' : '', unit === 'lf' ? 'linear ft' : '']) ? 8 : 0;
  const hasPriceScore = result.price > 0 ? 7 : 0;

  const confidence = Math.min(100, Math.round(nameScore + supplierScore + Math.max(skuScore, modelScore) + unitScore + hasPriceScore));
  return tokenHits === 0 && !skuScore && !modelScore ? Math.min(confidence, 24) : confidence;
}

export async function findPricingMatches(material: Material, prefs: PricingPreferences): Promise<PricingMatchSet> {
  const query = material.sku || material.modelNumber || material.matchedProductTitle || material.name;
  const results = await lookupPricing({
    query,
    supplier: material.preferredSupplier || prefs.preferredSupplier || material.supplier,
    location: prefs.preferredStoreLocation || material.preferredStoreLocation,
  });

  const scored = results
    .map(result => ({ ...result, confidence: scorePricingResult(material, result) }))
    .filter(result => result.confidence >= 25)
    .sort((a, b) => b.confidence - a.confidence);

  return {
    bestMatch: scored[0] || null,
    alternativeMatches: scored.slice(1, 6),
  };
}

export const suggestionUpdates = (match: ScoredPricingMatch): Partial<Material> => ({
  matchedProductTitle: match.title,
  currentPrice: match.price,
  supplier: match.source,
  productUrl: match.link,
  priceSource: 'serpapi',
  pricingSource: 'serpapi',
  matchConfidence: match.confidence,
  matchStatus: 'suggested',
  pricingVerified: false,
  priceEstimateOnly: false,
});

export const confirmedUpdates = (match: ScoredPricingMatch): Partial<Material> => ({
  ...suggestionUpdates(match),
  unitPrice: match.price,
  lastUpdated: new Date().toISOString(),
  matchStatus: 'confirmed',
  pricingVerified: true,
});

export const rejectedUpdates = (): Partial<Material> => ({
  matchStatus: 'rejected',
  matchConfidence: undefined,
});
