import { Manifest, OutboxOp, Track, Version, Application, ProfileLinks } from '@/types';
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

  const localPurged = (localOrMerged.purgedVersionIds || []).slice().sort().join(',');
  const remotePurged = (remote.purgedVersionIds || []).slice().sort().join(',');
  if (localPurged !== remotePurged) return true;

  const localPurgedTracks = (localOrMerged.purgedTrackIds || []).slice().sort().join(',');
  const remotePurgedTracks = (remote.purgedTrackIds || []).slice().sort().join(',');
  if (localPurgedTracks !== remotePurgedTracks) return true;

  const localApps = localOrMerged.applications || [];
  const remoteApps = remote.applications || [];
  if (localApps.length !== remoteApps.length) return true;
  const remoteAppMap = new Map<string, Application>();
  for (const a of remoteApps) remoteAppMap.set(a.id, a);
  for (const a of localApps) {
    const ra = remoteAppMap.get(a.id);
    if (!ra) return true;
    if (
      a.versionId !== ra.versionId ||
      a.company !== ra.company ||
      a.role !== ra.role ||
      a.status !== ra.status ||
      a.appliedDate !== ra.appliedDate ||
      (a.jobUrl || '') !== (ra.jobUrl || '') ||
      (a.notes || '') !== (ra.notes || '')
    ) {
      return true;
    }
  }

  const localLinks = localOrMerged.links || {};
  const remoteLinks = remote.links || {};
  if (
    (localLinks.linkedin || '') !== (remoteLinks.linkedin || '') ||
    (localLinks.github || '') !== (remoteLinks.github || '') ||
    (localLinks.portfolio || '') !== (remoteLinks.portfolio || '') ||
    (localLinks.twitter || '') !== (remoteLinks.twitter || '')
  ) {
    return true;
  }
  const localCustom = JSON.stringify(localLinks.custom || []);
  const remoteCustom = JSON.stringify(remoteLinks.custom || []);
  if (localCustom !== remoteCustom) return true;

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
 * Permanently purged items (allPurgedVersionIds / allPurgedTrackIds) are strictly excluded.
 */
