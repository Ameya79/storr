import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { createHash } from 'node:crypto';

// Polyfill structuredClone if needed
if (typeof structuredClone === 'undefined') {
  global.structuredClone = (val: unknown) => JSON.parse(JSON.stringify(val));
}

// Polyfill/wrap crypto.subtle.digest for cross-realm compatibility in jsdom tests
if (typeof crypto !== 'undefined' && crypto.subtle) {
  const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
  crypto.subtle.digest = async function (algorithm: any, data: any) {
    try {
      return await originalDigest(algorithm, data);
    } catch {
      const algo = typeof algorithm === 'string' ? algorithm : algorithm?.name;
      if (algo?.toUpperCase() === 'SHA-256') {
        let buf: Buffer;
        if (data instanceof ArrayBuffer) {
          buf = Buffer.from(data);
        } else if (ArrayBuffer.isView(data) || (data && 'buffer' in data)) {
          buf = Buffer.from(data.buffer, data.byteOffset || 0, data.byteLength || data.buffer.byteLength);
        } else {
          buf = Buffer.from(data);
        }
        const hash = createHash('sha256').update(buf).digest();
        return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
      }
      throw new Error(`Unsupported algorithm: ${algo}`);
    }
  };
}

// Polyfill Blob.prototype.arrayBuffer if needed in jsdom
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = async function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(this);
    });
  };
}

if (typeof File !== 'undefined' && !File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = Blob.prototype.arrayBuffer;
}

// Polyfill window.matchMedia for jsdom tests
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Global in-memory mock for idb-keyval across all test suites
const idbMemoryStore = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => idbMemoryStore.get(key)),
  set: vi.fn(async (key: string, val: unknown) => {
    idbMemoryStore.set(key, val);
  }),
  del: vi.fn(async (key: string) => {
    idbMemoryStore.delete(key);
  }),
  keys: vi.fn(async () => Array.from(idbMemoryStore.keys())),
}));
