import { describe, it, expect } from 'vitest';
import { latest, groupByMonth, formatVersionDate } from '@/lib/dates';
import { Version } from '@/types';

function createMockVersion(overrides: Partial<Version>): Version {
  return {
    id: overrides.id || 'v1',
    trackId: overrides.trackId || 't1',
    label: overrides.label || 'Test Version',
    versionDate: overrides.versionDate || '2026-11-05',
    fileName: overrides.fileName || 'resume.pdf',
    mime: overrides.mime || 'application/pdf',
    sizeBytes: overrides.sizeBytes || 1024,
    sha256: overrides.sha256 || 'hash',
    filePath: overrides.filePath || 'files/v1.pdf',
    thumbPath: overrides.thumbPath !== undefined ? overrides.thumbPath : 'thumbs/v1.webp',
    createdAt: overrides.createdAt || '2026-11-05T12:00:00.000Z',
    updatedAt: overrides.updatedAt || '2026-11-05T12:00:00.000Z',
    deletedAt: overrides.deletedAt !== undefined ? overrides.deletedAt : null,
  };
}

describe('dates.ts unit tests', () => {
  it('correctly formats version dates', () => {
    expect(formatVersionDate('2026-10-12')).toBe("12 Oct '26");
    expect(formatVersionDate('2025-01-05')).toBe("5 Jan '25");
  });

  describe('latest() selector', () => {
    it('returns null for empty version list', () => {
      expect(latest([])).toBeNull();
    });

    it('ignores soft-deleted versions', () => {
      const v1 = createMockVersion({
        id: 'v1',
        versionDate: '2026-11-01',
        deletedAt: '2026-11-02T00:00:00.000Z',
      });
      const v2 = createMockVersion({
        id: 'v2',
        versionDate: '2026-10-15',
        deletedAt: null,
      });

      expect(latest([v1, v2])?.id).toBe('v2');
    });

    it('picks the version with the newest versionDate', () => {
      const v1 = createMockVersion({ id: 'v1', versionDate: '2026-10-15' });
      const v2 = createMockVersion({ id: 'v2', versionDate: '2026-11-05' });
      const v3 = createMockVersion({ id: 'v3', versionDate: '2026-09-20' });

      expect(latest([v1, v2, v3])?.id).toBe('v2');
    });

    it('breaks ties using createdAt descending', () => {
      const v1 = createMockVersion({
        id: 'v1',
        versionDate: '2026-11-05',
        createdAt: '2026-11-05T09:00:00.000Z',
      });
      const v2 = createMockVersion({
        id: 'v2',
        versionDate: '2026-11-05',
        createdAt: '2026-11-05T15:30:00.000Z', // newer upload
      });

      expect(latest([v1, v2])?.id).toBe('v2');
    });

    it('filters by trackId when provided', () => {
      const v1 = createMockVersion({ id: 'v1', trackId: 'trackA', versionDate: '2026-11-10' });
      const v2 = createMockVersion({ id: 'v2', trackId: 'trackB', versionDate: '2026-11-05' });

      expect(latest([v1, v2], 'trackB')?.id).toBe('v2');
    });
  });

  describe('groupByMonth()', () => {
    it('groups versions across year and month boundaries correctly', () => {
      const vNov = createMockVersion({ id: 'vNov', versionDate: '2026-11-05' });
      const vAug = createMockVersion({ id: 'vAug', versionDate: '2026-08-12' });
      const vDecPrev = createMockVersion({ id: 'vDecPrev', versionDate: '2025-12-25' });
      const vNov2 = createMockVersion({ id: 'vNov2', versionDate: '2026-11-15' });
      const vDeleted = createMockVersion({
        id: 'vDel',
        versionDate: '2026-11-20',
        deletedAt: '2026-11-21T00:00:00.000Z',
      });

      const groups = groupByMonth([vNov, vAug, vDecPrev, vNov2, vDeleted]);

      // 3 groups: Nov 2026, Aug 2026, Dec 2025
      expect(groups.length).toBe(3);
      expect(groups[0].monthKey).toBe('2026-11');
      expect(groups[0].header).toBe('November 2026');
      expect(groups[0].versions.map((v) => v.id)).toEqual(['vNov2', 'vNov']);

      expect(groups[1].monthKey).toBe('2026-08');
      expect(groups[1].header).toBe('August 2026');

      expect(groups[2].monthKey).toBe('2025-12');
      expect(groups[2].header).toBe('December 2025');
    });
  });
});
