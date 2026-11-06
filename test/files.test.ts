import { describe, it, expect } from 'vitest';
import {
  computeSha256,
  toChunkedBase64,
  fromChunkedBase64,
  isAllowedFileType,
  formatFileSize,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/files';

describe('files.ts unit tests', () => {
  it('computes sha256 correctly', async () => {
    const text = 'Resume Vault Test Content';
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    const hash = await computeSha256(bytes);
    expect(hash).toHaveLength(64);
    expect(typeof hash).toBe('string');
  });

  it('performs base64 chunked encoding and decoding roundtrip on a 10 MB buffer', () => {
    // 10 MB buffer
    const size = 10 * 1024 * 1024;
    const buffer = new Uint8Array(size);
    // Fill with predictable pattern
    for (let i = 0; i < 1000; i++) {
      buffer[i] = i % 256;
    }
    buffer[size - 1] = 42;

    const encoded = toChunkedBase64(buffer);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(size);

    const decoded = fromChunkedBase64(encoded);
    expect(decoded.length).toBe(size);
    expect(decoded[0]).toBe(0);
    expect(decoded[100]).toBe(100);
    expect(decoded[size - 1]).toBe(42);
  });

  it('validates allowed file types and limits', () => {
    const validPdf = new File(['%PDF-1.5 test content'], 'my_resume.pdf', {
      type: 'application/pdf',
    });
    expect(isAllowedFileType(validPdf).ok).toBe(true);

    const validDocx = new File(['fake docx'], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    expect(isAllowedFileType(validDocx).ok).toBe(true);

    const invalidExe = new File(['binary'], 'virus.exe', {
      type: 'application/x-msdownload',
    });
    const checkExe = isAllowedFileType(invalidExe);
    expect(checkExe.ok).toBe(false);
    expect(checkExe.error).toContain('Only PDF and DOCX');

    // Oversized file
    const largeFile = new File(['dummy'], 'giant.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(largeFile, 'size', { value: MAX_FILE_SIZE_BYTES + 100 });
    const checkLarge = isAllowedFileType(largeFile);
    expect(checkLarge.ok).toBe(false);
    expect(checkLarge.error).toContain('25 MB');
  });

  it('formats file sizes nicely', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(150000)).toBe('146.5 KB');
    expect(formatFileSize(2500000)).toBe('2.4 MB');
  });
});

