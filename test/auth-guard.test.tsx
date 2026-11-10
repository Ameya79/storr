import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AppShell } from '@/components/AppShell';
import * as configLib from '@/lib/config';

// Mock next/navigation
const mockReplace = vi.fn();
let mockPathname = '/';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
  }),
  usePathname: () => mockPathname,
}));

// Mock sync triggers
vi.mock('@/lib/sync', () => ({
  setupSyncTriggers: vi.fn(() => vi.fn()),
}));

// Mock github
vi.mock('@/lib/github', () => ({
  onAuthError: vi.fn(() => vi.fn()),
}));

describe('Auth Guard and Zero-FOUC Invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockPathname = '/';
  });

  it('blocks TabBar and internal children when unauthenticated on protected route', async () => {
    // Simulate storr. OSS unconfigured state
    vi.spyOn(configLib, 'getConfig').mockReturnValue(null);
    vi.spyOn(configLib, 'restoreConfigFromIndexedDB').mockResolvedValue(null);
    const origOwner = configLib.DEFAULT_CONFIG.owner;
    const origRepo = configLib.DEFAULT_CONFIG.repo;
    const origToken = configLib.DEFAULT_CONFIG.token;

    configLib.DEFAULT_CONFIG.owner = '';
    configLib.DEFAULT_CONFIG.repo = '';
    configLib.DEFAULT_CONFIG.token = '';

    try {
      mockPathname = '/';
      await act(async () => {
        render(
          <AppShell>
            <div data-testid="internal-content">Private Resume Data</div>
          </AppShell>
        );
      });

      // Internal content and TabBar navigation must NOT be rendered
      expect(screen.queryByTestId('internal-content')).toBeNull();
      expect(screen.queryByLabelText('Mobile Navigation')).toBeNull();
      expect(screen.queryByLabelText('Desktop Navigation')).toBeNull();

      // router.replace('/setup') must be called
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/setup');
      });
    } finally {
      configLib.DEFAULT_CONFIG.owner = origOwner;
      configLib.DEFAULT_CONFIG.repo = origRepo;
      configLib.DEFAULT_CONFIG.token = origToken;
    }
  });

  it('immediately renders authenticated content when credentials are valid', async () => {
    vi.spyOn(configLib, 'getConfig').mockReturnValue({
      owner: 'johndoe',
      repo: 'my-resumes',
      token: 'ghp_secret123',
    });

    mockPathname = '/';
    await act(async () => {
      render(
        <AppShell>
          <div data-testid="internal-content">Private Resume Data</div>
        </AppShell>
      );
    });

    // Internal content and TabBar navigation should be rendered
    expect(screen.getByTestId('internal-content')).toBeDefined();
    expect(screen.getByLabelText('Mobile Navigation')).toBeDefined();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('renders setup content directly without TabBar when on /setup', async () => {
    mockPathname = '/setup';
    await act(async () => {
      render(
        <AppShell>
          <div data-testid="setup-wizard">Setup Wizard Content</div>
        </AppShell>
      );
    });

    // Setup content rendered, TabBar navigation suppressed
    expect(screen.getByTestId('setup-wizard')).toBeDefined();
    expect(screen.queryByLabelText('Mobile Navigation')).toBeNull();
    expect(screen.queryByLabelText('Desktop Navigation')).toBeNull();
  });
});
