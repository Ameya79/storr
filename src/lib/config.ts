import { GithubConfig } from '@/types';

export const CONFIG_STORAGE_KEY = 'rv.config';
export const DISCONNECTED_STORAGE_KEY = 'rv.disconnected';

export const DEFAULT_CONFIG: GithubConfig = {
  owner: process.env.NEXT_PUBLIC_GITHUB_OWNER || '',
  repo: process.env.NEXT_PUBLIC_GITHUB_REPO || '',
  token: process.env.NEXT_PUBLIC_GITHUB_TOKEN || '',
};

export function getConfig(allowDefault = true): GithubConfig | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(CONFIG_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.owner && parsed.repo && parsed.token) {
        return {
          owner: String(parsed.owner).trim(),
          repo: String(parsed.repo).trim(),
          token: String(parsed.token).trim(),
        };
      }
    }

    // If user explicitly signed out, do not fall back to default
    const isDisconnected =
      typeof window !== 'undefined' &&
      localStorage.getItem(DISCONNECTED_STORAGE_KEY) === 'true';
    if (isDisconnected) {
      return null;
    }

    // Return baked-in default configuration
    if (
      allowDefault &&
      DEFAULT_CONFIG.owner &&
      DEFAULT_CONFIG.repo &&
      DEFAULT_CONFIG.token
    ) {
      return DEFAULT_CONFIG;
    }

    return null;
  } catch {
    return null;
  }
}

export function setConfig(config: GithubConfig): void {
  const clean: GithubConfig = {
    owner: config.owner.trim(),
    repo: config.repo.trim(),
    token: config.token.trim(),
  };
  if (typeof window !== 'undefined') {
    localStorage.removeItem(DISCONNECTED_STORAGE_KEY);
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(clean));
  }
}

export function clearConfig(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    localStorage.setItem(DISCONNECTED_STORAGE_KEY, 'true');
  }
}

/**
 * Encodes { owner, repo, token } into a compact URL-safe base64 string.
 */
export function encodeSetupCode(config: GithubConfig): string {
  const payload = {
    o: config.owner.trim(),
    r: config.repo.trim(),
    t: config.token.trim(),
  };
  const json = JSON.stringify(payload);
  const base64 = btoa(json);
  // Convert standard base64 to base64url
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes a URL-safe base64 setup code back into GithubConfig.
 */
export function decodeSetupCode(code: string): GithubConfig | null {
  try {
    let base64 = code.trim().replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const json = atob(base64);
    const parsed = JSON.parse(json);
    if (parsed && parsed.o && parsed.r && parsed.t) {
      return {
        owner: String(parsed.o).trim(),
        repo: String(parsed.r).trim(),
        token: String(parsed.t).trim(),
      };
    }
    return null;
  } catch {
    return null;
  }
}
