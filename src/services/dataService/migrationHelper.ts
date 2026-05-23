import { DAILY_COMMAND_PROGRESS_RECORD_ID, type AppData } from '../../data/types';
import { getDataServiceUserId, getLocalAppData, upsertSupabaseRecords, type RecordWithId } from './baseService';
import { TABLES } from './tables';

type MigrationKey = keyof typeof TABLES;

const asArray = <T,>(items?: T[] | null): T[] => Array.isArray(items) ? items : [];

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
    return asArray(data.estimates).flatMap(estimate =>
      [
        ...asArray(estimate.sections).flatMap(section => asArray(section.lineItems)),
        ...asArray(estimate.scopes).flatMap(scope => asArray(scope.sections).flatMap(section => asArray(section.lineItems))),
      ].map(item => ({
        ...item,
        estimateId: estimate.id,
        customerId: estimate.customerId,
      })),
    ) as RecordWithId[];
  }

  if (key === 'jobItems') {
    return asArray(data.jobs).flatMap(job => {
      const estimate = job.estimateId ? asArray(data.estimates).find(item => item.id === job.estimateId) : undefined;
      if (!estimate) return [];
      const estimateItems = [
        ...asArray(estimate.sections).flatMap(section => asArray(section.lineItems)),
        ...asArray(estimate.scopes).flatMap(scope => asArray(scope.sections).flatMap(section => asArray(section.lineItems))),
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
    return asArray(data.invoices).flatMap(invoice => {
      const items = asArray((invoice as any).items) as RecordWithId[];
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
    return asArray(data.shoppingLists).flatMap(list =>
      asArray(list.items).map(item => ({
        ...item,
        shoppingListId: list.id,
        jobId: list.jobId,
        customerId: list.customerId,
        estimateId: list.estimateId,
      })),
    ) as RecordWithId[];
  }

  if (key === 'materialOrderItems') {
    return asArray(data.materialOrders).flatMap(order =>
      asArray(order.items).map(item => ({
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
    return asArray(data.allowances).flatMap(allowance =>
      asArray(allowance.selections).map(selection => ({
        ...selection,
        allowanceId: allowance.id,
        jobId: allowance.jobId,
        estimateId: allowance.estimateId,
      })),
    ) as RecordWithId[];
  }

  if (key === 'jobPhotos') return asArray(data.photos) as RecordWithId[];
  if (key === 'activityLog') {
    const dailyProgressRecord = data.dailyCommandProgress ? [{
      id: DAILY_COMMAND_PROGRESS_RECORD_ID,
      type: 'update',
      title: 'Daily Command Center Progress',
      description: 'Shared daily workflow progress and streak state.',
      timestamp: data.dailyCommandProgress.updatedAt || new Date().toISOString(),
      metadata: { dailyCommandProgress: data.dailyCommandProgress },
    }] : [];
    return [...asArray(data.timeline), ...dailyProgressRecord] as RecordWithId[];
  }
  if (key === 'materialOrders') return asArray(data.materialOrders) as RecordWithId[];
  if (key === 'timeEntries') return asArray(data.timeEntries) as RecordWithId[];

  return asArray((data as any)[key]) as RecordWithId[];
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
