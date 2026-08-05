import { describe, expect, test } from '@jest/globals';
import {
  communityActivityPath,
  relativeActivityTime
} from '../utils/communityActivity';

describe('community activity display helpers', () => {
  test('real saves point at the collector copy; milestones and ambient items point at cards', () => {
    expect(communityActivityPath({
      type: 'save',
      actor: { username: 'Ada Earth' },
      card: { id: 'card/1' }
    })).toBe('/Ada%20Earth/card/card%2F1');
    expect(communityActivityPath({
      type: 'save',
      synthetic: true,
      actor: { username: 'Ada Earth' },
      card: { id: 'card/1' }
    })).toBe('/card/card%2F1');
    expect(communityActivityPath({
      type: 'reaction',
      actor: { username: 'Ada Earth' },
      card: { id: 'card/1' }
    })).toBe('/card/card%2F1');
    expect(communityActivityPath({
      type: 'set_complete',
      actor: { username: 'Ada Earth', collectionPath: '/Ada%20Earth/collection' },
      card: { id: 'card/1' }
    })).toBe('/card/card%2F1');
  });

  test('relative times stay compact and tolerate invalid/future values', () => {
    const now = Date.UTC(2026, 7, 2, 12, 0, 0);
    expect(relativeActivityTime(new Date(now - 20_000).toISOString(), now)).toBe('now');
    expect(relativeActivityTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe('5m');
    expect(relativeActivityTime(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe('3h');
    expect(relativeActivityTime(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe('2d');
    expect(relativeActivityTime(new Date(now + 60_000).toISOString(), now)).toBe('now');
    expect(relativeActivityTime('not-a-date', now)).toBe('');
  });
});
