'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InstallAppIcon, SmartphoneIcon } from '@/components/SvgIcons';
import { Download, Share2, PlusSquare, Check, X, ArrowUpRight } from 'lucide-react';
import clsx from 'clsx';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // 1. Check if running in standalone mode (already installed PWA)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // 2. Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isAppleDevice);

    // 3. Catch Chromium beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 4. Catch appinstalled event
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'manual-instructions'> => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsStandalone(true);
      }
      setDeferredPrompt(null);
      return choice.outcome;
    }
    return 'manual-instructions';
  };

  return {
    isMounted,
    isStandalone,
    canPromptNative: !!deferredPrompt,
    isIOS,
    promptInstall,
  };
}

export function InstallPwaHeaderButton() {
  const { isMounted, isStandalone, canPromptNative, promptInstall, isIOS } = usePwaInstall();
  const [showInstructions, setShowInstructions] = useState(false);

  if (!isMounted || isStandalone) {
    return null;
  }

  const handleClick = async () => {
    if (canPromptNative) {
      const res = await promptInstall();
      if (res === 'manual-instructions') {
        setShowInstructions(true);
      }
    } else {
      setShowInstructions(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 transition-colors text-xs font-mono font-medium shadow-xs"
        title="Install storr. as App"
      >
        <InstallAppIcon size={13} />
        <span>Install App</span>
      </button>

      <InstallInstructionsModal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
        isIOS={isIOS}
      />
    </>
  );
}

export function InstallInstructionsModal({
  isOpen,
  onClose,
  isIOS,
}: {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs"
        />

        {/* Sheet / Dialog */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-sm sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-zinc-200/90 shadow-floating p-5 z-10 pb-safe"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
                <SmartphoneIcon size={15} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-zinc-950 font-mono">
                  Install storr. on your phone
                </h3>
                <p className="text-[11px] font-mono text-zinc-400">
                  Full screen, offline-ready native PWA
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Platform Instructions */}
          {isIOS ? (
            <div className="space-y-3.5 text-xs font-mono">
              <p className="text-zinc-600 leading-relaxed">
                Safari on iPhone and iPad lets you install <span className="font-bold text-zinc-950">storr.</span> directly to your Home Screen in 3 quick taps:
              </p>

              <div className="space-y-2.5 bg-zinc-50 rounded-xl p-3.5 border border-zinc-200/80">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-zinc-950 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-900">Tap the Share button</span>
                    <p className="text-zinc-500 text-[11px] mt-0.5">
                      In Safari&apos;s bottom toolbar, tap the Share icon (<Share2 className="inline w-3 h-3 text-zinc-700" />).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-zinc-950 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-900">Select &quot;Add to Home Screen&quot;</span>
                    <p className="text-zinc-500 text-[11px] mt-0.5">
                      Scroll down in the share sheet and tap <span className="font-medium text-zinc-800">&quot;Add to Home Screen&quot;</span> (<PlusSquare className="inline w-3 h-3 text-zinc-700" />).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-zinc-950 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-900">Tap &quot;Add&quot;</span>
                    <p className="text-zinc-500 text-[11px] mt-0.5">
                      Tap <span className="font-medium text-zinc-800">&quot;Add&quot;</span> in the top right corner. <span className="font-bold text-zinc-950">storr.</span> is now installed!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5 text-xs font-mono">
              <p className="text-zinc-600 leading-relaxed">
                Install <span className="font-bold text-zinc-950">storr.</span> to your home screen in 3 quick steps:
              </p>

              <div className="space-y-2.5 bg-zinc-50 rounded-xl p-3.5 border border-zinc-200/80">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-zinc-950 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-900">Open browser menu</span>
                    <p className="text-zinc-500 text-[11px] mt-0.5">
                      Tap the <span className="font-medium text-zinc-800">three dots (⋮)</span> in Chrome or Edge&apos;s top-right corner.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-zinc-950 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-900">Select &quot;Install app&quot;</span>
                    <p className="text-zinc-500 text-[11px] mt-0.5">
                      Tap <span className="font-medium text-zinc-800">&quot;Install app&quot;</span> or <span className="font-medium text-zinc-800">&quot;Add to Home screen&quot;</span>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-zinc-950 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <span className="font-semibold text-zinc-900">Confirm &quot;Install&quot;</span>
                    <p className="text-zinc-500 text-[11px] mt-0.5">
                      Tap <span className="font-medium text-zinc-800">&quot;Install&quot;</span>. <span className="font-bold text-zinc-950">storr.</span> will appear in your apps and home screen!
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-zinc-400">
                Tip: If opened inside an in-app browser (like WhatsApp, Instagram, or Gmail), copy link and open directly in Chrome or Safari.
              </p>
            </div>
          )}

          {/* Action button */}
          <div className="mt-5">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-mono font-medium hover:bg-zinc-800 transition-colors min-h-[42px]"
            >
              Got it
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

