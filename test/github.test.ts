import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  validateRepo,
  getManifest,
  getFile,
  putFile,
  deleteFile,
  onAuthError,
  AuthError,
  ConflictError,
  OfflineError,
} from '@/lib/github';
import { GithubConfig, Manifest } from '@/types';
import { toChunkedBase64 } from '@/lib/files';

const mockConfig: GithubConfig = {
  owner: 'testowner',
  repo: 'testrepo',
  token: 'test_token_xyz',
};

describe('github.ts unit tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('validateRepo', () => {
    it('returns ok: true when repo is private and has push permissions', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          private: true,
          permissions: { push: true },
        }),
      } as unknown as Response);

      const res = await validateRepo(mockConfig);
      expect(res.ok).toBe(true);
    });

    it('returns error when repo is public', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          private: false,
          permissions: { push: true },
        }),
      } as unknown as Response);

      const res = await validateRepo(mockConfig);
      expect(res.ok).toBe(false);
      expect(res.error).toContain('Repository must be private');
    });

    it('returns error when token lacks push permission', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          private: true,
          permissions: { push: false },
        }),
      } as unknown as Response);

      const res = await validateRepo(mockConfig);
      expect(res.ok).toBe(false);
      expect(res.error).toContain('push');
    });

    it('returns error on 404 not found', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as unknown as Response);

      const res = await validateRepo(mockConfig);
      expect(res.ok).toBe(false);
      expect(res.error).toContain('was not found');
    });
  });

  describe('getManifest and getFile', () => {
    it('returns null on 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as unknown as Response);

      const manifestResult = await getManifest(mockConfig);
      expect(manifestResult).toBeNull();

      const fileResult = await getFile('files/abc.pdf', mockConfig);
      expect(fileResult).toBeNull();
    });

    it('returns manifest object and sha on 200', async () => {
      const manifestData: Manifest = {
        schema: 1,
        updatedAt: '2026-11-05T00:00:00.000Z',
        tracks: [],
        versions: [],
      };
      const jsonStr = JSON.stringify(manifestData);
      const encoded = toChunkedBase64(new TextEncoder().encode(jsonStr));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          sha: 'sha-manifest-123',
          content: encoded,
        }),
      } as unknown as Response);

      const result = await getManifest(mockConfig);
      expect(result).not.toBeNull();
      expect(result?.sha).toBe('sha-manifest-123');
      expect(result?.manifest.schema).toBe(1);
    });

    it('appends _ts cache-buster parameter and passes cache: no-store', async () => {
      let requestedUrl = '';
      let requestedOptions: RequestInit | undefined;
      global.fetch = vi.fn().mockImplementation(async (url, opts) => {
        requestedUrl = String(url);
        requestedOptions = opts;
        return {
          ok: false,
          status: 404,
        } as unknown as Response;
      });

      await getManifest(mockConfig);
      expect(requestedUrl).toContain('manifest.json?_ts=');
      expect(requestedOptions?.cache).toBe('no-store');
      // Ensure CORS-forbidden headers like Pragma and Cache-Control are not sent to GitHub API
      const headers = (requestedOptions?.headers || {}) as Record<string, string>;
      expect(headers['Pragma']).toBeUndefined();
      expect(headers['Cache-Control']).toBeUndefined();
    });
  });

  describe('putFile and deleteFile', () => {
    it('uploads file and returns new sha', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          content: { sha: 'new-blob-sha-456' },
        }),
      } as unknown as Response);

      const data = new TextEncoder().encode('dummy content');
      const sha = await putFile('manifest.json', data, {}, mockConfig);
      expect(sha).toBe('new-blob-sha-456');
    });

    it('throws ConflictError on 409', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ message: 'is not at the expected SHA' }),
      } as unknown as Response);

      const data = new TextEncoder().encode('content');
      await expect(putFile('manifest.json', data, { sha: 'old-sha' }, mockConfig)).rejects.toThrow(
        ConflictError
      );
    });

    it('deletes file successfully on 200', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as unknown as Response);

      await expect(
        deleteFile('files/old.pdf', 'file-sha', 'delete file', mockConfig)
      ).resolves.toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('fires authError event and throws AuthError on 401', async () => {
      let authFired = false;
      const cleanup = onAuthError(() => {
        authFired = true;
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } as unknown as Response);

      await expect(getFile('manifest.json', mockConfig)).rejects.toThrow(AuthError);
      expect(authFired).toBe(true);
      cleanup();
    });

    it('throws OfflineError on network failure', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(getFile('manifest.json', mockConfig)).rejects.toThrow(OfflineError);
    });
  });
});

