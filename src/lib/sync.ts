import { Manifest, OutboxOp, Track, Version } from '@/types';
import {
  getManifest,
  putFile,
  deleteFile,
  getFileMetadata,
  ConflictError,
  AuthError,
  OfflineError,
} from '@/lib/github';
import {
  getCachedBlob,
  deleteCachedBlob,
  setCachedManifest,
  setCachedManifestSha,
  setCachedOutbox,
  setLastSyncAt,
} from '@/lib/cache';
import { useVault, createDefaultManifest, registerSyncTrigger } from '@/store/useVault';
import { getConfig } from '@/lib/config';
import { showToast } from '@/components/Toast';

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Checks whether two manifests differ semantically in active data,
 * ignoring harmless updatedAt jitter or formatting/order variations.
 */
export function hasSemanticManifestDiff(localOrMerged: Manifest, remote: Manifest): boolean {
  const localTracks = localOrMerged.tracks || [];
  const remoteTracks = remote.tracks || [];

  if (localTracks.length !== remoteTracks.length) return true;

  const remoteTrackMap = new Map<string, Track>();
  for (const t of remoteTracks) {
    remoteTrackMap.set(t.id, t);
  }

  for (const t of localTracks) {
    const rt = remoteTrackMap.get(t.id);
    if (!rt) return true;
    if (
      t.name !== rt.name ||
      t.color !== rt.color ||
      t.order !== rt.order ||
      t.archived !== rt.archived ||
      (t.deletedAt || null) !== (rt.deletedAt || null)
    ) {
      return true;
    }
  }

  const localVersions = localOrMerged.versions || [];
  const remoteVersions = remote.versions || [];

  if (localVersions.length !== remoteVersions.length) return true;

  const remoteVersionMap = new Map<string, Version>();
  for (const v of remoteVersions) {
    remoteVersionMap.set(v.id, v);
  }

  for (const v of localVersions) {
    const rv = remoteVersionMap.get(v.id);
    if (!rv) return true;
    if (
      v.trackId !== rv.trackId ||
      v.label !== rv.label ||
      (v.note || '') !== (rv.note || '') ||
      v.versionDate !== rv.versionDate ||
      v.fileName !== rv.fileName ||
      v.mime !== rv.mime ||
      v.sizeBytes !== rv.sizeBytes ||
      v.sha256 !== rv.sha256 ||
      v.filePath !== rv.filePath ||
      (v.thumbPath || null) !== (rv.thumbPath || null) ||
      (v.deletedAt || null) !== (rv.deletedAt || null) ||
      (v.tags || []).slice().sort().join(',') !== (rv.tags || []).slice().sort().join(',')
    ) {
      return true;
    }
  }

  return false;
}

const parseSafeTime = (dateStr?: string | null): number => {
  if (!dateStr) return 0;
  const t = new Date(dateStr).getTime();
  return isNaN(t) ? 0 : t;
};

/**
 * Three-way manifest merge function:
 * Entity with the newer updatedAt wins.
 * Tracks are deduplicated by ID and normalized branch name.
 * Soft deletes (tombstones) are preserved since deletedAt updates updatedAt.
 * Tracks and versions never disappear except via explicit PURGE_VERSION.
 */
export function mergeManifests(local: Manifest, remote: Manifest): Manifest {
  // Merge Tracks with deduplication by ID and trimmed lowercase name
  const trackMap = new Map<string, Track>();
  const nameToId = new Map<string, string>();

  const insertOrMergeTrack = (track: Track) => {
    if (!track || !track.id || !track.name) return;
    const normName = track.name.trim().toLowerCase();
    const existingId = trackMap.has(track.id) ? track.id : nameToId.get(normName);

    if (!existingId) {
      trackMap.set(track.id, track);
      nameToId.set(normName, track.id);
      return;
    }

    const existing = trackMap.get(existingId)!;
    const existingTime = parseSafeTime(existing.updatedAt);
    const newTime = parseSafeTime(track.updatedAt);

    if (newTime >= existingTime) {
      // Keep existingId so references stay stable, but update data
      trackMap.set(existingId, {
        ...existing,
        ...track,
        id: existingId,
      });
    } else if (existing.deletedAt && !track.deletedAt) {
      // Preserve existing tombstone if incoming older object lacks it
      trackMap.set(existingId, existing);
    }
  };

  for (const track of remote.tracks || []) {
    insertOrMergeTrack(track);
  }

  for (const localTrack of local.tracks || []) {
    insertOrMergeTrack(localTrack);
  }

  // Merge Versions
  const versionMap = new Map<string, Version>();

  for (const version of remote.versions || []) {
    if (!version || !version.id) continue;
    versionMap.set(version.id, version);
  }

  for (const localVersion of local.versions || []) {
    if (!localVersion || !localVersion.id) continue;
    const existing = versionMap.get(localVersion.id);
    if (!existing) {
      versionMap.set(localVersion.id, localVersion);
    } else {
      // Newer updatedAt wins
      const localTime = parseSafeTime(localVersion.updatedAt);
      const remoteTime = parseSafeTime(existing.updatedAt);
      if (localTime >= remoteTime) {
        versionMap.set(localVersion.id, localVersion);
      }
    }
  }

  const mergedTracks = Array.from(trackMap.values()).sort((a, b) => a.order - b.order);
  const mergedVersions = Array.from(versionMap.values());

  return {
    schema: 1,
    updatedAt: new Date().toISOString(),
    tracks: mergedTracks,
    versions: mergedVersions,
  };
}

