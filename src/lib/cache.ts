import { get, set, del, keys } from 'idb-keyval';
import { Manifest, OutboxOp, GithubConfig } from '@/types';

const KEY_MANIFEST = 'rv:manifest';
const KEY_MANIFEST_SHA = 'rv:manifestSha';
const KEY_OUTBOX = 'rv:outbox';
const KEY_LAST_SYNC_AT = 'rv:lastSyncAt';
const KEY_BLOB_META = 'rv:blob_meta';
const KEY_CONFIG_VAULT = 'rv:config_vault';
const PREFIX_BLOB = 'rv:blob:';

export const MAX_BLOB_CACHE_BYTES = 150 * 1024 * 1024; // 150 MB

export interface BlobMetaEntry {
  path: string;
  size: number;
  lastAccessedAt: number;
  isThumb: boolean;
}

export type BlobMetaMap = Record<string, BlobMetaEntry>;

export async function getCachedManifest(): Promise<Manifest | null> {
  return (await get<Manifest>(KEY_MANIFEST)) || null;
}

export async function setCachedManifest(manifest: Manifest): Promise<void> {
  await set(KEY_MANIFEST, manifest);
}

export async function getCachedManifestSha(): Promise<string | null> {
  return (await get<string>(KEY_MANIFEST_SHA)) || null;
}

export async function setCachedManifestSha(sha: string): Promise<void> {
  await set(KEY_MANIFEST_SHA, sha);
}

export async function getCachedOutbox(): Promise<OutboxOp[]> {
  return (await get<OutboxOp[]>(KEY_OUTBOX)) || [];
}

export async function setCachedOutbox(outbox: OutboxOp[]): Promise<void> {
  await set(KEY_OUTBOX, outbox);
}

export async function getLastSyncAt(): Promise<string | null> {
  return (await get<string>(KEY_LAST_SYNC_AT)) || null;
}

export async function setLastSyncAt(time: string): Promise<void> {
  await set(KEY_LAST_SYNC_AT, time);
}

export async function getCachedConfig(): Promise<GithubConfig | null> {
  return (await get<GithubConfig>(KEY_CONFIG_VAULT)) || null;
}

export async function setCachedConfig(config: GithubConfig): Promise<void> {
  await set(KEY_CONFIG_VAULT, config);
}

export async function clearCachedConfig(): Promise<void> {
  await del(KEY_CONFIG_VAULT);
}

async function getBlobMetaMap(): Promise<BlobMetaMap> {
  return (await get<BlobMetaMap>(KEY_BLOB_META)) || {};
}

async function setBlobMetaMap(meta: BlobMetaMap): Promise<void> {
  await set(KEY_BLOB_META, meta);
}

export async function getCachedBlob(path: string): Promise<Uint8Array | null> {
  const blobKey = `${PREFIX_BLOB}${path}`;
  const data = await get<Uint8Array>(blobKey);
  if (!data) return null;

  // Update LRU lastAccessedAt timestamp
  try {
    const meta = await getBlobMetaMap();
    if (meta[path]) {
      meta[path].lastAccessedAt = Date.now();
      await setBlobMetaMap(meta);
    }
  } catch {
    // Non-critical LRU update failure
  }

  return data;
}

export async function setCachedBlob(path: string, bytes: Uint8Array): Promise<void> {
  const isThumb = path.startsWith('thumbs/');
  const meta = await getBlobMetaMap();

  // If adding this blob would exceed the 150 MB limit, evict LRU non-thumb blobs
  if (!isThumb) {
    let currentTotalSize = Object.values(meta)
      .filter((m) => !m.isThumb)
      .reduce((sum, item) => sum + item.size, 0);

    const needed = bytes.byteLength;
    if (currentTotalSize + needed > MAX_BLOB_CACHE_BYTES) {
      // Sort evictable entries by lastAccessedAt ascending
      const evictable = Object.values(meta)
        .filter((m) => !m.isThumb)
        .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

      for (const entry of evictable) {
        if (currentTotalSize + needed <= MAX_BLOB_CACHE_BYTES) break;
        await del(`${PREFIX_BLOB}${entry.path}`);
        delete meta[entry.path];
        currentTotalSize -= entry.size;
      }
    }
  }

  meta[path] = {
    path,
    size: bytes.byteLength,
    lastAccessedAt: Date.now(),
    isThumb,
  };

  await set(`${PREFIX_BLOB}${path}`, bytes);
  await setBlobMetaMap(meta);
}

export async function deleteCachedBlob(path: string): Promise<void> {
  await del(`${PREFIX_BLOB}${path}`);
  const meta = await getBlobMetaMap();
  if (meta[path]) {
    delete meta[path];
    await setBlobMetaMap(meta);
  }
}

export async function clearAllCache(): Promise<void> {
  const allKeys = await keys();
  for (const k of allKeys) {
    if (typeof k === 'string' && (k.startsWith('rv:') || k.startsWith(PREFIX_BLOB))) {
      await del(k);
    }
  }
}

