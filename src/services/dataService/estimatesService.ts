import type { Estimate, EstimateLineItem, EstimateSection } from '../../data/types';
import { supabase } from '../../lib/supabase';
import {
  createCollectionService,
  getDataServiceUserId,
  getLocalAppData,
  saveLocalAppData,
  toSupabaseRow,
  fromSupabaseRows,
  upsertSupabaseRecords,
  type RecordWithId,
} from './baseService';
import { getStorageMode, type StorageMode } from './config';
import { TABLES } from './tables';

type EstimateItemInput = Partial<EstimateLineItem> & { id?: string };

const base = createCollectionService<Estimate>('estimates', TABLES.estimates);
const now = () => new Date().toISOString();

const flattenEstimateItems = (estimate: Estimate): (EstimateLineItem & { estimateId: string })[] => {
  const fromScopes = (estimate.scopes || []).flatMap(scope =>
    scope.sections.flatMap(section => section.lineItems || []),
  );
  const fromSections = (estimate.sections || []).flatMap(section => section.lineItems || []);
  const byId = new Map<string, EstimateLineItem>();
  [...fromScopes, ...fromSections].forEach(item => byId.set(item.id, item));
  return Array.from(byId.values()).map(item => ({ ...normalizeEstimateItem(item), estimateId: estimate.id }));
};

const normalizeEstimateItem = (item: EstimateItemInput): EstimateLineItem => {
  const quantity = item.quantity ?? 0;
  const unitCost = item.unitCost ?? item.unitPrice ?? 0;
  const markupPercent = item.markupPercent ?? 0;
  const costTotal = item.costTotal ?? quantity * unitCost;
  const priceTotal = item.priceTotal ?? item.total ?? costTotal * (1 + markupPercent / 100);

  return {
    id: item.id || crypto.randomUUID(),
    sourceType: item.sourceType || 'manual',
    sourceId: item.sourceId,
    name: item.name || 'New item',
    description: item.description,
    category: item.category || 'other',
    type: item.type || (item.isLabor ? 'labor' : 'other'),
    quantity,
    unit: item.unit || 'ea',
    unitCost,
    unitPrice: item.unitPrice ?? unitCost,
    markupPercent,
    costTotal,
    priceTotal,
    total: item.total ?? priceTotal,
    clientVisible: item.clientVisible ?? true,
    internalNotes: item.internalNotes,
    isLabor: item.isLabor ?? item.type === 'labor',
  };
};

const normalizeEstimate = (estimate: Estimate): Estimate => {
  const items = flattenEstimateItems(estimate);
  const subtotal = estimate.subtotal ?? items.reduce((sum, item) => sum + (item.costTotal ?? item.total ?? 0), 0);
  const markupAmount = estimate.markupAmount ?? subtotal * ((estimate.markupPercent || 0) / 100);
  const total = estimate.total ?? subtotal + markupAmount;
  const marginAmount = estimate.marginAmount ?? Math.max(total - subtotal, 0);
  return {
    ...estimate,
    status: estimate.status || 'draft',
    type: estimate.type || 'other',
    subtotal,
    markupAmount,
    total,
    marginAmount,
    marginPercent: estimate.marginPercent ?? (total ? (marginAmount / total) * 100 : 0),
    updatedAt: estimate.updatedAt || now(),
  };
};

const addItemToLocalEstimate = (estimate: Estimate, item: EstimateLineItem): Estimate => {
  const defaultSection: EstimateSection = {
    id: crypto.randomUUID(),
    name: 'Scope',
    lineItems: [item],
  };

  if (estimate.sections?.length) {
    return {
      ...estimate,
      sections: estimate.sections.map((section, index) => index === 0
        ? { ...section, lineItems: [...(section.lineItems || []), item] }
        : section),
    };
  }

  return { ...estimate, sections: [defaultSection] };
};

