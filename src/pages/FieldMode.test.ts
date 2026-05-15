import { describe, expect, it } from 'vitest';
import { makeWorker } from '../test/factories';
import { getFieldModeWorkerId, workerMatchesProfile } from './FieldMode';
import type { UserProfile } from '../auth/rbac';

describe('FieldMode worker selection', () => {
  it('does not fall back to the first worker for unmatched crew users', () => {
    const workers = [
      makeWorker({ id: 'worker-1', email: 'first@example.com' }),
      makeWorker({ id: 'worker-2', email: 'second@example.com' }),
    ];

    expect(getFieldModeWorkerId(workers, undefined, 'crew')).toBe('');
  });

  it('allows non-crew roles to use the first worker fallback because they can switch workers', () => {
    const workers = [makeWorker({ id: 'worker-1' })];

    expect(getFieldModeWorkerId(workers, undefined, 'admin')).toBe('worker-1');
  });

  it('matches crew profile to worker by explicit worker id, email, or user id', () => {
    const profile = makeProfile({
      worker_id: 'worker-1',
      email: 'crew@example.com',
      user_id: 'user-1',
    });

    expect(workerMatchesProfile(makeWorker({ id: 'worker-1' }), profile)).toBe(true);
    expect(workerMatchesProfile(makeWorker({ id: 'worker-2', email: 'crew@example.com' }), profile)).toBe(true);
    expect(workerMatchesProfile({ ...makeWorker({ id: 'worker-3' }), userId: 'user-1' } as ReturnType<typeof makeWorker> & { userId: string }, profile)).toBe(true);
    expect(workerMatchesProfile(makeWorker({ id: 'worker-4', email: 'other@example.com' }), profile)).toBe(false);
  });
});

function makeProfile(overrides: Partial<UserProfile>): UserProfile {
  return {
    id: 'profile-1',
    user_id: 'user-1',
    role: 'crew',
    active: true,
    ...overrides,
  };
}
