import { describe, it, expect, beforeEach } from 'vitest';
import {
  useVault,
  createDefaultManifest,
  selectOrderedTracks,
  selectVersionsByTrack,
  selectLatestByTrack,
  selectTrashVersions,
  selectSearchResults,
} from '@/store/useVault';
import {
  setCachedBlob,
  getCachedBlob,
  MAX_BLOB_CACHE_BYTES,
} from '@/lib/cache';

describe('useVault and cache.ts unit tests', () => {
  beforeEach(() => {
    useVault.setState({
      manifest: createDefaultManifest(),
      manifestSha: null,
      outbox: [],
      syncStatus: 'synced',
      lastSyncAt: null,
      isHydrated: true,
    });
  });

  describe('Track actions', () => {
    it('adds a track and creates an outbox op', async () => {
      const track = await useVault.getState().addTrack({
        name: 'Design',
        emoji: '',
        color: '#EC4899',
      });

      expect(track.name).toBe('Design');
      const state = useVault.getState();
      expect(state.manifest?.tracks.some((t) => t.id === track.id)).toBe(true);

      const outbox = state.outbox;
      expect(outbox.some((op) => op.type === 'UPSERT_TRACK' && op.id === track.id)).toBe(true);
    });

    it('updates a track and creates outbox op', async () => {
      const trackId = useVault.getState().manifest!.tracks[0].id;
      await useVault.getState().updateTrack(trackId, { name: 'Product Leadership' });

      const track = useVault.getState().manifest!.tracks.find((t) => t.id === trackId);
      expect(track?.name).toBe('Product Leadership');

      const op = useVault.getState().outbox.find((o) => o.type === 'UPSERT_TRACK' && o.id === trackId);
      expect(op).toBeDefined();
    });

    it('reorders tracks properly', async () => {
      const branch2 = await useVault.getState().addBranch({ name: 'design', color: '#2563EB' });
      const tracks = useVault.getState().manifest!.tracks;
      const reversedIds = [branch2.id, tracks[0].id];

      await useVault.getState().reorderTracks(reversedIds);

      const ordered = selectOrderedTracks(useVault.getState().manifest);
      expect(ordered[0].id).toBe(branch2.id);
      expect(ordered[1].id).toBe(tracks[0].id);
    });

    it('archives a track and excludes it from selectOrderedTracks', async () => {
      const trackId = useVault.getState().manifest!.tracks[0].id;
      await useVault.getState().archiveTrack(trackId, true);

      const nonArchived = selectOrderedTracks(useVault.getState().manifest);
      expect(nonArchived.some((t) => t.id === trackId)).toBe(false);

      const all = selectOrderedTracks(useVault.getState().manifest, true);
      expect(all.some((t) => t.id === trackId)).toBe(true);
    });

    it('deletes a branch safely, reassigning resumes to main', async () => {
      const branchA = useVault.getState().manifest!.tracks[0];
      const branchB = await useVault.getState().addBranch({ name: 'lead', color: '#059669' });

      // Add a resume to branchB
      const version = await useVault.getState().addVersion({
        trackId: branchB.id,
        label: 'Lead Resume',
        versionDate: '2026-11-06',
        fileName: 'lead.pdf',
        mime: 'application/pdf',
        sizeBytes: 1024,
        sha256: 'sha-lead',
        filePath: 'files/lead.pdf',
        thumbPath: null,
      });

      // Delete branchB without deleting resumes
      const res = await useVault.getState().deleteBranch(branchB.id, { deleteResumes: false });
      expect(res.success).toBe(true);

      const state = useVault.getState();
      expect(state.manifest?.tracks.find((t) => t.id === branchB.id)?.deletedAt).toBeDefined();
      expect(selectOrderedTracks(state.manifest).some((t) => t.id === branchB.id)).toBe(false);

      // Verify resume was reassigned to fallback branch (main / branchA)
      const reassigned = state.manifest?.versions.find((v) => v.id === version.id);
      expect(reassigned?.trackId).toBe(branchA.id);
    });

    it('refuses to delete the sole remaining branch', async () => {
      // Set vault to single branch
      const singleTrack = useVault.getState().manifest!.tracks[0];
      useVault.setState({
        manifest: {
          schema: 1,
          updatedAt: new Date().toISOString(),
          tracks: [singleTrack],
          versions: [],
        },
      });

      const res = await useVault.getState().deleteBranch(singleTrack.id);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Cannot delete the only remaining branch');
    });
  });

  describe('Version actions', () => {
    it('adds a version, updates manifest, and queues blob uploads', async () => {
      const trackId = useVault.getState().manifest!.tracks[0].id;
      const version = await useVault.getState().addVersion({
        trackId,
        label: 'Fintech v3',
        note: 'Optimized for payments',
        versionDate: '2026-11-05',
        fileName: 'resume.pdf',
        mime: 'application/pdf',
        sizeBytes: 2048,
        sha256: 'sha-dummy',
        filePath: 'files/v-new.pdf',
        thumbPath: 'thumbs/v-new.webp',
      });

      const state = useVault.getState();
      expect(state.manifest?.versions[0].id).toBe(version.id);

      // Verify outbox has UPLOAD_BLOB for file and thumb, plus UPSERT_VERSION
      const uploadOps = state.outbox.filter((o) => o.type === 'UPLOAD_BLOB');
      expect(uploadOps.length).toBe(2);
      expect(uploadOps.some((o) => o.type === 'UPLOAD_BLOB' && o.path === 'files/v-new.pdf')).toBe(true);
      expect(uploadOps.some((o) => o.type === 'UPLOAD_BLOB' && o.path === 'thumbs/v-new.webp')).toBe(true);

      const upsertOp = state.outbox.find((o) => o.type === 'UPSERT_VERSION' && o.id === version.id);
      expect(upsertOp).toBeDefined();
    });

    it('handles soft-delete, restore, and purge lifecycle', async () => {
      const trackId = useVault.getState().manifest!.tracks[0].id;
      const version = await useVault.getState().addVersion({
        trackId,
        label: 'Test v1',
        versionDate: '2026-11-01',
        fileName: 'v1.pdf',
        mime: 'application/pdf',
        sizeBytes: 1024,
        sha256: 'sha-v1',
        filePath: 'files/v1.pdf',
        thumbPath: 'thumbs/v1.webp',
      });

      // Soft delete
      await useVault.getState().softDeleteVersion(version.id);
      let v = useVault.getState().manifest!.versions.find((x) => x.id === version.id);
      expect(v?.deletedAt).not.toBeNull();
      expect(selectTrashVersions(useVault.getState().manifest).length).toBe(1);

      // Restore
      await useVault.getState().restoreVersion(version.id);
      v = useVault.getState().manifest!.versions.find((x) => x.id === version.id);
      expect(v?.deletedAt).toBeNull();
      expect(selectTrashVersions(useVault.getState().manifest).length).toBe(0);

      // Purge
      await useVault.getState().purgeVersion(version.id);
      expect(useVault.getState().manifest!.versions.some((x) => x.id === version.id)).toBe(false);

      const deleteOps = useVault.getState().outbox.filter((o) => o.type === 'DELETE_BLOB');
      expect(deleteOps.some((o) => o.type === 'DELETE_BLOB' && o.path === 'files/v1.pdf')).toBe(true);
      expect(deleteOps.some((o) => o.type === 'DELETE_BLOB' && o.path === 'thumbs/v1.webp')).toBe(true);
    });

    it('search selector filters across tracks, labels, and notes', async () => {
      const track = useVault.getState().manifest!.tracks[0];
      await useVault.getState().addVersion({
        trackId: track.id,
        label: 'Senior Engineer',
        note: 'Mentions Kubernetes and Golang',
        versionDate: '2026-11-02',
        fileName: 'sr_eng.pdf',
        mime: 'application/pdf',
        sizeBytes: 1000,
        sha256: 'h1',
        filePath: 'files/1.pdf',
        thumbPath: null,
      });

      const manifest = useVault.getState().manifest;
      expect(selectVersionsByTrack(manifest, track.id).length).toBe(1);
      expect(selectLatestByTrack(manifest, track.id)?.label).toBe('Senior Engineer');
      expect(selectSearchResults(manifest, 'Kubernetes').length).toBe(1);
      expect(selectSearchResults(manifest, 'Senior').length).toBe(1);
      expect(selectSearchResults(manifest, track.name).length).toBe(1);
      expect(selectSearchResults(manifest, 'nonexistent').length).toBe(0);
    });
  });

  describe('Cache blob LRU and thumb retention', () => {
    it('never evicts thumbnails while evicting LRU blobs when exceeding limit', async () => {
      // Set a thumb
      const thumbBytes = new Uint8Array([1, 2, 3]);
      await setCachedBlob('thumbs/first.webp', thumbBytes);

      // Create a blob that simulates high memory usage near the limit
      const bigBlobSize = MAX_BLOB_CACHE_BYTES - 1000;
      const bigBlob = new Uint8Array(bigBlobSize);
      await setCachedBlob('files/old_big.pdf', bigBlob);

      // Verify both exist initially
      expect(await getCachedBlob('thumbs/first.webp')).not.toBeNull();
      expect(await getCachedBlob('files/old_big.pdf')).not.toBeNull();

      // Now add another file blob that pushes total size over MAX_BLOB_CACHE_BYTES
      const anotherBlob = new Uint8Array(5000);
      await setCachedBlob('files/new_big.pdf', anotherBlob);

      // The old non-thumb file should have been evicted to make room
      expect(await getCachedBlob('files/old_big.pdf')).toBeNull();
      // The new file is present
      expect(await getCachedBlob('files/new_big.pdf')).not.toBeNull();
      // Crucially, the thumbnail is NEVER evicted!
      expect(await getCachedBlob('thumbs/first.webp')).not.toBeNull();
    });
  });
});
