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
 * Safely reads a File or Blob into a Uint8Array, falling back to FileReader if .arrayBuffer() is missing.
 */
export async function readFileAsUint8Array(file: File | Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Computes SHA-256 hash using Node crypto (in server/test environments) or crypto.subtle (in browser).
 */
export async function computeSha256(data: ArrayBuffer | Uint8Array | Blob | ArrayBufferView): Promise<string> {
  // If running in Node.js / Vitest test environment, use Node crypto to avoid jsdom cross-realm BufferSource issues
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const nodeCrypto = await import('crypto');
      let bytes: Uint8Array;
      if (typeof Blob !== 'undefined' && data instanceof Blob) {
        bytes = new Uint8Array(await data.arrayBuffer());
      } else if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
      } else if (ArrayBuffer.isView(data) || (data && 'buffer' in (data as any))) {
        const view = data as ArrayBufferView;
        bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
      } else {
        bytes = new Uint8Array(data as any);
      }
      return nodeCrypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
    } catch {
      // Fall through to crypto.subtle
    }
  }

  let buffer: BufferSource;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    buffer = await data.arrayBuffer();
  } else if (data instanceof ArrayBuffer) {
    buffer = data;
  } else if (ArrayBuffer.isView(data) || (data && typeof (data as any).byteLength === 'number' && 'buffer' in (data as any))) {
    const view = data as ArrayBufferView;
    buffer = new Uint8Array(view.buffer as ArrayBuffer, view.byteOffset, view.byteLength) as BufferSource;
  } else {
    buffer = data as unknown as BufferSource;
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
  const sanitized = (base64 || '').replace(/\s+/g, '');
  try {
    const binaryString = atob(sanitized);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    throw new Error(`Corrupted base64 payload: ${(err as Error).message}`);
  }
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
