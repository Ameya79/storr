import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mergeManifests, purgeExpiredTrash, sync, hasSemanticManifestDiff, THIRTY_DAYS_MS } from '@/lib/sync';
import { Manifest, Track, Version, OutboxOp } from '@/types';
import { useVault, createDefaultManifest } from '@/store/useVault';
import * as github from '@/lib/github';
import * as cache from '@/lib/cache';
import * as config from '@/lib/config';

describe('sync.ts unit tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useVault.setState({
      manifest: createDefaultManifest(),
      manifestSha: 'sha-initial',
      outbox: [],
      syncStatus: 'synced',
      lastSyncAt: null,
      isHydrated: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('mergeManifests (three-way merge)', () => {
    it('merges tracks: preserves unique tracks and chooses newer updatedAt on conflict', () => {
      const localTrack: Track = {
        id: 'track-1',
        name: 'Product - Local edit',
        emoji: '',
        color: '#6366F1',
        order: 0,
        archived: false,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-05T12:00:00.000Z', // newer
      };

      const remoteTrack: Track = {
        id: 'track-1',
        name: 'Product - Remote edit',
        emoji: '',
        color: '#6366F1',
        order: 0,
        archived: false,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-04T12:00:00.000Z', // older
      };

      const uniqueRemoteTrack: Track = {
        id: 'track-2',
        name: 'Design',
        emoji: '',
        color: '#EC4899',
        order: 1,
        archived: false,
        createdAt: '2026-11-02T00:00:00.000Z',
        updatedAt: '2026-11-02T00:00:00.000Z',
      };

      const localManifest: Manifest = {
        schema: 1,
        updatedAt: '2026-11-05T12:00:00.000Z',
        tracks: [localTrack],
        versions: [],
      };

      const remoteManifest: Manifest = {
        schema: 1,
        updatedAt: '2026-11-04T12:00:00.000Z',
        tracks: [remoteTrack, uniqueRemoteTrack],
        versions: [],
      };

      const merged = mergeManifests(localManifest, remoteManifest);
      expect(merged.tracks.length).toBe(2);

      const resolved = merged.tracks.find((t) => t.id === 'track-1');
      expect(resolved?.name).toBe('Product - Local edit'); // local won because newer updatedAt

      const keptRemote = merged.tracks.find((t) => t.id === 'track-2');
      expect(keptRemote?.name).toBe('Design');
    });

    it('deduplicates branches with identical names and keeps stable ID', () => {
      const localTrack: Track = {
        id: 'track-uuid-local',
        name: 'main',
        emoji: '',
        color: '#18181B',
        order: 0,
        archived: false,
        createdAt: '2026-11-06T00:00:00.000Z',
        updatedAt: '2026-11-06T00:00:00.000Z',
      };

      const remoteTrack: Track = {
        id: 'track-uuid-remote',
        name: 'Main ', // slightly different casing / whitespace
        emoji: '',
        color: '#18181B',
        order: 0,
        archived: false,
        createdAt: '2026-11-05T00:00:00.000Z',
        updatedAt: '2026-11-05T00:00:00.000Z',
      };

      const merged = mergeManifests(
        { schema: 1, updatedAt: '2026-11-06T00:00:00.000Z', tracks: [localTrack], versions: [] },
        { schema: 1, updatedAt: '2026-11-05T00:00:00.000Z', tracks: [remoteTrack], versions: [] }
      );

      // Should deduplicate to 1 track
      expect(merged.tracks.length).toBe(1);
      expect(merged.tracks[0].name.toLowerCase().trim()).toBe('main');
    });

    it('merges versions: simulates two devices editing different versions with no loss', () => {
      const vDeviceA: Version = {
        id: 'vA',
        trackId: 'track-1',
        label: 'Device A resume',
        versionDate: '2026-11-05',
        fileName: 'a.pdf',
        mime: 'application/pdf',
        sizeBytes: 1024,
        sha256: 'hA',
        filePath: 'files/a.pdf',
        thumbPath: 'thumbs/a.webp',
        createdAt: '2026-11-05T08:00:00.000Z',
        updatedAt: '2026-11-05T08:00:00.000Z',
        deletedAt: null,
      };

      const vDeviceB: Version = {
        id: 'vB',
        trackId: 'track-1',
        label: 'Device B resume',
        versionDate: '2026-11-05',
        fileName: 'b.pdf',
        mime: 'application/pdf',
        sizeBytes: 1024,
        sha256: 'hB',
        filePath: 'files/b.pdf',
        thumbPath: 'thumbs/b.webp',
        createdAt: '2026-11-05T09:00:00.000Z',
        updatedAt: '2026-11-05T09:00:00.000Z',
        deletedAt: null,
      };

      const manifestDevA: Manifest = {
        schema: 1,
        updatedAt: '2026-11-05T08:00:00.000Z',
        tracks: [],
        versions: [vDeviceA],
      };

      const manifestDevB: Manifest = {
        schema: 1,
        updatedAt: '2026-11-05T09:00:00.000Z',
        tracks: [],
        versions: [vDeviceB],
      };

      const merged = mergeManifests(manifestDevA, manifestDevB);
      expect(merged.versions.length).toBe(2);
      expect(merged.versions.map((v) => v.id).sort()).toEqual(['vA', 'vB']);
    });

    it('respects soft-delete tombstones during merge when delete is newer', () => {
      const activeVersion: Version = {
        id: 'v1',
        trackId: 't1',
        label: 'Resume v1',
        versionDate: '2026-11-01',
        fileName: 'v1.pdf',
        mime: 'application/pdf',
        sizeBytes: 1000,
        sha256: 'h',
        filePath: 'files/v1.pdf',
        thumbPath: null,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
        deletedAt: null,
      };

      const deletedVersion: Version = {
        ...activeVersion,
        deletedAt: '2026-11-05T10:00:00.000Z',
        updatedAt: '2026-11-05T10:00:00.000Z', // newer
      };

      const local: Manifest = {
        schema: 1,
        updatedAt: '2026-11-01T00:00:00.000Z',
        tracks: [],
        versions: [activeVersion],
      };

      const remote: Manifest = {
        schema: 1,
        updatedAt: '2026-11-05T10:00:00.000Z',
        tracks: [],
        versions: [deletedVersion],
      };

      const merged = mergeManifests(local, remote);
      expect(merged.versions[0].deletedAt).toBe('2026-11-05T10:00:00.000Z');
    });

    it('preserves branch deletedAt tombstones when local delete is newer', () => {
      const activeRemoteTrack: Track = {
        id: 't-delete-me',
        name: 'fintech',
        color: '#2563EB',
        order: 1,
        archived: false,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      };

      const deletedLocalTrack: Track = {
        ...activeRemoteTrack,
        deletedAt: '2026-11-06T12:00:00.000Z',
        updatedAt: '2026-11-06T12:00:00.000Z', // newer
      };

      const merged = mergeManifests(
        { schema: 1, updatedAt: '2026-11-06T12:00:00.000Z', tracks: [deletedLocalTrack], versions: [] },
        { schema: 1, updatedAt: '2026-11-01T00:00:00.000Z', tracks: [activeRemoteTrack], versions: [] }
      );

      expect(merged.tracks.length).toBe(1);
      expect(merged.tracks[0].deletedAt).toBe('2026-11-06T12:00:00.000Z');
    });

    it('strictly excludes purged versions from merge even if remote still contains them', () => {
      const vPurged: Version = {
        id: 'v-purged-123',
        trackId: 't1',
        label: 'Purged Resume',
        versionDate: '2026-11-01',
        fileName: 'purged.pdf',
        mime: 'application/pdf',
        sizeBytes: 1000,
        sha256: 'sha-purged',
        filePath: 'files/purged.pdf',
        thumbPath: null,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
        deletedAt: '2026-11-06T10:00:00.000Z',
      };

      const local: Manifest = {
        schema: 1,
        updatedAt: '2026-11-07T12:00:00.000Z',
        tracks: [],
        versions: [], // purged locally
        purgedVersionIds: ['v-purged-123'],
      };

      const remote: Manifest = {
        schema: 1,
        updatedAt: '2026-11-06T10:00:00.000Z',
        tracks: [],
        versions: [vPurged], // still exists on remote
        purgedVersionIds: [],
      };

      const merged = mergeManifests(local, remote);
      // Must NOT resurrect vPurged!
      expect(merged.versions.length).toBe(0);
      expect(merged.purgedVersionIds).toContain('v-purged-123');
    });

    it('cross-device purge: Device B syncs and removes local version when remote manifest has purgedVersionIds', () => {
      const vDeviceB: Version = {
        id: 'v-shared-999',
        trackId: 't1',
        label: 'Shared Resume',
        versionDate: '2026-11-01',
        fileName: 'shared.pdf',
        mime: 'application/pdf',
        sizeBytes: 1000,
        sha256: 'sha-shared',
        filePath: 'files/shared.pdf',
        thumbPath: null,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
        deletedAt: null,
      };

      // Device B has it locally
      const localDeviceB: Manifest = {
        schema: 1,
        updatedAt: '2026-11-01T00:00:00.000Z',
        tracks: [],
        versions: [vDeviceB],
      };

      // Remote from Device A has purged it
      const remoteFromDeviceA: Manifest = {
        schema: 1,
        updatedAt: '2026-11-07T15:00:00.000Z',
        tracks: [],
        versions: [],
        purgedVersionIds: ['v-shared-999'],
      };

      const merged = mergeManifests(localDeviceB, remoteFromDeviceA);
      // Device B must drop the version because remote recorded it as purged
      expect(merged.versions.length).toBe(0);
      expect(merged.purgedVersionIds).toContain('v-shared-999');
    });
  });

  describe('hasSemanticManifestDiff', () => {
    it('returns false when manifests have identical data despite different updatedAt', () => {
      const track: Track = {
        id: 'main-track',
        name: 'main',
        color: '#18181B',
        order: 0,
        archived: false,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      };

      const version: Version = {
        id: 'v1',
        trackId: 'main-track',
        label: 'Initial',
        versionDate: '2026-11-01',
        fileName: 'res.pdf',
        mime: 'application/pdf',
        sizeBytes: 100,
        sha256: 'sha',
        filePath: 'files/res.pdf',
        thumbPath: null,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
        deletedAt: null,
      };

      const m1: Manifest = {
        schema: 1,
        updatedAt: '2026-11-06T10:00:00.000Z',
        tracks: [track],
        versions: [version],
      };

      const m2: Manifest = {
        schema: 1,
        updatedAt: '2026-11-06T11:00:00.000Z', // different timestamp
        tracks: [{ ...track }],
        versions: [{ ...version }],
      };

      expect(hasSemanticManifestDiff(m1, m2)).toBe(false);
    });

    it('returns true when tracks differ in count, name, or deletedAt', () => {
      const track: Track = {
        id: 'main-track',
        name: 'main',
        color: '#18181B',
        order: 0,
        archived: false,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      };

      const m1: Manifest = { schema: 1, updatedAt: '2026-11-06', tracks: [track], versions: [] };
      const m2: Manifest = { schema: 1, updatedAt: '2026-11-06', tracks: [], versions: [] };
      expect(hasSemanticManifestDiff(m1, m2)).toBe(true);

      const m3: Manifest = {
        schema: 1,
        updatedAt: '2026-11-06',
        tracks: [{ ...track, deletedAt: '2026-11-06T10:00:00Z' }],
        versions: [],
      };
      expect(hasSemanticManifestDiff(m1, m3)).toBe(true);
    });
  });

  describe('30-day trash purge on app open', () => {
    it('purges versions soft-deleted > 30 days ago and queues purge ops', () => {
      const now = Date.now();
      const recentDeleted: Version = {
        id: 'vRecent',
        trackId: 't1',
        label: 'Recent delete',
        versionDate: '2026-11-01',
        fileName: 'recent.pdf',
        mime: 'application/pdf',
        sizeBytes: 100,
        sha256: 'h1',
        filePath: 'files/recent.pdf',
        thumbPath: 'thumbs/recent.webp',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
        deletedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago (keep)
      };

      const expiredDeleted: Version = {
        id: 'vExpired',
        trackId: 't1',
        label: 'Expired delete',
        versionDate: '2026-09-01',
        fileName: 'expired.pdf',
        mime: 'application/pdf',
        sizeBytes: 100,
        sha256: 'h2',
        filePath: 'files/expired.pdf',
        thumbPath: 'thumbs/expired.webp',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        deletedAt: new Date(now - (THIRTY_DAYS_MS + 86400000)).toISOString(), // 31 days ago (purge)
      };

      const manifest: Manifest = {
        schema: 1,
        updatedAt: new Date().toISOString(),
        tracks: [],
        versions: [recentDeleted, expiredDeleted],
      };

      const result = purgeExpiredTrash(manifest);
      expect(result.manifest.versions.length).toBe(1);
      expect(result.manifest.versions[0].id).toBe('vRecent');

      // Purged ops include PURGE_VERSION, and DELETE_BLOB for file and thumb
      expect(result.purgedOps.some((o) => o.type === 'PURGE_VERSION' && o.versionId === 'vExpired')).toBe(true);
      expect(result.purgedOps.some((o) => o.type === 'DELETE_BLOB' && o.path === 'files/expired.pdf')).toBe(true);
      expect(result.purgedOps.some((o) => o.type === 'DELETE_BLOB' && o.path === 'thumbs/expired.webp')).toBe(true);
    });
  });

  describe('sync cycle with 409 conflict and retry', () => {
    it('retries on 409 conflict, pulls remote, merges, and succeeds', async () => {
      vi.spyOn(config, 'getConfig').mockReturnValue({
        owner: 'user',
        repo: 'repo',
        token: 'token',
      });

      // Remote manifest on GitHub
      const remoteManifest: Manifest = {
        schema: 1,
        updatedAt: '2026-11-05T01:00:00.000Z',
        tracks: [],
        versions: [],
      };

      vi.spyOn(github, 'getManifest')
        .mockResolvedValueOnce({ manifest: remoteManifest, sha: 'sha-remote-1' })
        .mockResolvedValueOnce({ manifest: remoteManifest, sha: 'sha-remote-2' });

      // putFile fails on first attempt with ConflictError, succeeds on second
      vi.spyOn(github, 'putFile')
        .mockRejectedValueOnce(new github.ConflictError('SHA mismatch', 409))
        .mockResolvedValueOnce('sha-remote-3');

      vi.spyOn(cache, 'setCachedManifest').mockResolvedValue(undefined);
      vi.spyOn(cache, 'setCachedManifestSha').mockResolvedValue(undefined);
      vi.spyOn(cache, 'setCachedOutbox').mockResolvedValue(undefined);
      vi.spyOn(cache, 'setLastSyncAt').mockResolvedValue(undefined);

      await sync();

      expect(useVault.getState().syncStatus).toBe('synced');
      expect(useVault.getState().manifestSha).toBe('sha-remote-3');
    });

    it('preserves outbox operations when offline', async () => {
      vi.spyOn(config, 'getConfig').mockReturnValue({
        owner: 'user',
        repo: 'repo',
        token: 'token',
      });

      const pendingOp: OutboxOp = {
        type: 'UPLOAD_BLOB',
        path: 'files/test.pdf',
        key: 'files/test.pdf',
      };
      useVault.setState({ outbox: [pendingOp] });

      // Simulates network failure during getManifest
      vi.spyOn(github, 'getManifest').mockRejectedValue(new github.OfflineError());

      await sync();

      // State is offline and outbox is NOT lost!
      expect(useVault.getState().syncStatus).toBe('offline');
      expect(useVault.getState().outbox).toEqual([pendingOp]);
    });

    it('skips manifest push when remote and local are semantically identical and outbox is empty', async () => {
      vi.spyOn(config, 'getConfig').mockReturnValue({
        owner: 'user',
        repo: 'repo',
        token: 'token',
      });

      const track: Track = {
        id: 'main-track',
        name: 'main',
        color: '#18181B',
        order: 0,
        archived: false,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      };

      const manifest: Manifest = {
        schema: 1,
        updatedAt: '2026-11-05T01:00:00.000Z',
        tracks: [track],
        versions: [],
      };

      useVault.setState({
        manifest: { ...manifest, updatedAt: '2026-11-06T10:00:00.000Z' },
        manifestSha: 'sha-existing',
        outbox: [],
      });

      vi.spyOn(github, 'getManifest').mockResolvedValueOnce({
        manifest,
        sha: 'sha-existing',
      });

      const putFileSpy = vi.spyOn(github, 'putFile');

      vi.spyOn(cache, 'setCachedManifest').mockResolvedValue(undefined);
      vi.spyOn(cache, 'setCachedManifestSha').mockResolvedValue(undefined);
      vi.spyOn(cache, 'setCachedOutbox').mockResolvedValue(undefined);
      vi.spyOn(cache, 'setLastSyncAt').mockResolvedValue(undefined);

      await sync();

      // putFile should NOT be called for manifest.json because data is semantically identical!
      expect(putFileSpy).not.toHaveBeenCalled();
      expect(useVault.getState().syncStatus).toBe('synced');
    });
  });
});

