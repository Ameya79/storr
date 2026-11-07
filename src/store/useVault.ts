import { create } from 'zustand';
import { Manifest, Branch, Version, OutboxOp, SyncStatus, BRANCH_PALETTE } from '@/types';
import {
  getCachedManifest,
  setCachedManifest,
  getCachedManifestSha,
  setCachedManifestSha,
  getCachedOutbox,
  setCachedOutbox,
  getLastSyncAt,
  setLastSyncAt,
} from '@/lib/cache';
import { compareVersionsDesc, latest } from '@/lib/dates';
import { restoreConfigFromIndexedDB } from '@/lib/config';

interface VaultState {
  manifest: Manifest | null;
  manifestSha: string | null;
  outbox: OutboxOp[];
  syncStatus: SyncStatus;
  lastSyncAt: string | null;
  isHydrated: boolean;
  activeBranchId: string | null;

  // Lifecycle
  hydrate: () => Promise<void>;
  setSyncStatus: (status: SyncStatus) => void;
  setManifestAndSha: (manifest: Manifest, sha: string | null) => Promise<void>;
  setLastSyncAtTime: (time: string) => Promise<void>;
  setActiveBranchId: (id: string) => void;

  // Branch actions (alias Track)
  addBranch: (branch: { name: string; emoji?: string; color: string }) => Promise<Branch>;
  addTrack: (track: { name: string; emoji?: string; color: string }) => Promise<Branch>;
  updateBranch: (id: string, updates: Partial<Pick<Branch, 'name' | 'emoji' | 'color' | 'archived'>>) => Promise<void>;
  updateTrack: (id: string, updates: Partial<Pick<Branch, 'name' | 'emoji' | 'color' | 'archived'>>) => Promise<void>;
  reorderBranches: (orderedIds: string[]) => Promise<void>;
  reorderTracks: (orderedIds: string[]) => Promise<void>;
  archiveBranch: (id: string, archived: boolean) => Promise<void>;
  archiveTrack: (id: string, archived: boolean) => Promise<void>;
  deleteBranch: (id: string, options?: { deleteResumes?: boolean }) => Promise<{ success: boolean; error?: string }>;
  deleteTrack: (id: string, options?: { deleteResumes?: boolean }) => Promise<{ success: boolean; error?: string }>;

  // Version actions
  addVersion: (version: {
    trackId: string;
    label: string;
    note?: string;
    tags?: string[];
    versionDate: string;
    fileName: string;
    mime: string;
    sizeBytes: number;
    sha256: string;
    filePath: string;
    thumbPath: string | null;
  }) => Promise<Version>;
  updateVersion: (id: string, updates: Partial<Pick<Version, 'label' | 'note' | 'versionDate' | 'trackId'>>) => Promise<void>;
  moveVersion: (id: string, newBranchId: string) => Promise<void>;
  softDeleteVersion: (id: string) => Promise<void>;
  restoreVersion: (id: string) => Promise<void>;
  purgeVersion: (id: string) => Promise<void>;

  // Outbox management
  appendOutboxOp: (op: OutboxOp) => Promise<void>;
  removeOutboxOps: (opIndicesOrFilter: (op: OutboxOp) => boolean) => Promise<void>;
}

// Pluggable sync scheduler callback
let syncScheduler: (() => void) | null = null;
export function registerSyncTrigger(fn: () => void) {
  syncScheduler = fn;
}

function requestDebouncedSync() {
  if (syncScheduler) {
    syncScheduler();
  }
}

export const DEFAULT_BRANCH_IDS = {
  MAIN: 'b7332903-131f-4994-8f65-cf8c09ddf15d',
};

export const createDefaultManifest = (): Manifest => ({
  schema: 1,
  updatedAt: new Date().toISOString(),
  tracks: [
    {
      id: DEFAULT_BRANCH_IDS.MAIN,
      name: 'main',
      emoji: '',
      color: BRANCH_PALETTE[0], // #18181B Graphite
      order: 0,
      archived: false,
      createdAt: '2026-11-06T08:00:00.000Z',
      updatedAt: '2026-11-06T08:00:00.000Z',
    },
  ],
  versions: [],
});

