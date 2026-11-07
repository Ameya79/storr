import { describe, it, expect, beforeEach } from 'vitest';
import { mergeManifests, hasSemanticManifestDiff } from '@/lib/sync';
import { compareVersionsDesc } from '@/lib/dates';
import { fromChunkedBase64, toChunkedBase64 } from '@/lib/files';
import { Manifest, Branch, Version } from '@/types';
import { useVault } from '@/store/useVault';

describe('System Hardening, Stress & Edge-Case Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. mergeManifests Edge-Case & Malformed Payload Resilience', () => {
    it('handles malformed tracks, undefined objects, and NaN dates without throwing', () => {
      const local: Manifest = {
        schema: 1,
        updatedAt: '2026-11-07T00:00:00.000Z',
        tracks: [
          {
            id: 'valid-1',
            name: 'main',
            color: '#18181B',
            order: 0,
            archived: false,
            createdAt: 'invalid-date-string',
            updatedAt: 'invalid-date-string',
          },
          // @ts-expect-error Testing corrupted runtime data
          null,
          // @ts-expect-error Testing incomplete track
          { id: '', name: '' },
        ],
        versions: [],
      };

      const remote: Manifest = {
        schema: 1,
        updatedAt: '2026-11-07T01:00:00.000Z',
        tracks: [
          {
            id: 'valid-1',
            name: 'main',
            color: '#18181B',
            order: 0,
            archived: false,
            createdAt: '2026-11-07T00:00:00.000Z',
            updatedAt: '2026-11-07T01:00:00.000Z',
          },
          // @ts-expect-error Testing corrupted runtime data
          undefined,
        ],
        // @ts-expect-error Testing corrupted runtime data
        versions: [null, undefined],
      };

      expect(() => mergeManifests(local, remote)).not.toThrow();
      const merged = mergeManifests(local, remote);
      expect(merged.tracks.length).toBe(1);
      expect(merged.tracks[0].id).toBe('valid-1');
      expect(merged.versions.length).toBe(0);
    });

    it('recovers cleanly when versions have identical IDs and handles timestamp tie-breakers', () => {
      const vOld: Version = {
        id: 'ver-1',
        trackId: 't1',
        label: 'Old Label',
        versionDate: '2026-11-01',
        fileName: 'resume.pdf',
        mime: 'application/pdf',
        sizeBytes: 100,
        sha256: 'sha1',
        filePath: 'files/1.pdf',
        thumbPath: null,
        deletedAt: null,
        createdAt: '2026-11-01T10:00:00.000Z',
        updatedAt: '2026-11-01T10:00:00.000Z',
      };

      const vNew: Version = {
        ...vOld,
        label: 'Newer Label',
        updatedAt: '2026-11-02T10:00:00.000Z',
      };

      const local: Manifest = { schema: 1, updatedAt: '', tracks: [], versions: [vNew] };
      const remote: Manifest = { schema: 1, updatedAt: '', tracks: [], versions: [vOld] };

      const merged = mergeManifests(local, remote);
      expect(merged.versions.length).toBe(1);
      expect(merged.versions[0].label).toBe('Newer Label');
    });
  });

  describe('2. Semantic Diff Tag Precision', () => {
    it('detects differences when only tags are modified', () => {
      const v1: Version = {
        id: 'ver-1',
        trackId: 't1',
        label: 'Label',
        versionDate: '2026-11-01',
        fileName: 'resume.pdf',
        mime: 'application/pdf',
        sizeBytes: 100,
        sha256: 'sha1',
        filePath: 'files/1.pdf',
        thumbPath: null,
        tags: ['consulting'],
        deletedAt: null,
        createdAt: '2026-11-01T10:00:00.000Z',
        updatedAt: '2026-11-01T10:00:00.000Z',
      };

      const v2: Version = {
        ...v1,
        tags: ['consulting', 'fintech'],
      };

      const m1: Manifest = { schema: 1, updatedAt: '', tracks: [], versions: [v1] };
      const m2: Manifest = { schema: 1, updatedAt: '', tracks: [], versions: [v2] };

      expect(hasSemanticManifestDiff(m1, m2)).toBe(true);
    });

    it('returns false when tags are identical but ordered differently', () => {
      const v1: Version = {
        id: 'ver-1',
        trackId: 't1',
        label: 'Label',
        versionDate: '2026-11-01',
        fileName: 'resume.pdf',
        mime: 'application/pdf',
        sizeBytes: 100,
        sha256: 'sha1',
        filePath: 'files/1.pdf',
        thumbPath: null,
        tags: ['fintech', 'consulting'],
        deletedAt: null,
        createdAt: '2026-11-01T10:00:00.000Z',
        updatedAt: '2026-11-01T10:00:00.000Z',
      };

      const v2: Version = {
        ...v1,
        tags: ['consulting', 'fintech'],
      };

      const m1: Manifest = { schema: 1, updatedAt: '', tracks: [], versions: [v1] };
      const m2: Manifest = { schema: 1, updatedAt: '', tracks: [], versions: [v2] };

      expect(hasSemanticManifestDiff(m1, m2)).toBe(false);
    });
  });

  describe('3. compareVersionsDesc Null-Safety', () => {
    it('handles undefined or partial version objects safely', () => {
      // @ts-expect-error Testing incomplete runtime objects
      expect(() => compareVersionsDesc({}, {})).not.toThrow();
      // @ts-expect-error Testing undefined values
      expect(() => compareVersionsDesc({ versionDate: '2026-11-01' }, {})).not.toThrow();
    });
  });

  describe('4. Base64 Chunking & Corruption Handling', () => {
    it('throws managed error on corrupted base64 decoding instead of crashing silently', () => {
      expect(() => fromChunkedBase64('!!!NOT_BASE_64!!!')).toThrow(/Corrupted base64 payload/);
    });

    it('handles round-trip of random binary bytes under stress', () => {
      const size = 500 * 1024; // 500 KB random payload
      const randomBytes = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        randomBytes[i] = (i * 31) % 256;
      }

      const encoded = toChunkedBase64(randomBytes);
      const decoded = fromChunkedBase64(encoded);

      expect(decoded.byteLength).toBe(randomBytes.byteLength);
      expect(decoded[0]).toBe(randomBytes[0]);
      expect(decoded[size - 1]).toBe(randomBytes[size - 1]);
    });
  });

  describe('5. Rapid Concurrent Mutations in Zustand Store', () => {
    it('maintains manifest consistency under rapid parallel branch and version additions', async () => {
      await useVault.getState().hydrate();

      // Fire 10 parallel branch additions
      const branchPromises = Array.from({ length: 10 }).map((_, i) =>
        useVault.getState().addBranch({
          name: `track-${i}`,
          color: '#2563EB',
        })
      );

      const createdBranches = await Promise.all(branchPromises);
      expect(createdBranches.length).toBe(10);

      const state = useVault.getState();
      expect(state.manifest?.tracks.length).toBeGreaterThanOrEqual(10);
    });
  });
});