export const estimatesService = {
  ...base,

  async getAll(mode: StorageMode = getStorageMode()): Promise<Estimate[]> {
    const estimates = await base.getAll(mode);
    return estimates.map(normalizeEstimate);
  },

  async getById(id: string, mode: StorageMode = getStorageMode()): Promise<(Estimate & { items?: EstimateLineItem[]; customer?: RecordWithId | null; convertedJobId?: string }) | null> {
    const estimate = await base.getById(id, mode);
    if (!estimate) return null;
    const normalized = normalizeEstimate(estimate);
    const items = await this.getItems(id, mode);

    if (mode === 'supabase' && supabase) {
      const [{ data: customer }, { data: convertedJob }] = await Promise.all([
        normalized.customerId ? supabase.from(TABLES.customers).select('id,payload').eq('id', normalized.customerId).eq('user_id', getDataServiceUserId()).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from(TABLES.jobs).select('id,payload').eq('estimate_id', normalized.id).eq('user_id', getDataServiceUserId()).maybeSingle(),
      ]);
      return {
        ...normalized,
        items,
        customer: customer ? fromSupabaseRows<RecordWithId>([customer])[0] : null,
        convertedJobId: normalized.convertedToJobId || convertedJob?.id,
      };
    }

    const data = getLocalAppData();
    return {
      ...normalized,
      items,
      customer: data?.customers.find(customer => customer.id === normalized.customerId) || null,
      convertedJobId: normalized.convertedToJobId,
    };
  },

  async create(data: Estimate, mode: StorageMode = getStorageMode()): Promise<Estimate> {
    return base.create(normalizeEstimate(data), mode);
  },

  async update(id: string, data: Partial<Estimate>, mode: StorageMode = getStorageMode()): Promise<Estimate | null> {
    const existing = await base.getById(id, mode);
    return existing ? base.update(id, normalizeEstimate({ ...existing, ...data }), mode) : null;
  },

  async getItems(estimateId: string, mode: StorageMode = getStorageMode()): Promise<EstimateLineItem[]> {
    if (mode === 'supabase' && supabase) {
      const { data, error } = await supabase.from(TABLES.estimateItems).select('id,payload').eq('estimate_id', estimateId).eq('user_id', getDataServiceUserId()).order('created_at');
      if (error) throw error;
      return fromSupabaseRows<EstimateLineItem>(data).map(normalizeEstimateItem);
    }

    const estimate = getLocalAppData()?.estimates.find(item => item.id === estimateId);
    return estimate ? flattenEstimateItems(estimate) : [];
  },

  async addItem(estimateId: string, item: EstimateItemInput, mode: StorageMode = getStorageMode()): Promise<EstimateLineItem> {
    const normalized = normalizeEstimateItem(item);
    if (mode === 'supabase') {
      await upsertSupabaseRecords(TABLES.estimateItems, [{ ...normalized, estimateId }]);
      return normalized;
    }

    const data = getLocalAppData();
    if (!data) return normalized;
    saveLocalAppData({
      ...data,
      estimates: data.estimates.map(estimate => estimate.id === estimateId ? addItemToLocalEstimate(estimate, normalized) : estimate),
    });
    return normalized;
  },

  async updateItem(itemId: string, data: Partial<EstimateLineItem>, mode: StorageMode = getStorageMode()): Promise<EstimateLineItem | null> {
    if (mode === 'supabase' && supabase) {
      const { data: row, error } = await supabase.from(TABLES.estimateItems).select('id,payload,estimate_id').eq('id', itemId).eq('user_id', getDataServiceUserId()).maybeSingle();
      if (error) throw error;
      if (!row) return null;
      const updated = normalizeEstimateItem({ ...row.payload, ...data, id: itemId });
      await upsertSupabaseRecords(TABLES.estimateItems, [{ ...updated, estimateId: row.estimate_id }]);
      return updated;
    }

    const appData = getLocalAppData();
    if (!appData) return null;
    let updatedItem: EstimateLineItem | null = null;
    const updateSection = (section: EstimateSection) => ({
      ...section,
      lineItems: section.lineItems.map(item => {
        if (item.id !== itemId) return item;
        updatedItem = normalizeEstimateItem({ ...item, ...data });
        return updatedItem;
      }),
    });
    saveLocalAppData({
      ...appData,
      estimates: appData.estimates.map(estimate => ({
        ...estimate,
        sections: estimate.sections?.map(updateSection),
        scopes: estimate.scopes?.map(scope => ({ ...scope, sections: scope.sections.map(updateSection) })),
      })),
    });
    return updatedItem;
  },

  async deleteItem(itemId: string, mode: StorageMode = getStorageMode()): Promise<void> {
    if (mode === 'supabase' && supabase) {
      const { error } = await supabase.from(TABLES.estimateItems).delete().eq('id', itemId).eq('user_id', getDataServiceUserId());
      if (error) throw error;
      return;
    }

    const data = getLocalAppData();
    if (!data) return;
    const filterSection = (section: EstimateSection) => ({ ...section, lineItems: section.lineItems.filter(item => item.id !== itemId) });
    saveLocalAppData({
      ...data,
      estimates: data.estimates.map(estimate => ({
        ...estimate,
        sections: estimate.sections?.map(filterSection),
        scopes: estimate.scopes?.map(scope => ({ ...scope, sections: scope.sections.map(filterSection) })),
      })),
    });
  },

  async createWithItems(estimateData: Estimate, items: EstimateItemInput[], mode: StorageMode = getStorageMode()): Promise<Estimate> {
    const estimate = await this.create(estimateData, mode);
    if (mode === 'supabase') {
      for (const item of items) await this.addItem(estimate.id, item, mode);
    }
    return estimate;
  },

  async updateWithItems(estimateId: string, estimateData: Partial<Estimate>, items: EstimateItemInput[], mode: StorageMode = getStorageMode()): Promise<Estimate | null> {
    const estimate = await this.update(estimateId, estimateData, mode);
    if (!estimate) return null;
    if (mode === 'supabase' && supabase) {
      await supabase.from(TABLES.estimateItems).delete().eq('estimate_id', estimateId).eq('user_id', getDataServiceUserId());
      for (const item of items) await this.addItem(estimateId, item, mode);
    }
    return estimate;
  },
};
