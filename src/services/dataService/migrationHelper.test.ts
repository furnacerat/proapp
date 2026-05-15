import { describe, expect, it } from 'vitest';
import { DAILY_COMMAND_PROGRESS_RECORD_ID } from '../../data/types';
import { collectionFromData } from './migrationHelper';
import { installMemoryLocalStorage, seedLocalAppData } from '../../test/factories';

describe('migrationHelper', () => {
  it('exports Daily Command Center progress through the shared activity log payload', () => {
    installMemoryLocalStorage();
    const data = seedLocalAppData({
      dailyCommandProgress: {
        lastCompletedDate: '2026-05-14',
        streak: 3,
        completedActionsByDate: {
          '2026-05-14': ['task-1', 'step-jobs'],
        },
        updatedAt: '2026-05-14T12:00:00.000Z',
      },
    });

    const activityLog = collectionFromData(data, 'activityLog');
    const progressRecord = activityLog.find(record => record.id === DAILY_COMMAND_PROGRESS_RECORD_ID);

    expect(progressRecord).toMatchObject({
      id: DAILY_COMMAND_PROGRESS_RECORD_ID,
      type: 'update',
      title: 'Daily Command Center Progress',
      timestamp: '2026-05-14T12:00:00.000Z',
      metadata: {
        dailyCommandProgress: {
          lastCompletedDate: '2026-05-14',
          streak: 3,
          completedActionsByDate: {
            '2026-05-14': ['task-1', 'step-jobs'],
          },
        },
      },
    });
  });
});
