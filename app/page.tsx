'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useVault,
  selectOrderedBranches,
  selectVersionsByBranch,
  selectLatestByBranch,
  selectSearchResults,
} from '@/store/useVault';
import { BranchSwitcher } from '@/components/BranchSwitcher';
import { HeroVersionCard } from '@/components/HeroVersionCard';
import { BranchTreeVisualizer } from '@/components/BranchTreeVisualizer';
import { MultiBranchTreeGraph } from '@/components/MultiBranchTreeGraph';
import { CreateBranchModal } from '@/components/BranchModal';
import { BranchBadge } from '@/components/BranchBadge';
import { ProfileLinksBar } from '@/components/ProfileLinksBar';
import {
  GitBranchIcon,
  PaperResumeIcon,
  ClockHistoryIcon,
} from '@/components/SvgIcons';
import { Search, Plus, ArrowRight, X, LayoutGrid } from 'lucide-react';
import clsx from 'clsx';

export default function HomePage() {
  const { manifest, isHydrated, activeBranchId, setActiveBranchId } = useVault();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'focus'>('tree');
  const [isCreateBranchOpen, setIsCreateBranchOpen] = useState(false);

  // Restore view mode preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rv.viewMode');
      if (saved === 'tree' || saved === 'focus') {
        setViewMode(saved);
      }
    } catch {}
  }, []);

  const handleToggleView = (mode: 'tree' | 'focus') => {
    setViewMode(mode);
    try {
      localStorage.setItem('rv.viewMode', mode);
    } catch {}
  };

  const branches = useMemo(() => selectOrderedBranches(manifest), [manifest]);

  // Set active branch to first branch if none selected or invalid
  const currentBranch = useMemo(() => {
    if (branches.length === 0) return null;
    const found = branches.find((b) => b.id === activeBranchId);
    return found || branches[0];
  }, [branches, activeBranchId]);

  const activeBranchVersions = useMemo(() => {
    if (!currentBranch) return [];
    return selectVersionsByBranch(manifest, currentBranch.id);
  }, [manifest, currentBranch]);

  const activeHeadVersion = useMemo(() => {
    if (!currentBranch) return null;
    return selectLatestByBranch(manifest, currentBranch.id);
  }, [manifest, currentBranch]);

  const totalResumes = useMemo(() => {
    if (!manifest) return 0;
    return manifest.versions.filter((v) => !v.deletedAt).length;
  }, [manifest]);

  const searchResults = useMemo(
    () => selectSearchResults(manifest, searchQuery),
    [manifest, searchQuery]
  );

  if (!isHydrated) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-zinc-100 rounded-xl w-full" />
        <div className="h-64 bg-zinc-50 border border-zinc-200/60 rounded-2xl w-full" />
        <div className="h-44 bg-zinc-50 border border-zinc-200/60 rounded-2xl w-full" />
      </div>
    );
  }

  // Vault has no branches (e.g. freshly cleared)
  if (branches.length === 0) {
    return (
      <div className="pt-12 text-center max-w-sm mx-auto space-y-4">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900">
          <GitBranchIcon size={24} />
        </div>
        <h2 className="text-base font-bold text-zinc-900 tracking-tight">
          No branches configured
        </h2>
        <p className="text-xs text-zinc-500 leading-relaxed font-mono">
          Create a branch (e.g. main, product, engineering) to start saving and managing your resumes.
        </p>
        <button
          type="button"
          onClick={() => setIsCreateBranchOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors shadow-xs"
        >
          <Plus size={14} />
          <span>Create Branch</span>
        </button>
        <CreateBranchModal
          isOpen={isCreateBranchOpen}
          onClose={() => setIsCreateBranchOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Permanent Career Profile Links */}
      <ProfileLinksBar />

      {/* Top Header: Search bar + View Switcher + New Branch button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search resumes, tags, roles, notes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs sm:text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 shadow-xs min-h-[44px]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:text-zinc-700 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-shrink-0">
          <div className="flex items-center p-1 bg-zinc-100 rounded-xl border border-zinc-200/80">
            <button
              type="button"
              onClick={() => handleToggleView('tree')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 min-h-[36px]',
                viewMode === 'tree'
                  ? 'bg-white text-zinc-950 shadow-xs font-semibold'
                  : 'text-zinc-500 hover:text-zinc-900'
              )}
            >
              <GitBranchIcon size={13} />
              <span>Tree View</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleView('focus')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 min-h-[36px]',
                viewMode === 'focus'
                  ? 'bg-white text-zinc-950 shadow-xs font-semibold'
                  : 'text-zinc-500 hover:text-zinc-900'
              )}
            >
              <PaperResumeIcon size={13} />
              <span>Focused View</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateBranchOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-950 text-white text-xs font-medium hover:bg-zinc-800 transition-colors shadow-xs min-h-[42px]"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New Branch</span>
            <span className="sm:hidden">Branch</span>
          </button>
        </div>
      </div>

      {/* Search Results Mode */}
      {searchQuery.trim() ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
            <h2 className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider">
              Search Results ({searchResults.length})
            </h2>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-mono text-zinc-900 hover:underline"
            >
              Clear
            </button>
          </div>

          {searchResults.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-zinc-200 space-y-2">
              <p className="text-xs font-mono text-zinc-500">
                No resumes found matching &quot;{searchQuery}&quot;
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {searchResults.map(({ version, track }) => (
                <Link
                  key={version.id}
                  href={`/view/${version.id}`}
                  className="group block p-4 bg-white rounded-xl border border-zinc-200 hover:border-zinc-400 shadow-xs hover:shadow-subtle transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <BranchBadge branch={track} size="sm" />
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">
                      {version.fileName.endsWith('.pdf') ? 'PDF' : 'DOCX'}
                    </span>
                  </div>
                  <h3 className="font-semibold text-xs text-zinc-900 truncate group-hover:text-zinc-700">
                    {version.label}
                  </h3>
                  {version.note && (
                    <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1 font-mono">
                      {version.note}
                    </p>
                  )}
                  <div className="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>{new Date(version.createdAt).toLocaleDateString()}</span>
                    <span className="text-zinc-900 group-hover:underline flex items-center gap-0.5">
                      Open <ArrowRight size={10} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === 'tree' ? (
        /* Multi-Branch Visual Tree View */
        <div className="space-y-4">
          <MultiBranchTreeGraph />
        </div>
      ) : (
        /* Focused Single Branch View */
        <div className="space-y-6">
          {/* Branch Switcher & Quick Meta */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BranchSwitcher />
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
              <span>{branches.length} branches</span>
              <span>•</span>
              <span>{totalResumes} {totalResumes === 1 ? 'resume' : 'resumes'}</span>
            </div>
          </div>

          {/* Active Branch HEAD Hero */}
          {currentBranch && (
            <section aria-label="Branch HEAD Version">
              <HeroVersionCard
                branch={currentBranch}
                version={activeHeadVersion}
                totalCommits={activeBranchVersions.length}
              />
            </section>
          )}

          {/* Visual Commit Graph */}
          {currentBranch && (
            <section aria-label="Branch Timeline" className="pt-2">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <ClockHistoryIcon size={16} />
                  <h3 className="text-xs font-mono font-bold text-zinc-900 uppercase tracking-wider">
                    Branch History ({activeBranchVersions.length})
                  </h3>
                </div>

                <Link
                  href={`/branch/${currentBranch.id}`}
                  className="text-xs font-mono text-zinc-500 hover:text-zinc-950 flex items-center gap-1 transition-colors"
                >
                  <span>Branch Settings</span>
                  <ArrowRight size={12} />
                </Link>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-subtle p-5">
                <BranchTreeVisualizer
                  branch={currentBranch}
                  versions={activeBranchVersions}
                />
              </div>
            </section>
          )}

          {/* All Other Branches Quick Grid */}
          {branches.length > 1 && (
            <section aria-label="All Branches" className="pt-4 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider">
                  Other Branches
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreateBranchOpen(true)}
                  className="text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors flex items-center gap-1"
                >
                  <Plus size={12} />
                  <span>New Branch</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {branches
                  .filter((b) => b.id !== currentBranch?.id)
                  .map((branch) => {
                    const branchCommits = selectVersionsByBranch(manifest, branch.id);
                    const head = selectLatestByBranch(manifest, branch.id);

                    return (
                      <div
                        key={branch.id}
                        onClick={() => setActiveBranchId(branch.id)}
                        className="group cursor-pointer p-4 rounded-xl bg-white border border-zinc-200 hover:border-zinc-400 shadow-xs hover:shadow-subtle transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <BranchBadge branch={branch} size="sm" />
                            <span className="text-[10px] font-mono text-zinc-400">
                              {branchCommits.length} {branchCommits.length === 1 ? 'resume' : 'resumes'}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-zinc-900 truncate">
                            {head ? head.label : 'No resumes yet'}
                          </p>
                          {head?.note && (
                            <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-mono">
                              {head.note}
                            </p>
                          )}
                        </div>

                        <div className="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-mono text-zinc-400 group-hover:text-zinc-900">
                          <span>Switch to branch</span>
                          <ArrowRight size={12} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create Branch Modal */}
      <CreateBranchModal
        isOpen={isCreateBranchOpen}
        onClose={() => setIsCreateBranchOpen(false)}
      />
    </div>
  );
}
