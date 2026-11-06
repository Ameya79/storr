'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  useVault,
  selectOrderedBranches,
  selectVersionsByBranch,
} from '@/store/useVault';
import { groupByMonth } from '@/lib/dates';
import { BranchBadge } from '@/components/BranchBadge';
import { BranchTreeVisualizer } from '@/components/BranchTreeVisualizer';
import { AnimatedBottomSheet } from '@/components/AnimatedBottomSheet';
import {
  GitBranchIcon,
  GitCommitIcon,
  ClockHistoryIcon,
  PaperResumeIcon,
} from '@/components/SvgIcons';
import { showToast } from '@/components/ToastContainer';
import {
  ArrowLeft,
  Settings2,
  Plus,
  Archive,
  ArchiveRestore,
  ExternalLink,
  Tag,
  Trash2,
} from 'lucide-react';
import { DeleteBranchModal } from '@/components/BranchModal';

export default function BranchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { manifest, updateBranch, archiveBranch } = useVault();

  const allBranches = useMemo(
    () => selectOrderedBranches(manifest, true),
    [manifest]
  );
  const branch = allBranches.find((b) => b.id === id);

  const versions = useMemo(
    () => (branch ? selectVersionsByBranch(manifest, branch.id) : []),
    [manifest, branch]
  );
  const monthGroups = useMemo(() => groupByMonth(versions), [versions]);

  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editName, setEditName] = useState(branch?.name || '');
  const [editColor, setEditColor] = useState(branch?.color || '#18181B');

  if (!branch) {
    return (
      <div className="pt-12 text-center max-w-sm mx-auto space-y-3">
        <p className="text-xs font-mono text-zinc-500">
          Branch &quot;{id}&quot; does not exist.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-zinc-950 underline"
        >
          <ArrowLeft size={12} />
          <span>Back to Branches Overview</span>
        </Link>
      </div>
    );
  }

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    await updateBranch(branch.id, {
      name: editName.trim(),
      color: editColor,
    });
    showToast({ type: 'success', message: `Branch "${editName}" updated` });
    setIsEditOpen(false);
  };

  const handleToggleArchive = async () => {
    await archiveBranch(branch.id, !branch.archived);
    showToast({
      type: 'info',
      message: branch.archived ? 'Branch restored' : 'Branch archived',
    });
    setIsOptionsOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Branch Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-xl border border-zinc-200 flex items-center justify-center text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 transition-colors"
            aria-label="Back to overview"
          >
            <ArrowLeft size={16} />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: branch.color }}
              />
              <h1 className="font-mono font-bold text-lg text-zinc-950 tracking-tight">
                {branch.name}
              </h1>
              {branch.archived && (
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">
                  archived
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
              branch /{branch.id} • {versions.length} commits total
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/add?branch=${branch.id}`}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 text-white text-xs font-mono font-medium hover:bg-zinc-800 transition-colors"
          >
            <Plus size={14} />
            <span>Commit Version</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsOptionsOpen(true)}
            className="w-9 h-9 rounded-xl border border-zinc-200 flex items-center justify-center text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 transition-colors"
            aria-label="Branch settings"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {/* Commit Tree Timeline */}
      {versions.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-2xl border border-zinc-200 space-y-3">
          <div className="w-10 h-10 mx-auto rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700">
            <GitBranchIcon size={20} />
          </div>
          <h2 className="text-sm font-bold text-zinc-900">
            No commits on branch &quot;{branch.name}&quot;
          </h2>
          <p className="text-xs font-mono text-zinc-500 max-w-sm mx-auto">
            Upload and commit your first tailored resume for this branch to initiate its history.
          </p>
          <Link
            href={`/add?branch=${branch.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-mono font-medium hover:bg-zinc-800 transition-colors"
          >
            <Plus size={14} />
            <span>Commit First Resume</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-subtle p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100">
              <span className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider">
                Full Visual Branch Timeline
              </span>
              <span className="text-xs font-mono text-zinc-400">
                Latest at top
              </span>
            </div>
            <BranchTreeVisualizer branch={branch} versions={versions} />
          </div>

          {/* Monthly Group Breakdown */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider px-1">
              Monthly Commits
            </h3>
            {monthGroups.map((group) => (
              <div
                key={group.monthKey}
                className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                  <span className="text-xs font-mono font-bold text-zinc-900">
                    {group.header}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {group.versions.length} {group.versions.length === 1 ? 'commit' : 'commits'}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.versions.map((ver) => (
                    <Link
                      key={ver.id}
                      href={`/view/${ver.id}`}
                      className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-zinc-50 border border-transparent hover:border-zinc-200 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700 flex-shrink-0">
                          <PaperResumeIcon size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-900 truncate group-hover:text-zinc-700">
                            {ver.label}
                          </p>
                          <p className="text-[11px] font-mono text-zinc-400 truncate">
                            {ver.id.substring(0, 7)} • {new Date(ver.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-200 text-zinc-600 bg-white">
                          {ver.fileName.endsWith('.pdf') ? 'PDF' : 'DOCX'}
                        </span>
                        <ExternalLink size={13} className="text-zinc-400 group-hover:text-zinc-900" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Options Bottom Sheet */}
      <AnimatedBottomSheet
        isOpen={isOptionsOpen}
        onClose={() => setIsOptionsOpen(false)}
        title={`Branch: ${branch.name}`}
      >
        <div className="divide-y divide-zinc-100 text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              setIsOptionsOpen(false);
              setEditName(branch.name);
              setEditColor(branch.color);
              setIsEditOpen(true);
            }}
            className="w-full py-3 px-2 flex items-center gap-3 text-zinc-800 hover:text-zinc-950 hover:bg-zinc-50 rounded-lg transition-colors"
          >
            <Settings2 size={16} className="text-zinc-500" />
            <span className="font-medium">Rename Branch or Change Color</span>
          </button>

          <button
            type="button"
            onClick={handleToggleArchive}
            className="w-full py-3 px-2 flex items-center gap-3 text-zinc-800 hover:text-zinc-950 hover:bg-zinc-50 rounded-lg transition-colors"
          >
            {branch.archived ? (
              <>
                <ArchiveRestore size={16} className="text-emerald-600" />
                <span className="font-medium">Restore Branch from Archive</span>
              </>
            ) : (
              <>
                <Archive size={16} className="text-zinc-500" />
                <span className="font-medium">Archive Branch</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOptionsOpen(false);
              setIsDeleteOpen(true);
            }}
            className="w-full py-3 px-2 flex items-center gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
            <span className="font-medium">Delete Branch</span>
          </button>
        </div>
      </AnimatedBottomSheet>

      {/* Delete Branch Modal */}
      <DeleteBranchModal
        isOpen={isDeleteOpen}
        branch={branch}
        onClose={() => setIsDeleteOpen(false)}
        onDeleted={() => router.push('/')}
      />

      {/* Edit Branch Bottom Sheet */}
      <AnimatedBottomSheet
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Branch"
      >
        <form onSubmit={handleSaveBranch} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-mono font-medium text-zinc-600 mb-1.5">
              Branch Name (e.g. main, product-lead, exec)
            </label>
            <input
              type="text"
              required
              maxLength={36}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-zinc-600 mb-1.5">
              Accent Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="w-8 h-8 rounded border border-zinc-200 cursor-pointer p-0.5 bg-white"
              />
              <span className="text-xs font-mono text-zinc-500">{editColor}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 text-xs font-mono font-medium hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-950 text-white text-xs font-mono font-medium hover:bg-zinc-800"
            >
              Save Changes
            </button>
          </div>
        </form>
      </AnimatedBottomSheet>
    </div>
  );
}
