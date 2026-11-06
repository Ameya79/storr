export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export function isAllowedFileType(file: File): { ok: boolean; error?: string } {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isDocx =
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx');

  if (!isPdf && !isDocx) {
    return {
      ok: false,
      error: 'Only PDF and DOCX files are supported.',
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `File is too large (${formatFileSize(file.size)}). Maximum upload size is 25 MB.`,
    };
  }

  return { ok: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Computes SHA-256 hash using crypto.subtle.
 */
export async function computeSha256(data: ArrayBuffer | Uint8Array | Blob): Promise<string> {
  let buffer: ArrayBuffer;
  if (data instanceof Blob) {
    buffer = await data.arrayBuffer();
  } else if (data instanceof Uint8Array) {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    buffer = copy.buffer;
  } else {
    buffer = data;
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encodes Uint8Array to Base64 in 32 KB chunks to avoid Maximum Call Stack size exceeded errors.
 */
export function toChunkedBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32768
  const chunks: string[] = [];
  const len = bytes.length;

  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
    let binary = '';
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j]);
    }
    chunks.push(binary);
  }

  return btoa(chunks.join(''));
}

/**
 * Decodes a base64 string to Uint8Array.
 */
export function fromChunkedBase64(base64: string): Uint8Array {
  // Strip newlines or spaces if any
  const sanitized = base64.replace(/\s+/g, '');
  const binaryString = atob(sanitized);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function createBlobFromBytes(bytes: Uint8Array, mime?: string): Blob {
  return new Blob([bytes as unknown as BlobPart], { type: mime });
}

/**
 * Triggers a direct browser download of a blob.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Shares a blob using Web Share API if supported with files; falls back to downloadBlob.
 */
export async function shareBlob(blob: Blob, fileName: string, title: string): Promise<boolean> {
  const file = new File([blob], fileName, { type: blob.type });

  if (
    navigator.canShare &&
    navigator.canShare({ files: [file] }) &&
    navigator.share
  ) {
    try {
      await navigator.share({
        files: [file],
        title,
      });
      return true;
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        return false;
      }
      // Fallback on error
      downloadBlob(blob, fileName);
      return true;
    }
  }

  // Fallback to download
  downloadBlob(blob, fileName);
  return true;
}
