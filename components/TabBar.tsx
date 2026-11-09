'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  GitBranchIcon,
  PaperResumeIcon,
  ClockHistoryIcon,
} from '@/components/SvgIcons';
import { Home, Plus, Settings, Briefcase } from 'lucide-react';
import { useVault } from '@/store/useVault';
import clsx from 'clsx';

export function TabBar() {
  const pathname = usePathname();
  const { manifest } = useVault();
  const appCount = manifest?.applications?.length || 0;

  const navItems = [
    {
      href: '/',
      label: 'Home',
      icon: Home,
    },
    {
      href: '/applications',
      label: 'Tracker',
      icon: Briefcase,
      badge: appCount > 0 ? appCount : undefined,
    },
    {
      href: '/add',
      label: 'Add Resume',
      icon: Plus,
      isAction: true,
    },
    {
      href: '/settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Mobile Floating Bottom Dock */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-3 left-4 right-4 z-40 lg:hidden pb-safe"
      >
        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-zinc-200/90 shadow-floating flex items-center justify-around h-16 max-w-sm mx-auto px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            if (item.isAction) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center -mt-6 min-w-[52px] min-h-[52px]"
                  aria-label="Add resume version"
                >
                  <motion.div
                    whileTap={{ scale: 0.92 }}
                    className="w-12 h-12 rounded-xl bg-zinc-950 text-white flex items-center justify-center shadow-md border border-zinc-800"
                  >
                    <Icon size={22} strokeWidth={2.5} />
                  </motion.div>
                  <span className="text-[10px] font-mono font-medium text-zinc-500 mt-1">
                    {item.label}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'relative flex flex-col items-center justify-center min-w-[48px] min-h-[44px] py-1 transition-colors',
                  isActive ? 'text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-700'
                )}
              >
                <div className="relative">
                  <Icon size={19} />
                  {item.badge !== undefined && (
                    <span className="absolute -top-1 -right-2.5 min-w-[14px] h-[14px] px-1 rounded-full bg-zinc-950 text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-xs">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] leading-tight font-mono mt-0.5">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-zinc-950"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Left Rail Navigation (≥1024px) */}
      <aside
        aria-label="Desktop Navigation"
        className="hidden lg:flex fixed top-0 bottom-0 left-0 w-64 bg-white border-r border-zinc-200 flex-col justify-between p-6 z-40"
      >
        <div className="space-y-6">
          {/* Logo / App Name */}
          <Link href="/" className="flex items-center gap-2.5 px-2 group">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-mono font-bold text-sm shadow-subtle group-hover:bg-zinc-800 transition-colors">
              <GitBranchIcon size={16} />
            </div>
            <div>
              <h1 className="font-bold text-base font-mono text-zinc-900 tracking-tight leading-none">
                storr.
              </h1>
              <span className="text-[10px] font-mono text-zinc-400">career version hub</span>
            </div>
          </Link>

          {/* Quick Commit Action */}
          <div className="pt-1">
            <Link
              href="/add"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-950 text-white font-medium text-xs shadow-xs hover:bg-zinc-800 active:scale-98 transition-all min-h-[42px]"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Add Resume</span>
            </Link>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1 pt-3">
            <Link
              href="/"
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono font-medium transition-colors min-h-[38px]',
                pathname === '/'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50'
              )}
            >
              <Home size={16} />
              <span>All Resumes</span>
            </Link>

            <Link
              href="/applications"
              className={clsx(
                'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono font-medium transition-colors min-h-[38px]',
                pathname === '/applications'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50'
              )}
            >
              <div className="flex items-center gap-2.5">
                <Briefcase size={16} />
                <span>Job Tracker</span>
              </div>
              {appCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-zinc-200 text-zinc-700 text-[10px] font-semibold">
                  {appCount}
                </span>
              )}
            </Link>

            <Link
              href="/trash"
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono font-medium transition-colors min-h-[38px]',
                pathname === '/trash'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50'
              )}
            >
              <ClockHistoryIcon size={16} />
              <span>Archive / Trash</span>
            </Link>

            <Link
              href="/settings"
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-mono font-medium transition-colors min-h-[38px]',
                pathname === '/settings'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50'
              )}
            >
              <Settings size={16} />
              <span>Settings & Sync</span>
            </Link>
          </nav>
        </div>

        <div className="border-t border-zinc-100 pt-4 px-2 text-[11px] font-mono text-zinc-400">
          <p>stor. v2.0</p>
          <p className="text-[10px] text-zinc-400">Vercel & Next.js Edition</p>
        </div>
      </aside>
    </>
  );
}

