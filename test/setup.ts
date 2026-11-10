import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Polyfill structuredClone if needed
if (typeof structuredClone === 'undefined') {
  global.structuredClone = (val: unknown) => JSON.parse(JSON.stringify(val));
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
