import type { AppData } from '../../data/types';
import { getDataServiceUserId, getLocalAppData, upsertSupabaseRecords, type RecordWithId } from './baseService';
import { TABLES } from './tables';

type MigrationKey = keyof typeof TABLES;

const supabaseErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const details = error as { message?: string; details?: string; hint?: string; code?: string };
    return [details.message, details.details, details.hint, details.code].filter(Boolean).join(' ');
  }
  return 'import failed';
};

export const collectionFromData = (data: AppData, key: MigrationKey): RecordWithId[] => {
  if (key === 'estimateItems') {
    return data.estimates.flatMap(estimate =>
      [
        ...(estimate.sections || []).flatMap(section => section.lineItems || []),
        ...(estimate.scopes || []).flatMap(scope => scope.sections.flatMap(section => section.lineItems || [])),
      ].map(item => ({
        ...item,
        estimateId: estimate.id,
        customerId: estimate.customerId,
      })),
    ) as RecordWithId[];
  }

  if (key === 'jobItems') {
    return data.jobs.flatMap(job => {
      const estimate = job.estimateId ? data.estimates.find(item => item.id === job.estimateId) : undefined;
      if (!estimate) return [];
      const estimateItems = [
        ...(estimate.sections || []).flatMap(section => section.lineItems || []),
        ...(estimate.scopes || []).flatMap(scope => scope.sections.flatMap(section => section.lineItems || [])),
      ];
      return estimateItems.map(item => ({
        id: `${job.id}-${item.id}`,
        jobId: job.id,
        estimateItemId: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        type: item.type || (item.isLabor ? 'labor' : 'other'),
        quantity: item.quantity,
        unit: item.unit,
        estimatedCost: item.costTotal ?? item.total ?? 0,
        actualCost: 0,
        status: 'planned',
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      }));
    }) as RecordWithId[];
  }

  if (key === 'invoiceItems') {
    return data.invoices.flatMap(invoice => {
      const items = ((invoice as any).items || []) as RecordWithId[];
      if (items.length) {
        return items.map(item => ({
          ...item,
          invoiceId: invoice.id,
          jobId: invoice.jobId,
          customerId: invoice.customerId,
        }));
      }
      return [{
        id: `${invoice.id}-summary`,
        invoiceId: invoice.id,
        jobId: invoice.jobId,
        customerId: invoice.customerId,
        estimateId: invoice.estimateId,
        name: invoice.invoiceNumber || 'Invoice total',
        description: invoice.notes,
        quantity: 1,
        unit: 'ea',
        unitPrice: (invoice as any).total ?? invoice.amount,
        total: (invoice as any).total ?? invoice.amount,
        sourceType: 'invoice',
        sourceId: invoice.id,
        createdAt: invoice.createdAt,
        updatedAt: (invoice as any).updatedAt || invoice.createdAt,
      }];
    }) as RecordWithId[];
  }

  if (key === 'shoppingListItems') {
    return (data.shoppingLists || []).flatMap(list =>
      (list.items || []).map(item => ({
        ...item,
        shoppingListId: list.id,
        jobId: list.jobId,
        customerId: list.customerId,
        estimateId: list.estimateId,
      })),
    ) as RecordWithId[];
  }

  if (key === 'materialOrderItems') {
    return (data.materialOrders || []).flatMap(order =>
      order.items.map(item => ({
        ...item,
        materialOrderId: order.id,
        jobId: order.jobId,
        estimateId: order.estimateId,
        customerId: order.customerId,
        supplierId: item.supplierId || order.supplierId,
      })),
    ) as RecordWithId[];
  }

  if (key === 'allowanceSelections') {
    return (data.allowances || []).flatMap(allowance =>
      allowance.selections.map(selection => ({
        ...selection,
        allowanceId: allowance.id,
        jobId: allowance.jobId,
        estimateId: allowance.estimateId,
      })),
    ) as RecordWithId[];
  }

  if (key === 'jobPhotos') return (data.photos || []) as RecordWithId[];
  if (key === 'activityLog') return (data.timeline || []) as RecordWithId[];
  if (key === 'materialOrders') return (data.materialOrders || []) as RecordWithId[];
  if (key === 'timeEntries') return data.timeEntries as RecordWithId[];

  return ((data as any)[key] || []) as RecordWithId[];
};

export const previewLocalMigration = (data: AppData = getLocalAppData() as AppData) => {
  if (!data) return [];
  return (Object.keys(TABLES) as MigrationKey[]).map(key => ({
    key,
    table: TABLES[key],
    count: collectionFromData(data, key).length,
  }));
};

export const importLocalDataToSupabase = async (data: AppData) => {
  const userId = getDataServiceUserId();
  const priorityKeys: MigrationKey[] = ['timeEntries', 'tasks', 'jobs', 'customers', 'workers'];
  const remainingKeys = (Object.keys(TABLES) as MigrationKey[]).filter(key => !priorityKeys.includes(key));
  const errors: string[] = [];
  let importedTables = 0;

  for (const key of [...priorityKeys, ...remainingKeys]) {
    const records = collectionFromData(data, key)
      .filter(record => record?.id)
      .map(record => ({ ...record, userId }));
    if (!records.length) continue;

    try {
      await upsertSupabaseRecords(TABLES[key], records);
      importedTables += 1;
    } catch (error) {
      errors.push(`${TABLES[key]}: ${supabaseErrorMessage(error)}`);
    }
  }

  if (errors.length && importedTables === 0) {
    throw new Error(errors.slice(0, 3).join(' | '));
  }
};
