'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useVault } from '@/store/useVault';
import { getConfig, restoreConfigFromIndexedDB, DEFAULT_CONFIG } from '@/lib/config';
import { setupSyncTriggers } from '@/lib/sync';
import { onAuthError } from '@/lib/github';
import { TabBar } from '@/components/TabBar';
import { ToastContainer } from '@/components/ToastContainer';
import { SyncDot } from '@/src/components/SyncDot';
import { GitBranchIcon } from '@/components/SvgIcons';
import { InstallPwaHeaderButton } from '@/components/InstallPwaPrompt';
import Link from 'next/link';
import clsx from 'clsx';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { syncStatus, hydrate, isHydrated } = useVault();

  const isSetupRoute = pathname === '/setup';

  // Synchronous initial auth check to eliminate any flash of unauthenticated internal UI
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => {
    if (pathname === '/setup') {
      return 'unauthenticated';
    }
    // Hardcoded default configuration (e.g. personal private instance)
    if (DEFAULT_CONFIG.owner && DEFAULT_CONFIG.repo && DEFAULT_CONFIG.token) {
      return 'authenticated';
    }
    // Synchronous client-side check if already saved in localStorage
    if (typeof window !== 'undefined') {
      const config = getConfig();
      if (config) {
        return 'authenticated';
      }
    }
    // Unconfigured cold start or SSR
    return 'checking';
  });

  // Hydrate vault and service worker
  useEffect(() => {
    hydrate();

    // Register Service Worker for PWA installability & offline support
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, [hydrate]);

  // Authenticate and guard routes without flashing internal UI
  useEffect(() => {
    let active = true;

    async function verifyAuth() {
      if (isSetupRoute) {
        if (active) setAuthStatus('unauthenticated');
        return;
      }

      // Check synchronous config first
      let config = getConfig();

      // If not in localStorage/default, check if it can be restored from IndexedDB
      if (!config) {
        config = await restoreConfigFromIndexedDB();
      }

      if (!active) return;

      if (config) {
        setAuthStatus('authenticated');
      } else {
        setAuthStatus('unauthenticated');
        router.replace('/setup');
      }
    }

    verifyAuth();

    return () => {
      active = false;
    };
  }, [isSetupRoute, pathname, router]);

  // Mount sync triggers once authenticated (never re-triggered by route navigation)
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    const cleanup = setupSyncTriggers();
    return cleanup;
  }, [authStatus]);

  // Handle GitHub token revocation/expiry
  useEffect(() => {
    const unsub = onAuthError(() => {
      setAuthStatus('unauthenticated');
      router.replace('/setup?reauth=1');
    });
    return unsub;
  }, [router]);

  // If navigating a protected route while unauthenticated or checking, hold a clean loading splash
  if (!isSetupRoute && authStatus !== 'authenticated') {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center font-mono">
        <div className="w-11 h-11 rounded-2xl bg-zinc-950 text-white flex items-center justify-center shadow-subtle animate-pulse">
          <GitBranchIcon size={18} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-zinc-900 antialiased selection:bg-zinc-200 flex flex-col font-sans">
      {!isSetupRoute && <TabBar />}

      {/* Mobile Top Header (hidden on desktop where left rail is present) */}
      {!isSetupRoute && (
        <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 px-4 h-14 flex items-center justify-between pt-safe">
          <Link href="/" className="flex items-center gap-2 active:opacity-70 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
              <GitBranchIcon size={14} />
            </div>
            <span className="font-bold text-base tracking-tight text-zinc-900 font-mono">
              storr.
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <InstallPwaHeaderButton />
            <SyncDot status={syncStatus} showLabel />
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main
        className={clsx(
          'flex-1 pb-28 lg:pb-12 pt-safe',
          !isSetupRoute ? 'lg:pl-64' : 'flex flex-col items-center min-h-[92vh]'
        )}
      >
        <div
          className={clsx(
            'w-full px-4 sm:px-6 lg:px-8 py-5',
            !isSetupRoute ? 'max-w-4xl mx-auto' : 'max-w-5xl mx-auto'
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}
