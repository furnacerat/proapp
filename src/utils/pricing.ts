import type { Material } from '../data/types';
import { lookupPricing } from '../services/pricingLookupService';

export type PricingProvider = 'serpapi' | 'rainforest' | 'apify';

export interface PricingPreferences {
  provider: PricingProvider;
  preferredSupplier: string;
  preferredStoreLocation: string;
  autoRefreshWeekly: boolean;
}

export interface PricingResult {
  price: number;
  supplier: string;
  sku?: string;
  modelNumber?: string;
  productUrl?: string;
  source: PricingProvider | 'cache' | 'estimated';
  verified: boolean;
  estimateOnly: boolean;
  fetchedAt: string;
}

const CACHE_KEY = 'buildops_pricing_cache_v1';
const PREF_KEY = 'buildops_pricing_preferences_v1';
const CACHE_TTL_DAYS = 7;

const defaultPreferences: PricingPreferences = {
  provider: 'serpapi',
  preferredSupplier: '',
  preferredStoreLocation: '',
  autoRefreshWeekly: false,
};

const readCache = (): Record<string, PricingResult> => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeCache = (cache: Record<string, PricingResult>) => {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
};

export const getPricingPreferences = (): PricingPreferences => {
  try {
    return { ...defaultPreferences, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') };
  } catch {
    return defaultPreferences;
  }
};

export const savePricingPreferences = (preferences: PricingPreferences) => {
  localStorage.setItem(PREF_KEY, JSON.stringify(preferences));
};

export const getPriceAgeDays = (date?: string) => {
  if (!date) return 999;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
};

export const isPriceOutdated = (material: Pick<Material, 'lastUpdated'>, days = 30) => getPriceAgeDays(material.lastUpdated) > days;

const cacheKeyFor = (material: Material, prefs: PricingPreferences) => [
  material.name,
  material.sku || material.modelNumber || '',
  prefs.preferredSupplier || material.supplier || '',
  prefs.preferredStoreLocation || '',
].join('|').toLowerCase();

const estimatePrice = (material: Material, prefs: PricingPreferences): PricingResult => {
  const base = material.basePrice ?? material.unitPrice ?? 0;
  const seed = [...material.name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const movement = ((seed % 17) - 6) / 100;
  const locationNudge = prefs.preferredStoreLocation ? 0.015 : 0;
  const price = Math.max(0.01, Number((base * (1 + movement + locationNudge)).toFixed(2)));
  return {
    price,
    supplier: prefs.preferredSupplier || material.supplier || 'Estimated market source',
    sku: material.sku,
    modelNumber: material.modelNumber,
    productUrl: material.productUrl,
    source: 'estimated',
    verified: false,
    estimateOnly: true,
    fetchedAt: new Date().toISOString(),
  };
};

export async function fetchLatestMaterialPrice(material: Material, prefs = getPricingPreferences(), force = false): Promise<PricingResult> {
  const cache = readCache();
  const key = cacheKeyFor(material, prefs);
  const cached = cache[key];
  if (!force && cached && getPriceAgeDays(cached.fetchedAt) <= CACHE_TTL_DAYS) {
    return { ...cached, source: 'cache' };
  }

  if (prefs.provider === 'serpapi') {
    const results = await lookupPricing({
      query: material.sku || material.modelNumber || material.name,
      supplier: prefs.preferredSupplier || material.supplier,
      location: prefs.preferredStoreLocation,
    });
    const match = results[0];
    if (match) {
      const result: PricingResult = {
        price: Number(match.price ?? material.unitPrice ?? 0),
        supplier: match.source || prefs.preferredSupplier || material.supplier || 'External source',
        sku: material.sku,
        modelNumber: material.modelNumber,
        productUrl: match.link || material.productUrl,
        source: 'serpapi',
        verified: true,
        estimateOnly: false,
        fetchedAt: new Date().toISOString(),
      };
      cache[key] = result;
      writeCache(cache);
      return result;
    }
  }

  const result = estimatePrice(material, prefs);
  cache[key] = result;
  writeCache(cache);
  return result;
}

export const applyPricingResult = (material: Material, result: PricingResult): Partial<Material> => ({
  basePrice: material.basePrice ?? material.unitPrice,
  currentPrice: result.price,
  unitPrice: result.price,
  supplier: result.supplier,
  sku: result.sku || material.sku,
  modelNumber: result.modelNumber || material.modelNumber,
  productUrl: result.productUrl || material.productUrl,
  lastUpdated: result.fetchedAt,
  pricingSource: result.source,
  pricingVerified: result.verified,
  priceEstimateOnly: result.estimateOnly,
});