/**
 * Purges versions and tracks that have been soft-deleted for more than 30 days.
 */
export function purgeExpiredTrash(manifest: Manifest): {
  manifest: Manifest;
  purgedOps: OutboxOp[];
} {
  const now = Date.now();
  const retainedVersions: Version[] = [];
  const purgedOps: OutboxOp[] = [];

  for (const v of manifest.versions) {
    if (v.deletedAt) {
      const deletedTime = new Date(v.deletedAt).getTime();
      if (now - deletedTime > THIRTY_DAYS_MS) {
        // Purge
        purgedOps.push({ type: 'PURGE_VERSION', versionId: v.id });
        purgedOps.push({ type: 'DELETE_BLOB', path: v.filePath });
        if (v.thumbPath) {
          purgedOps.push({ type: 'DELETE_BLOB', path: v.thumbPath });
        }
        continue;
      }
    }
    retainedVersions.push(v);
  }

  const retainedTracks: Track[] = [];
  let tracksPurged = false;
  for (const t of manifest.tracks) {
    if (t.deletedAt) {
      const deletedTime = new Date(t.deletedAt).getTime();
      if (now - deletedTime > THIRTY_DAYS_MS) {
        tracksPurged = true;
        continue;
      }
    }
    retainedTracks.push(t);
  }

  if (purgedOps.length === 0 && !tracksPurged) {
    return { manifest, purgedOps: [] };
  }

  return {
    manifest: {
      ...manifest,
      updatedAt: new Date().toISOString(),
      tracks: retainedTracks,
      versions: retainedVersions,
    },
    purgedOps,
  };
}

