import { useState, useEffect } from 'react';
import { getCachedBlob, setCachedBlob } from '@/lib/cache';
import { getFile } from '@/lib/github';
import { createBlobFromBytes } from '@/lib/files';

export function useBlobUrl(path: string | null): { url: string | null; isLoading: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(path));

  useEffect(() => {
    if (!path) {
      setUrl(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    async function load() {
      setIsLoading(true);
      try {
        // 1. Try local IndexedDB cache first
        let bytes = await getCachedBlob(path!);

        // 2. Fall back to network if not cached
        if (!bytes) {
          bytes = await getFile(path!);
          if (bytes) {
            await setCachedBlob(path!, bytes);
          }
        }

        if (active && bytes) {
          const mime = path!.endsWith('.webp')
            ? 'image/webp'
            : path!.endsWith('.jpg') || path!.endsWith('.jpeg')
            ? 'image/jpeg'
            : 'application/pdf';

          const blob = createBlobFromBytes(bytes, mime);
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      } catch {
        // Fallback or offline
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [path]);

  return { url, isLoading };
}