export function mergeManifests(
  local: Manifest,
  remote: Manifest,
  pendingPurgeVersionIds: Set<string> = new Set(),
  pendingPurgeTrackIds: Set<string> = new Set()
): Manifest {
  // Combine all purged IDs from local, remote, and any pending outbox purge ops
  const allPurgedVersionIds = new Set([
    ...(local.purgedVersionIds || []),
    ...(remote.purgedVersionIds || []),
    ...pendingPurgeVersionIds,
  ]);

  const allPurgedTrackIds = new Set([
    ...(local.purgedTrackIds || []),
    ...(remote.purgedTrackIds || []),
    ...pendingPurgeTrackIds,
  ]);

  // Merge Tracks with deduplication by ID and trimmed lowercase name
  const trackMap = new Map<string, Track>();
  const nameToId = new Map<string, string>();

  const insertOrMergeTrack = (track: Track) => {
    if (!track || !track.id || !track.name) return;
    if (allPurgedTrackIds.has(track.id)) return;

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

    if (newTime > existingTime) {
      // Keep existingId so references stay stable, but update data
      trackMap.set(existingId, {
        ...existing,
        ...track,
        id: existingId,
      });
    } else if (newTime === existingTime) {
      // Equal timestamps: tombstone (deletedAt) wins over non-deleted
      if (track.deletedAt && !existing.deletedAt) {
        trackMap.set(existingId, {
          ...existing,
          ...track,
          id: existingId,
        });
      }
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
    if (allPurgedVersionIds.has(version.id)) continue;
    versionMap.set(version.id, version);
  }

  for (const localVersion of local.versions || []) {
    if (!localVersion || !localVersion.id) continue;
    if (allPurgedVersionIds.has(localVersion.id)) continue;

    const existing = versionMap.get(localVersion.id);
    if (!existing) {
      versionMap.set(localVersion.id, localVersion);
    } else {
      const localTime = parseSafeTime(localVersion.updatedAt);
      const remoteTime = parseSafeTime(existing.updatedAt);
      if (localTime > remoteTime) {
        versionMap.set(localVersion.id, localVersion);
      } else if (remoteTime > localTime) {
        // Remote wins
      } else {
        // Equal timestamps: tombstone (deletedAt) wins over non-deleted
        if (localVersion.deletedAt && !existing.deletedAt) {
          versionMap.set(localVersion.id, localVersion);
        }
      }
    }
  }

  const mergedTracks = Array.from(trackMap.values()).sort((a, b) => a.order - b.order);
  const mergedVersions = Array.from(versionMap.values());

  // Merge Applications with deduplication by ID and Last-Write-Wins (updatedAt)
  const appMap = new Map<string, Application>();
  for (const app of remote.applications || []) {
    if (!app || !app.id) continue;
    if (allPurgedVersionIds.has(app.versionId)) continue;
    appMap.set(app.id, app);
  }

  for (const app of local.applications || []) {
    if (!app || !app.id) continue;
    if (allPurgedVersionIds.has(app.versionId)) continue;
    const existing = appMap.get(app.id);
    if (!existing) {
      appMap.set(app.id, app);
    } else {
      const localTime = parseSafeTime(app.updatedAt);
      const remoteTime = parseSafeTime(existing.updatedAt);
      if (localTime >= remoteTime) {
        appMap.set(app.id, app);
      }
    }
  }

  // Merge ProfileLinks
  const pickLink = (localVal?: string, remoteVal?: string) => {
    if (localVal && localVal.trim()) return localVal.trim();
    if (remoteVal && remoteVal.trim()) return remoteVal.trim();
    return '';
  };

  const mergedLinks: ProfileLinks = {
    linkedin: pickLink(local.links?.linkedin, remote.links?.linkedin),
    github: pickLink(local.links?.github, remote.links?.github),
    portfolio: pickLink(local.links?.portfolio, remote.links?.portfolio),
    twitter: pickLink(local.links?.twitter, remote.links?.twitter),
    custom: (local.links?.custom && local.links.custom.length > 0)
      ? local.links.custom
      : (remote.links?.custom || []),
  };

  const mergedApplications = Array.from(appMap.values());

  return {
    schema: 1,
    updatedAt: new Date().toISOString(),
    tracks: mergedTracks,
    versions: mergedVersions,
    purgedVersionIds: Array.from(allPurgedVersionIds),
    purgedTrackIds: Array.from(allPurgedTrackIds),
    applications: mergedApplications,
    links: mergedLinks,
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
  const newlyPurgedVersionIds: string[] = [];

  for (const v of manifest.versions) {
    if (v.deletedAt) {
      const deletedTime = new Date(v.deletedAt).getTime();
      if (now - deletedTime > THIRTY_DAYS_MS) {
        // Purge
        newlyPurgedVersionIds.push(v.id);
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
  const newlyPurgedTrackIds: string[] = [];
  for (const t of manifest.tracks) {
    if (t.deletedAt) {
      const deletedTime = new Date(t.deletedAt).getTime();
      if (now - deletedTime > THIRTY_DAYS_MS) {
        newlyPurgedTrackIds.push(t.id);
        continue;
      }
    }
    retainedTracks.push(t);
  }

  if (purgedOps.length === 0 && newlyPurgedTrackIds.length === 0) {
    return { manifest, purgedOps: [] };
  }

  const nextPurgedVersions = Array.from(
    new Set([...(manifest.purgedVersionIds || []), ...newlyPurgedVersionIds])
  );
  const nextPurgedTracks = Array.from(
    new Set([...(manifest.purgedTrackIds || []), ...newlyPurgedTrackIds])
  );

  return {
    manifest: {
      ...manifest,
      updatedAt: new Date().toISOString(),
      tracks: retainedTracks,
      versions: retainedVersions,
      purgedVersionIds: nextPurgedVersions,
      purgedTrackIds: nextPurgedTracks,
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

    // Extract pending purge IDs from current outbox to protect against resurrection
    const pendingPurgeVersionIds = new Set<string>();
    const pendingPurgeTrackIds = new Set<string>();
    for (const op of currentOutbox) {
      if (op.type === 'PURGE_VERSION') {
        pendingPurgeVersionIds.add(op.versionId);
      }
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
        mergedManifest = mergeManifests(
          localManifest,
          remoteRes.manifest,
          pendingPurgeVersionIds,
          pendingPurgeTrackIds
        );
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
              mergedManifest = mergeManifests(
                mergedManifest,
                rePull.manifest,
                pendingPurgeVersionIds,
                pendingPurgeTrackIds
              );
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

    // Clean up local blob cache for any versions recorded as purged
    if (mergedManifest.purgedVersionIds && mergedManifest.purgedVersionIds.length > 0) {
      for (const purgedId of mergedManifest.purgedVersionIds) {
        deleteCachedBlob(`files/${purgedId}.pdf`).catch(() => {});
        deleteCachedBlob(`thumbs/${purgedId}.webp`).catch(() => {});
      }
    }

    // 6. Step 5: Finalize state
    const nowIso = new Date().toISOString();
    await Promise.all([
      setCachedManifest(mergedManifest),
      setCachedManifestSha(newSha),
      setLastSyncAt(nowIso),
    ]);

    // Build the set of ops that were completed during this sync run
    const completedOpsSet = new Set<OutboxOp>([
      ...completedUploadOps,
      ...completedDeleteOps,
      ...currentOutbox.filter(
        (op) =>
          op.type === 'UPSERT_TRACK' ||
          op.type === 'UPSERT_VERSION' ||
          op.type === 'SOFT_DELETE_VERSION' ||
          op.type === 'RESTORE_VERSION' ||
          op.type === 'PURGE_VERSION'
      ),
    ]);

    // Preserve any mutations added to the store while this sync network request was executing
    const latestOutbox = useVault.getState().outbox;
    const remainingOps = latestOutbox.filter((op) => !completedOpsSet.has(op));

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