// Mutex lock
let isSyncInProgress = false;
let hasQueuedSync = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export async function sync(options: { silent?: boolean } = {}): Promise<void> {
  const config = getConfig();
  if (!config) {
    useVault.getState().setSyncStatus('offline');
    return;
  }

  if (isSyncInProgress) {
    hasQueuedSync = true;
    return;
  }

  isSyncInProgress = true;
  useVault.getState().setSyncStatus('syncing');

  try {
    let localManifest = useVault.getState().manifest;
    let localSha = useVault.getState().manifestSha;
    const currentOutbox = [...useVault.getState().outbox];

    // Check if initial run with no local manifest
    if (!localManifest) {
      localManifest = createDefaultManifest();
    }

    // 1. App-open 30-day trash purge
    const purgeResult = purgeExpiredTrash(localManifest);
    if (purgeResult.purgedOps.length > 0) {
      localManifest = purgeResult.manifest;
      currentOutbox.push(...purgeResult.purgedOps);
    }

    // 2. Step 1: Pull remote manifest & merge
    let remoteRes = await getManifest();
    let mergedManifest: Manifest;
    let currentRemoteSha: string | null = null;

    if (!remoteRes) {
      // Empty remote repository, push local as initial manifest
      mergedManifest = localManifest;
    } else if (!localSha && currentOutbox.length === 0) {
      // Fresh client hydration: adopt remote repository manifest directly
      currentRemoteSha = remoteRes.sha;
      mergedManifest = remoteRes.manifest;
    } else {
      currentRemoteSha = remoteRes.sha;
      if (remoteRes.sha !== localSha || currentOutbox.length > 0) {
        mergedManifest = mergeManifests(localManifest, remoteRes.manifest);
      } else {
        mergedManifest = localManifest;
      }
    }

    // 3. Step 2: Push blobs first (UPLOAD_BLOB ops)
    const completedUploadOps = new Set<OutboxOp>();
    for (const op of currentOutbox) {
      if (op.type === 'UPLOAD_BLOB') {
        const bytes = await getCachedBlob(op.key);
        if (bytes) {
          try {
            await putFile(op.path, bytes, { message: `Upload ${op.path}` });
            completedUploadOps.add(op);
          } catch (err) {
            // If already exists remotely, consider done
            if (err instanceof ConflictError) {
              completedUploadOps.add(op);
            } else {
              throw err;
            }
          }
        } else {
          // No local blob found, skip
          completedUploadOps.add(op);
        }
      }
    }

    // Check if manifest actually needs pushing to GitHub (prevent redundant background commits)
    const hasLocalMutations = currentOutbox.length > 0 || purgeResult.purgedOps.length > 0;
    const isSemanticDiff = !remoteRes || hasSemanticManifestDiff(mergedManifest, remoteRes.manifest);
    const shouldPushManifest = !remoteRes || isSemanticDiff || hasLocalMutations;

    let newSha = currentRemoteSha || '';

    if (shouldPushManifest) {
      // 4. Step 3: Push manifest (with 409/422 retry loop up to 5 attempts)
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        attempts++;
        try {
          const manifestBytes = new TextEncoder().encode(JSON.stringify(mergedManifest, null, 2));
          newSha = await putFile(
            'manifest.json',
            manifestBytes,
            {
              sha: currentRemoteSha || undefined,
              message: `Update manifest [${mergedManifest.versions.length} versions]`,
            }
          );
          break;
        } catch (err: unknown) {
          if (err instanceof ConflictError && attempts < maxAttempts) {
            // Jittered backoff: 250ms * 2^attempt + random(0-250ms)
            const delay = 250 * Math.pow(2, attempts) + Math.random() * 250;
            await new Promise((resolve) => setTimeout(resolve, delay));

            // Re-pull live remote manifest from GitHub directly with cache-busting
            const rePull = await getManifest();
            if (rePull) {
              currentRemoteSha = rePull.sha;
              mergedManifest = mergeManifests(mergedManifest, rePull.manifest);
            }
            continue;
          }
          throw err;
        }
      }
    }

    // 5. Step 4: Process DELETE_BLOB ops after manifest push succeeds
    const completedDeleteOps = new Set<OutboxOp>();
    for (const op of currentOutbox) {
      if (op.type === 'DELETE_BLOB') {
        try {
          const meta = await getFileMetadata(op.path);
          if (meta) {
            await deleteFile(op.path, meta.sha, `Delete ${op.path}`);
          }
          await deleteCachedBlob(op.path);
          completedDeleteOps.add(op);
        } catch {
          // Continue with best effort on delete
          completedDeleteOps.add(op);
        }
      }
    }

    // 6. Step 5: Finalize state
    const nowIso = new Date().toISOString();
    await Promise.all([
      setCachedManifest(mergedManifest),
      setCachedManifestSha(newSha),
      setLastSyncAt(nowIso),
    ]);

    // Filter out finished ops
    const remainingOps = currentOutbox.filter(
      (op) =>
        !completedUploadOps.has(op) &&
        !completedDeleteOps.has(op) &&
        op.type !== 'UPSERT_TRACK' &&
        op.type !== 'UPSERT_VERSION' &&
        op.type !== 'SOFT_DELETE_VERSION' &&
        op.type !== 'RESTORE_VERSION' &&
        op.type !== 'PURGE_VERSION'
    );

    await setCachedOutbox(remainingOps);

    useVault.setState({
      manifest: mergedManifest,
      manifestSha: newSha,
      outbox: remainingOps,
      lastSyncAt: nowIso,
      syncStatus: 'synced',
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      useVault.getState().setSyncStatus('authError');
      showToast({
        type: 'error',
        message: 'GitHub token expired or invalid.',
        actionLabel: 'Settings',
        onAction: () => {
          window.location.href = '/setup?reauth=1';
        },
      });
    } else if (err instanceof OfflineError) {
      useVault.getState().setSyncStatus('offline');
    } else {
      useVault.getState().setSyncStatus('error');
      // Only display disruptive red toast for user-initiated actions, not for silent background intervals
      if (!options.silent) {
        showToast({
          type: 'error',
          message: 'Sync conflict or connection issue. Retrying shortly.',
          actionLabel: 'Retry Now',
          onAction: () => {
            sync({ silent: false });
          },
        });
      }
    }
  } finally {
    isSyncInProgress = false;
    if (hasQueuedSync) {
      hasQueuedSync = false;
      // 400ms settle delay to let GitHub Git backend replicas reach consistency
      setTimeout(() => {
        sync(options);
      }, 400);
    }
  }
}

export function debouncedSync(delayMs = 800) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    sync({ silent: false });
  }, delayMs);
}

/**
 * Initializes listeners for automatic synchronization:
 * - App boot (silent)
 * - Debounced mutation trigger from useVault (interactive)
 * - Window online event (silent)
 * - Tab visibility change (silent)
 * - 60s background interval while tab is visible (silent)
 */
export function setupSyncTriggers(): () => void {
  // Register with store
  registerSyncTrigger(() => debouncedSync(800));

  const handleOnline = () => {
    sync({ silent: true });
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      sync({ silent: true });
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const intervalId = setInterval(() => {
    if (document.visibilityState === 'visible') {
      sync({ silent: true });
    }
  }, 60000);

  // Trigger silent sync on boot
  sync({ silent: true });

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    clearInterval(intervalId);
  };
}

