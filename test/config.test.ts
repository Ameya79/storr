import { describe, it, expect, beforeEach } from 'vitest';
import {
  getConfig,
  setConfig,
  clearConfig,
  encodeSetupCode,
  decodeSetupCode,
  restoreConfigFromIndexedDB,
} from '@/lib/config';
import { GithubConfig } from '@/types';

describe('config.ts unit tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('manages config in localStorage and default fallback', () => {
    // When default is explicitly disabled, it returns null
    expect(getConfig(false)).toBeNull();

    const config: GithubConfig = {
      owner: 'johndoe',
      repo: 'resume-vault-data',
      token: 'github_pat_1234567890',
    };

    setConfig(config);
    expect(getConfig()).toEqual(config);

    clearConfig();
    expect(getConfig()).toBeNull();
  });

  it('correctly encodes and decodes setup codes round-trip', () => {
    const config: GithubConfig = {
      owner: 'octocat',
      repo: 'resume-vault-data',
      token: 'github_pat_abcdef123456789',
    };

    const setupCode = encodeSetupCode(config);
    expect(typeof setupCode).toBe('string');
    // base64url shouldn't contain '+', '/', or '='
    expect(setupCode).not.toContain('+');
    expect(setupCode).not.toContain('/');
    expect(setupCode).not.toContain('=');

    const decoded = decodeSetupCode(setupCode);
    expect(decoded).toEqual(config);
  });

  it('handles invalid or corrupted setup codes gracefully', () => {
    expect(decodeSetupCode('')).toBeNull();
    expect(decodeSetupCode('invalid-base-64-content!')).toBeNull();
    expect(decodeSetupCode(btoa(JSON.stringify({ wrong: 'fields' })))).toBeNull();
  });

  it('restores config from IndexedDB if localStorage is evicted', async () => {
    const config: GithubConfig = {
      owner: 'survivor',
      repo: 'resume-data',
      token: 'github_pat_survives_cleanup',
    };

    setConfig(config);
    // Allow asynchronous IndexedDB write to resolve
    await new Promise((r) => setTimeout(r, 20));

    // Simulate browser eviction of localStorage
    localStorage.clear();
    expect(getConfig(false)).toBeNull();

    // Call restoreConfigFromIndexedDB
    const restored = await restoreConfigFromIndexedDB();
    expect(restored).toEqual(config);
    expect(getConfig(false)).toEqual(config);

    // Explicit clearConfig must wipe both
    clearConfig();
    await new Promise((r) => setTimeout(r, 20));
    localStorage.clear();
    const afterClear = await restoreConfigFromIndexedDB();
    expect(afterClear).toBeNull();
  });
});

