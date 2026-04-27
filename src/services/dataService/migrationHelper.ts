import type { AppData } from '../../data/types';
import { getLocalAppData, upsertSupabaseRecords, type RecordWithId } from './baseService';
import { TABLES } from './tables';

type MigrationKey = keyof typeof TABLES;

const collectionFromData = (data: AppData, key: MigrationKey): RecordWithId[] => {
  if (key === 'estimateItems') {
    return data.estimates.flatMap(estimate =>
      (estimate.sections || []).flatMap(section =>
        section.lineItems.map(item => ({
          ...item,
          estimateId: estimate.id,
          customerId: estimate.customerId,
        })),
      ),
    ) as RecordWithId[];
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
  for (const key of Object.keys(TABLES) as MigrationKey[]) {
    await upsertSupabaseRecords(TABLES[key], collectionFromData(data, key));
  }
};

