'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useVault } from '@/store/useVault';
import { getConfig } from '@/lib/config';
import { setupSyncTriggers } from '@/lib/sync';
import { onAuthError } from '@/lib/github';
import { TabBar } from '@/components/TabBar';
import { ToastContainer } from '@/components/ToastContainer';
import { SyncDot } from '@/src/components/SyncDot';
import { GitBranchIcon } from '@/components/SvgIcons';
import { InstallPwaHeaderButton } from '@/components/InstallPwaPrompt';
import Link from 'next/link';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { syncStatus, hydrate, isHydrated } = useVault();
  const [mounted, setMounted] = useState(false);

  const isSetupRoute = pathname === '/setup';

  useEffect(() => {
    setMounted(true);
    hydrate();

    // Register Service Worker for PWA installability & offline support
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, [hydrate]);

  // Check auth redirect on route change
  useEffect(() => {
    if (!isHydrated) return;
    const config = getConfig();
    if (!config && pathname !== '/setup') {
      router.replace('/setup');
    }
  }, [isHydrated, pathname, router]);

  // Mount sync triggers once per app session (never re-triggered by route navigation)
  useEffect(() => {
    if (!isHydrated) return;
    const config = getConfig();
    if (config) {
      const cleanup = setupSyncTriggers();
      return cleanup;
    }
  }, [isHydrated]);

  useEffect(() => {
    const unsub = onAuthError(() => {
      router.replace('/setup?reauth=1');
    });
    return unsub;
  }, [router]);

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
      <main className="flex-1 lg:pl-64 pb-28 lg:pb-12 pt-safe">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
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

