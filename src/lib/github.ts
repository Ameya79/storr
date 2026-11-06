import { GithubConfig, Manifest } from '@/types';
import { getConfig } from '@/lib/config';
import { toChunkedBase64, fromChunkedBase64 } from '@/lib/files';

export class OfflineError extends Error {
  constructor(message = 'Network request failed. Device appears offline.') {
    super(message);
    this.name = 'OfflineError';
  }
}

export class AuthError extends Error {
  constructor(message = 'GitHub authentication failed. Token is invalid or expired.') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ConflictError extends Error {
  status: number;
  constructor(message = 'Resource conflict or concurrent update.', status = 409) {
    super(message);
    this.name = 'ConflictError';
    this.status = status;
  }
}

export class GithubApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'GithubApiError';
    this.status = status;
    this.data = data;
  }
}

type AuthErrorListener = () => void;
const authErrorListeners = new Set<AuthErrorListener>();

export function onAuthError(listener: AuthErrorListener): () => void {
  authErrorListeners.add(listener);
  return () => {
    authErrorListeners.delete(listener);
  };
}

export function emitAuthError(): void {
  authErrorListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener error
    }
  });
}

function getActiveConfig(overrideConfig?: GithubConfig): GithubConfig {
  const cfg = overrideConfig || getConfig();
  if (!cfg) {
    throw new AuthError('No GitHub configuration found in local storage.');
  }
  return cfg;
}

const GITHUB_API_BASE = 'https://api.github.com';
const API_VERSION = '2022-11-28';

async function requestWithRetry(
  url: string,
  options: RequestInit,
  attempt = 1
): Promise<Response> {
  const finalOptions: RequestInit = {
    ...options,
    cache: 'no-store',
  };

  try {
    const res = await fetch(url, finalOptions);

    if (res.status === 401) {
      emitAuthError();
      throw new AuthError();
    }

    // Handle 403 rate limits with exponential backoff up to 3 retries
    if (res.status === 403 && attempt <= 3) {
      const retryAfterHeader = res.headers.get('retry-after');
      const waitMs = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1000
        : Math.min(1000 * Math.pow(2, attempt), 8000);

      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return requestWithRetry(url, options, attempt + 1);
    }

    return res;
  } catch (err: unknown) {
    if (err instanceof AuthError) throw err;
    // Check if network error
    if (
      err instanceof TypeError &&
      (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed'))
    ) {
      throw new OfflineError();
    }
    throw err;
  }
}

/**
 * Validates repository permissions and ensures it is private.
 */
export async function validateRepo(
  configOverride?: GithubConfig
): Promise<{ ok: boolean; error?: string }> {
  const config = getActiveConfig(configOverride);
  const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}?_ts=${Date.now()}`;

  try {
    const res = await requestWithRetry(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'X-GitHub-Api-Version': API_VERSION,
        Accept: 'application/vnd.github+json',
      },
    });

    if (res.status === 404) {
      return { ok: false, error: `Repository "${config.owner}/${config.repo}" was not found.` };
    }

    if (!res.ok) {
      return { ok: false, error: `GitHub API error (${res.status}): ${res.statusText}` };
    }

    const repoData = await res.json();

    if (!repoData.private) {
      return {
        ok: false,
        error: 'Repository must be private. Please change your repository visibility to private.',
      };
    }

    const hasPush = repoData.permissions?.push === true;
    if (!hasPush) {
      return {
        ok: false,
        error: 'Personal access token does not have write (push) permissions to this repository.',
      };
    }

    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return { ok: false, error: 'Personal Access Token is invalid or expired.' };
    }
    if (err instanceof OfflineError) {
      return { ok: false, error: 'Unable to connect to GitHub. Check your network connection.' };
    }
    return { ok: false, error: (err as Error)?.message || 'Failed to validate repository.' };
  }
}

/**
 * Fetches raw file bytes from GitHub Contents API.
 */
export async function getFile(
  path: string,
  configOverride?: GithubConfig
): Promise<Uint8Array | null> {
  const config = getActiveConfig(configOverride);
  const separator = path.includes('?') ? '&' : '?';
  const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}${separator}_ts=${Date.now()}`;

  const res = await requestWithRetry(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': API_VERSION,
      Accept: 'application/vnd.github.raw+json',
    },
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new GithubApiError(`Failed to fetch file "${path}"`, res.status);
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Fetches file metadata (sha, size) without downloading contents.
 */
export async function getFileMetadata(
  path: string,
  configOverride?: GithubConfig
): Promise<{ sha: string; size: number } | null> {
  const config = getActiveConfig(configOverride);
  const separator = path.includes('?') ? '&' : '?';
  const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}${separator}_ts=${Date.now()}`;

  const res = await requestWithRetry(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': API_VERSION,
      Accept: 'application/vnd.github+json',
    },
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new GithubApiError(`Failed to get metadata for "${path}"`, res.status);
  }

  const data = await res.json();
  return {
    sha: data.sha,
    size: data.size,
  };
}

/**
 * Fetches and parses manifest.json.
 */
export async function getManifest(
  configOverride?: GithubConfig
): Promise<{ manifest: Manifest; sha: string } | null> {
  const config = getActiveConfig(configOverride);
  const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/manifest.json?_ts=${Date.now()}`;

  const res = await requestWithRetry(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': API_VERSION,
      Accept: 'application/vnd.github+json',
    },
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new GithubApiError('Failed to fetch manifest.json', res.status);
  }

  const data = await res.json();
  const sha = data.sha;
  let manifest: Manifest;

  if (data.content) {
    const rawBytes = fromChunkedBase64(data.content);
    const text = new TextDecoder().decode(rawBytes);
    manifest = JSON.parse(text);
  } else {
    // Large file content via raw endpoint
    const raw = await getFile('manifest.json', configOverride);
    if (!raw) return null;
    const text = new TextDecoder().decode(raw);
    manifest = JSON.parse(text);
  }

  return { manifest, sha };
}

/**
 * Uploads a file (manifest or blob) using GitHub Contents API PUT.
 * Content is base64 chunked.
 * Returns the new commit/blob SHA.
 */
export async function putFile(
  path: string,
  bytes: Uint8Array,
  options: { sha?: string; message?: string } = {},
  configOverride?: GithubConfig
): Promise<string> {
  const config = getActiveConfig(configOverride);
  const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}`;
  const base64 = toChunkedBase64(bytes);

  const body: { message: string; content: string; sha?: string } = {
    message: options.message || `Update ${path}`,
    content: base64,
  };

  if (options.sha) {
    body.sha = options.sha;
  }

  const res = await requestWithRetry(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': API_VERSION,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 409 || res.status === 422) {
    const errData = await res.json().catch(() => null);
    throw new ConflictError(
      `Conflict while uploading ${path}: ${errData?.message || res.statusText}`,
      res.status
    );
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new GithubApiError(
      `Failed to upload ${path}: ${errData?.message || res.statusText}`,
      res.status,
      errData
    );
  }

  const data = await res.json();
  return data.content?.sha || data.commit?.sha || '';
}

/**
 * Deletes a file on GitHub Contents API.
 */
export async function deleteFile(
  path: string,
  sha: string,
  message?: string,
  configOverride?: GithubConfig
): Promise<void> {
  const config = getActiveConfig(configOverride);
  const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}`;

  const res = await requestWithRetry(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': API_VERSION,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: message || `Delete ${path}`,
      sha,
    }),
  });

  if (res.status === 404) {
    // Already deleted
    return;
  }

  if (!res.ok) {
    throw new GithubApiError(`Failed to delete ${path}`, res.status);
  }
}