export const useVault = create<VaultState>((set, get) => ({
  manifest: null,
  manifestSha: null,
  outbox: [],
  syncStatus: 'synced',
  lastSyncAt: null,
  isHydrated: false,
  activeBranchId: null,

  hydrate: async () => {
    try {
      // Ensure credentials survived any localStorage eviction
      await restoreConfigFromIndexedDB();

      const [manifest, manifestSha, outbox, lastSyncAt] = await Promise.all([
        getCachedManifest(),
        getCachedManifestSha(),
        getCachedOutbox(),
        getLastSyncAt(),
      ]);

      const initialManifest = manifest || createDefaultManifest();
      const initialBranch = initialManifest.tracks[0]?.id || null;

      set({
        manifest: initialManifest,
        manifestSha: manifestSha || null,
        outbox: outbox || [],
        lastSyncAt: lastSyncAt || null,
        activeBranchId: initialBranch,
        isHydrated: true,
      });
    } catch {
      set({ isHydrated: true });
    }
  },

  setSyncStatus: (status) => set({ syncStatus: status }),

  setLastSyncAtTime: async (time) => {
    await setLastSyncAt(time);
    set({ lastSyncAt: time });
  },

  setManifestAndSha: async (manifest, sha) => {
    await Promise.all([setCachedManifest(manifest), sha ? setCachedManifestSha(sha) : Promise.resolve()]);
    set({ manifest, manifestSha: sha });
  },

  setActiveBranchId: (id) => set({ activeBranchId: id }),

  appendOutboxOp: async (op: OutboxOp) => {
    const nextOutbox = [...get().outbox, op];
    await setCachedOutbox(nextOutbox);
    set({ outbox: nextOutbox });
    requestDebouncedSync();
  },

  removeOutboxOps: async (predicate) => {
    const nextOutbox = get().outbox.filter((op) => !predicate(op));
    await setCachedOutbox(nextOutbox);
    set({ outbox: nextOutbox });
  },

  addBranch: async ({ name, emoji, color }) => {
    const current = get().manifest || createDefaultManifest();
    const now = new Date().toISOString();
    const newBranch: Branch = {
      id: crypto.randomUUID(),
      name: name.trim(),
      emoji: (emoji || '').trim(),
      color: color.trim(),
      order: current.tracks.length,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };

    const nextManifest: Manifest = {
      ...current,
      updatedAt: now,
      tracks: [...current.tracks, newBranch],
    };

    await setCachedManifest(nextManifest);
    const op: OutboxOp = { type: 'UPSERT_TRACK', track: newBranch, id: newBranch.id };
    const nextOutbox = [...get().outbox, op];
    await setCachedOutbox(nextOutbox);

    set({ manifest: nextManifest, outbox: nextOutbox });
    requestDebouncedSync();
    return newBranch;
  },
  addTrack: async (track) => get().addBranch(track),

  updateBranch: async (id, updates) => {
    const current = get().manifest;
    if (!current) return;
    const now = new Date().toISOString();

    let updatedBranch: Branch | null = null;
    const tracks = current.tracks.map((t) => {
      if (t.id === id) {
        updatedBranch = {
          ...t,
          ...updates,
          name: updates.name ? updates.name.trim() : t.name,
          updatedAt: now,
        };
        return updatedBranch;
      }
      return t;
    });

    if (!updatedBranch) return;

    const nextManifest: Manifest = { ...current, updatedAt: now, tracks };
    await setCachedManifest(nextManifest);
    const op: OutboxOp = { type: 'UPSERT_TRACK', track: updatedBranch, id };
    const nextOutbox = [...get().outbox, op];
    await setCachedOutbox(nextOutbox);

    set({ manifest: nextManifest, outbox: nextOutbox });
    requestDebouncedSync();
  },
  updateTrack: async (id, updates) => get().updateBranch(id, updates),

  reorderBranches: async (orderedIds) => {
    const current = get().manifest;
    if (!current) return;
    const now = new Date().toISOString();

    const orderMap = new Map<string, number>();
    orderedIds.forEach((id, idx) => orderMap.set(id, idx));

    const updatedTracks = current.tracks.map((t) => {
      if (orderMap.has(t.id)) {
        return { ...t, order: orderMap.get(t.id)!, updatedAt: now };
      }
      return t;
    });

    const nextManifest: Manifest = { ...current, updatedAt: now, tracks: updatedTracks };
    await setCachedManifest(nextManifest);

    const newOps: OutboxOp[] = updatedTracks.map((track) => ({
      type: 'UPSERT_TRACK',
      track,
      id: track.id,
    }));
    const nextOutbox = [...get().outbox, ...newOps];
    await setCachedOutbox(nextOutbox);

    set({ manifest: nextManifest, outbox: nextOutbox });
    requestDebouncedSync();
  },
  reorderTracks: async (orderedIds) => get().reorderBranches(orderedIds),

  archiveBranch: async (id, archived) => {
    return get().updateBranch(id, { archived });
  },
  archiveTrack: async (id, archived) => get().archiveBranch(id, archived),

  deleteBranch: async (id, options) => {
    const current = get().manifest;
    if (!current) return { success: false, error: 'Vault manifest not loaded' };

    // Cannot delete if 1 or fewer active branches exist
    const activeBranches = current.tracks.filter((t) => !t.archived && !t.deletedAt);
    if (activeBranches.length <= 1) {
      return { success: false, error: 'Cannot delete the only remaining branch.' };
    }

    const branchToDelete = current.tracks.find((t) => t.id === id && !t.deletedAt);
    if (!branchToDelete) {
      return { success: false, error: 'Branch does not exist.' };
    }

    const remainingActiveBranches = current.tracks.filter((t) => t.id !== id && !t.archived && !t.deletedAt);
    const fallbackBranch = remainingActiveBranches.find((b) => b.name === 'main') || remainingActiveBranches[0];
    const fallbackBranchId = fallbackBranch ? fallbackBranch.id : '';

    const now = new Date().toISOString();
    const deleteResumes = options?.deleteResumes ?? false;

    let nextVersions = current.versions;
    const additionalOps: OutboxOp[] = [];

    if (deleteResumes) {
      nextVersions = current.versions.map((v) => {
        if (v.trackId === id && !v.deletedAt) {
          additionalOps.push({ type: 'SOFT_DELETE_VERSION', versionId: v.id, deletedAt: now });
          return { ...v, deletedAt: now, updatedAt: now };
        }
        return v;
      });
    } else {
      nextVersions = current.versions.map((v) => {
        if (v.trackId === id) {
          const updated = { ...v, trackId: fallbackBranchId, updatedAt: now };
          additionalOps.push({ type: 'UPSERT_VERSION', version: updated, id: v.id });
          return updated;
        }
        return v;
      });
    }

    // Mark branch with deletedAt tombstone so sync preserves deletion across devices
    const updatedTracks = current.tracks.map((t) => {
      if (t.id === id) {
        return { ...t, deletedAt: now, updatedAt: now };
      }
      return t;
    });

    const nextManifest: Manifest = {
      ...current,
      updatedAt: now,
      tracks: updatedTracks,
      versions: nextVersions,
    };

    await setCachedManifest(nextManifest);
    const nextOutbox = [...get().outbox, ...additionalOps];
    await setCachedOutbox(nextOutbox);

    const nextActiveId =
      get().activeBranchId === id ? fallbackBranchId : get().activeBranchId;

    set({
      manifest: nextManifest,
      outbox: nextOutbox,
      activeBranchId: nextActiveId,
    });

    requestDebouncedSync();
    return { success: true };
  },
  deleteTrack: async (id, options) => get().deleteBranch(id, options),

  addVersion: async (versionData) => {
    const current = get().manifest || createDefaultManifest();
    const now = new Date().toISOString();
    const newVersion: Version = {
      id: crypto.randomUUID(),
      ...versionData,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const nextManifest: Manifest = {
      ...current,
      updatedAt: now,
      versions: [newVersion, ...current.versions],
    };

    await setCachedManifest(nextManifest);

    const ops: OutboxOp[] = [
      { type: 'UPLOAD_BLOB', path: newVersion.filePath, key: newVersion.filePath },
    ];
    if (newVersion.thumbPath) {
      ops.push({ type: 'UPLOAD_BLOB', path: newVersion.thumbPath, key: newVersion.thumbPath });
    }
    ops.push({ type: 'UPSERT_VERSION', version: newVersion, id: newVersion.id });

    const nextOutbox = [...get().outbox, ...ops];
    await setCachedOutbox(nextOutbox);

    set({ manifest: nextManifest, outbox: nextOutbox });
    requestDebouncedSync();
    return newVersion;
  },

  updateVersion: async (id, updates) => {
    const current = get().manifest;
    if (!current) return;
    const now = new Date().toISOString();

    let updatedVersion: Version | null = null;
    const versions = current.versions.map((v) => {
      if (v.id === id) {
        updatedVersion = { ...v, ...updates, updatedAt: now };
        return updatedVersion;
      }
      return v;
    });

    if (!updatedVersion) return;

    const nextManifest: Manifest = { ...current, updatedAt: now, versions };
    await setCachedManifest(nextManifest);
    const op: OutboxOp = { type: 'UPSERT_VERSION', version: updatedVersion, id };
    const nextOutbox = [...get().outbox, op];
    await setCachedOutbox(nextOutbox);

    set({ manifest: nextManifest, outbox: nextOutbox });
    requestDebouncedSync();
  },

  moveVersion: async (id, newBranchId) => {
    return get().updateVersion(id, { trackId: newBranchId });
  },

  softDeleteVersion: async (id) => {
    const current = get().manifest;
    if (!current) return;
    const now = new Date().toISOString();

    const versions = current.versions.map((v) => {
      if (v.id === id) {
        return { ...v, deletedAt: now, updatedAt: now };
      }
      return v;
    });

    const nextManifest: Manifest = { ...current, updatedAt: now, versions };
    await setCachedManifest(nextManifest);
    const op: OutboxOp = { type: 'SOFT_DELETE_VERSION', versionId: id, deletedAt: now };
    const nextOutbox = [...get().outbox, op];
    await setCachedOutbox(nextOutbox);

    set({ manifest: nextManifest, outbox: nextOutbox });
    requestDebouncedSync();
  },

  restoreVersion: async (id) => {
    const current = get().manifest;
    if (!current) return;
    const now = new Date().toISOString();

    const versions = current.versions.map((v) => {
      if (v.id === id) {
        return { ...v, deletedAt: null, updatedAt: now };
      }
      return v;
    });

    const nextManifest: Manifest = { ...current, updatedAt: now, versions };
    await setCachedManifest(nextManifest);
    const op: OutboxOp = { type: 'RESTORE_VERSION', versionId: id, updatedAt: now };
    const nextOutbox = [...get().outbox, op];
    await setCachedOutbox(nextOutbox);

    set({ manifest: nextManifest, outbox: nextOutbox });
    requestDebouncedSync();
  },

  purgeVersion: async (id) => {
    const current = get().manifest;
    if (!current) return;
    const version = current.versions.find((v) => v.id === id);
    if (!version) return;

    const now = new Date().toISOString();
    const versions = current.versions.filter((v) => v.id !== id);
    const nextManifest: Manifest = { ...current, updatedAt: now, versions };
    await setCachedManifest(nextManifest);

    const ops: OutboxOp[] = [
      { type: 'PURGE_VERSION', versionId: id },
      { type: 'DELETE_BLOB', path: version.filePath },
    ];
    if (version.thumbPath) {
      ops.push({ type: 'DELETE_BLOB', path: version.thumbPath });
    }

    const nextOutbox = [...get().outbox, ...ops];
    await setCachedOutbox(nextOutbox);

    set({ manifest: nextManifest, outbox: nextOutbox });
    requestDebouncedSync();
  },
}));

// Selectors
export function selectOrderedTracks(manifest: Manifest | null, includeArchived = false): Branch[] {
  if (!manifest) return [];
  const tracks = includeArchived
    ? manifest.tracks.filter((t) => !t.deletedAt)
    : manifest.tracks.filter((t) => !t.archived && !t.deletedAt);
  return tracks.sort((a, b) => a.order - b.order);
}

export const selectBranches = selectOrderedTracks;
export const selectOrderedBranches = selectOrderedTracks;

export function selectVersionsByTrack(manifest: Manifest | null, branchId: string): Version[] {
  if (!manifest) return [];
  const versions = manifest.versions.filter((v) => !v.deletedAt && v.trackId === branchId);
  return versions.sort(compareVersionsDesc);
}

export const selectBranchVersions = selectVersionsByTrack;
export const selectVersionsByBranch = selectVersionsByTrack;

export function selectLatestByTrack(manifest: Manifest | null, branchId: string): Version | null {
  if (!manifest) return null;
  return latest(manifest.versions, branchId);
}

export const selectLatestByBranch = selectLatestByTrack;

export function selectTrashVersions(manifest: Manifest | null): Version[] {
  if (!manifest) return [];
  const trash = manifest.versions.filter((v) => v.deletedAt !== null);
  return trash.sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
}

export function selectSearchResults(
  manifest: Manifest | null,
  query: string
): { version: Version; track: Branch | undefined }[] {
  if (!manifest || !query.trim()) return [];
  const q = query.toLowerCase().trim();
  const trackMap = new Map(manifest.tracks.map((t) => [t.id, t]));

  return manifest.versions
    .filter((v) => !v.deletedAt)
    .filter((v) => {
      const track = trackMap.get(v.trackId);
      const trackNameMatch = track ? track.name.toLowerCase().includes(q) : false;
      const labelMatch = v.label.toLowerCase().includes(q);
      const noteMatch = v.note ? v.note.toLowerCase().includes(q) : false;
      const fileNameMatch = v.fileName.toLowerCase().includes(q);
      return labelMatch || noteMatch || trackNameMatch || fileNameMatch;
    })
    .sort(compareVersionsDesc)
    .map((version) => ({
      version,
      track: trackMap.get(version.trackId),
    }));
}

export interface BranchTreeLane {
  branch: Branch;
  versions: Version[];
  latestVersion: Version | null;
  totalVersions: number;
}

export function selectBranchTreeData(manifest: Manifest | null): BranchTreeLane[] {
  if (!manifest) return [];
  const ordered = selectOrderedBranches(manifest);
  return ordered.map((branch) => {
    const versions = selectVersionsByBranch(manifest, branch.id);
    const latestVersion = versions[0] || null;
    return {
      branch,
      versions,
      latestVersion,
      totalVersions: versions.length,
    };
  });
}

