'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  useVault,
  selectTrashVersions,
  selectOrderedBranches,
} from '@/store/useVault';
import { Version } from '@/types';
import { BranchBadge } from '@/components/BranchBadge';
import { AnimatedBottomSheet } from '@/components/AnimatedBottomSheet';
import {
  ClockHistoryIcon,
  GitBranchIcon,
  PaperResumeIcon,
} from '@/components/SvgIcons';
import { showToast } from '@/components/ToastContainer';
import { formatVersionDate } from '@/lib/dates';
import {
  ArrowLeft,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export default function TrashPage() {
  const router = useRouter();
  const { manifest, restoreVersion, purgeVersion, emptyAllTrash } = useVault();

  const trashVersions = useMemo(
    () => selectTrashVersions(manifest),
    [manifest]
  );
  const allBranches = useMemo(
    () => selectOrderedBranches(manifest, true),
    [manifest]
  );
  const branchMap = useMemo(
    () => new Map(allBranches.map((b) => [b.id, b])),
    [allBranches]
  );

  const [versionToPurge, setVersionToPurge] = useState<Version | null>(null);
  const [isEmptyingAll, setIsEmptyingAll] = useState(false);

  const calculateDaysRemaining = (deletedAt: string | null) => {
    if (!deletedAt) return 30;
    const deletedTime = new Date(deletedAt).getTime();
    const elapsedDays = Math.floor(
      (Date.now() - deletedTime) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, 30 - elapsedDays);
  };

  const handleRestore = async (version: Version) => {
    await restoreVersion(version.id);
    showToast({ type: 'success', message: `Restored "${version.label}"` });
  };

  const handleConfirmPurge = async () => {
    if (versionToPurge) {
      await purgeVersion(versionToPurge.id);
      showToast({ type: 'info', message: 'Permanently deleted' });
      setVersionToPurge(null);
    }
  };

  const handleConfirmEmptyAll = async () => {
    await emptyAllTrash();
    showToast({ type: 'info', message: 'Trash emptied' });
    setIsEmptyingAll(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl border border-zinc-200 flex items-center justify-center text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="font-mono font-bold text-lg text-zinc-950">
              Archive & Trash
            </h1>
            <p className="text-[11px] font-mono text-zinc-400">
              Archived commits are purged automatically after 30 days
            </p>
          </div>
        </div>

        {trashVersions.length > 0 && (
          <button
            type="button"
            onClick={() => setIsEmptyingAll(true)}
            className="px-3 py-1.5 rounded-xl border border-zinc-200 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-50 transition-all text-xs font-mono font-medium flex items-center gap-1.5"
          >
            <Trash2 size={13} />
            <span>Empty All</span>
          </button>
        )}
      </div>

      {trashVersions.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-zinc-200 space-y-3">
          <div className="w-10 h-10 mx-auto rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600">
            <ClockHistoryIcon size={20} />
          </div>
          <h2 className="text-sm font-bold text-zinc-900">
            Trash is empty
          </h2>
          <p className="text-xs font-mono text-zinc-500 max-w-sm mx-auto">
            Deleted resume versions will appear here for 30 days before being permanently purged from your GitHub repository.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-mono font-medium hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft size={12} />
            <span>Back to Branches</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {trashVersions.map((version) => {
            const branch = branchMap.get(version.trackId);
            const daysLeft = calculateDaysRemaining(version.deletedAt);

            return (
              <div
                key={version.id}
                className="p-4 rounded-xl bg-white border border-zinc-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    {branch && <BranchBadge branch={branch} size="sm" />}
                    <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                      <Clock size={11} />
                      <span>{daysLeft} days remaining</span>
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-zinc-950 truncate">
                    {version.label}
                  </h3>
                  <p className="text-[11px] font-mono text-zinc-400">
                    {formatVersionDate(version.versionDate)} • {version.fileName}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
                  <button
                    type="button"
                    onClick={() => handleRestore(version)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900 text-xs font-mono font-medium transition-colors"
                  >
                    <RotateCcw size={13} className="text-emerald-600" />
                    <span>Restore</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVersionToPurge(version)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-zinc-950 text-xs font-mono font-medium transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>Purge</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Purge Single Confirmation Sheet */}
      <AnimatedBottomSheet
        isOpen={Boolean(versionToPurge)}
        onClose={() => setVersionToPurge(null)}
        title="Permanently Delete Version?"
      >
        <div className="space-y-4 pt-1 text-xs font-mono">
          <p className="text-zinc-600 leading-relaxed">
            This will permanently erase &quot;{versionToPurge?.label}&quot; and remove the file from your GitHub repository. This action cannot be undone.
          </p>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setVersionToPurge(null)}
              className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 text-xs font-mono font-medium hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmPurge}
              className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-950 text-white text-xs font-mono font-medium hover:bg-zinc-800"
            >
              Yes, Purge Forever
            </button>
          </div>
        </div>
      </AnimatedBottomSheet>

      {/* Empty All Trash Confirmation Sheet */}
      <AnimatedBottomSheet
        isOpen={isEmptyingAll}
        onClose={() => setIsEmptyingAll(false)}
        title="Empty All Trash?"
      >
        <div className="space-y-4 pt-1 text-xs font-mono">
          <p className="text-zinc-600 leading-relaxed">
            Are you sure you want to permanently delete all {trashVersions.length} versions in Trash? All associated files will be removed from your repository.
          </p>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEmptyingAll(false)}
              className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 text-xs font-mono font-medium hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmEmptyAll}
              className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-950 text-white text-xs font-mono font-medium hover:bg-zinc-800"
            >
              Yes, Empty Trash
            </button>
          </div>
        </div>
      </AnimatedBottomSheet>
    </div>
  );
}

