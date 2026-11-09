'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Branch, Version, Manifest } from '@/types';
import { formatVersionDate } from '@/lib/dates';
import { formatFileSize, createBlobFromBytes, downloadBlob, shareBlob } from '@/lib/files';
import { getCachedBlob } from '@/lib/cache';
import { getFile } from '@/lib/github';
import { showToast } from '@/components/ToastContainer';
import { useVault, selectOrderedBranches, selectVersionsByBranch, selectApplicationsByVersion } from '@/store/useVault';
import { CreateBranchModal, DeleteBranchModal } from '@/components/BranchModal';
import {
  GitBranchIcon,
  PaperResumeIcon,
  EyeIcon,
  DownloadIcon,
  ShareIcon,
} from '@/components/SvgIcons';
import { Plus, Trash2, MoreVertical, FileText, ExternalLink, ArrowRight, Briefcase } from 'lucide-react';
import clsx from 'clsx';

interface MultiBranchTreeGraphProps {
  onSelectVersion?: (version: Version) => void;
  className?: string;
}

export function MultiBranchTreeGraph({
  onSelectVersion,
  className = '',
}: MultiBranchTreeGraphProps) {
  const router = useRouter();
  const { manifest, activeBranchId, setActiveBranchId, softDeleteVersion } = useVault();

  const [isCreateBranchOpen, setIsCreateBranchOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [selectedResumeForSheet, setSelectedResumeForSheet] = useState<{
    version: Version;
    branch: Branch;
  } | null>(null);

  const branches = selectOrderedBranches(manifest);

  const handleSelectResume = (version: Version) => {
    if (onSelectVersion) {
      onSelectVersion(version);
    } else {
      router.push(`/view/${version.id}`);
    }
  };

  const handleMoveToTrash = async (e: React.MouseEvent, versionId: string, label: string) => {
    e.stopPropagation();
    await softDeleteVersion(versionId);
    showToast({
      type: 'info',
      message: `"${label}" moved to Trash`,
    });
    if (selectedResumeForSheet?.version.id === versionId) {
      setSelectedResumeForSheet(null);
    }
  };

  const handleDownload = async (e: React.MouseEvent, version: Version) => {
    e.stopPropagation();
    try {
      let bytes = await getCachedBlob(version.filePath);
      if (!bytes) bytes = await getFile(version.filePath);
      if (bytes) {
        const blob = createBlobFromBytes(bytes, version.mime);
        downloadBlob(blob, version.fileName);
        showToast({ type: 'success', message: 'Downloaded resume' });
      } else {
        showToast({ type: 'error', message: 'File not available in cache' });
      }
    } catch {
      showToast({ type: 'error', message: 'Could not download file' });
    }
  };

  const handleShare = async (e: React.MouseEvent, version: Version) => {
    e.stopPropagation();
    try {
      let bytes = await getCachedBlob(version.filePath);
      if (!bytes) bytes = await getFile(version.filePath);
      if (bytes) {
        const blob = createBlobFromBytes(bytes, version.mime);
        await shareBlob(blob, version.fileName, version.label);
        showToast({ type: 'success', message: 'Shared successfully' });
      } else {
        showToast({ type: 'error', message: 'File not available to share offline' });
      }
    } catch {
      showToast({ type: 'error', message: 'Could not share file' });
    }
  };

  return (
    <div className={clsx('relative space-y-4', className)}>
      {/* Top Controls: Branch count */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-zinc-900 text-white flex items-center justify-center">
            <GitBranchIcon size={13} />
          </div>
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900">
            Resume Tree ({branches.length} {branches.length === 1 ? 'branch' : 'branches'})
          </h2>
        </div>
      </div>

      {/* Panoramic Tree Viewport (Smooth horizontal kinetic touch scroll) */}
      <div className="overflow-x-auto pb-4 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth focus:outline-none">
        <div className="inline-flex items-start gap-4 sm:gap-6 min-w-full pb-2">
          {branches.map((branch, branchIndex) => {
            const versions = selectVersionsByBranch(manifest, branch.id);
            const isActive = branch.id === activeBranchId;
            const latestVersionId = versions[0]?.id || null;

            return (
              <div
                key={branch.id}
                className={clsx(
                  'w-[280px] sm:w-[310px] flex-shrink-0 bg-white rounded-2xl border p-4 sm:p-5 transition-all flex flex-col justify-between shadow-subtle',
                  isActive
                    ? 'border-zinc-900 ring-1 ring-zinc-900/10'
                    : 'border-zinc-200/90 hover:border-zinc-300'
                )}
              >
                {/* Branch Header */}
                <div>
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        style={{ backgroundColor: branch.color || '#18181B' }}
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveBranchId(branch.id)}
                            className="font-bold text-xs sm:text-sm text-zinc-950 truncate hover:underline text-left"
                          >
                            {branch.name}
                          </button>
                          {isActive && (
                            <span className="text-[9px] font-mono font-bold bg-zinc-950 text-white px-1.5 py-0.2 rounded">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-zinc-400">
                          {versions.length} {versions.length === 1 ? 'version' : 'versions'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Link
                        href={`/add?branch=${branch.id}`}
                        title="Add resume to this branch"
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                      >
                        <Plus size={15} />
                      </Link>
                      {branches.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setBranchToDelete(branch)}
                          title="Delete branch"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Branch Stem & Resume Nodes */}
                  <div className="relative pl-5 py-1">
                    {/* Vertical Trunk Line */}
                    <div
                      style={{ backgroundColor: branch.color || '#18181B' }}
                      className="absolute left-[7px] top-3 bottom-3 w-0.5 rounded-full opacity-30"
                    />

                    {versions.length === 0 ? (
                      /* Empty State for branch */
                      <div className="relative pt-2 pb-2">
                        <div
                          style={{ borderColor: branch.color || '#18181B' }}
                          className="absolute -left-5 top-4 w-3.5 h-3.5 rounded-full border-2 bg-white"
                        />
                        <Link
                          href={`/add?branch=${branch.id}`}
                          className="block p-4 rounded-xl border border-dashed border-zinc-200 hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50 text-center transition-all group"
                        >
                          <p className="text-xs font-semibold text-zinc-700 group-hover:text-zinc-950">
                            No resumes committed
                          </p>
                          <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                            + Add first resume
                          </p>
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {versions.map((version, vIndex) => {
                          const isHead = version.id === latestVersionId;
                          const isPdf =
                            version.mime === 'application/pdf' ||
                            version.fileName.endsWith('.pdf');
                          const versionApps = selectApplicationsByVersion(manifest, version.id);
                          const latestApp = versionApps[0] || null;

                          return (
                            <motion.div
                              key={version.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: vIndex * 0.03 }}
                              className="relative group"
                            >
                              {/* Commit Node on Stem */}
                              <div
                                style={{
                                  borderColor: branch.color || '#18181B',
                                  backgroundColor: isHead ? branch.color || '#18181B' : '#FFFFFF',
                                }}
                                className={clsx(
                                  'absolute -left-5 top-3.5 w-3.5 h-3.5 rounded-full border-2 transition-transform group-hover:scale-125 z-10 flex items-center justify-center',
                                  isHead ? 'shadow-xs' : 'bg-white'
                                )}
                              >
                                {isHead && <div className="w-1 h-1 rounded-full bg-white" />}
                              </div>

                              {/* Resume Card Node */}
                              <div
                                onClick={() => setSelectedResumeForSheet({ version, branch })}
                                className={clsx(
                                  'cursor-pointer p-3 rounded-xl border transition-all text-left group-hover:border-zinc-400 group-hover:shadow-subtle relative bg-white',
                                  isHead
                                    ? 'border-zinc-300 shadow-xs'
                                    : 'border-zinc-200'
                                )}
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span
                                        className={clsx(
                                          'text-[9px] font-mono font-bold px-1.5 py-0.2 rounded',
                                          isPdf
                                            ? 'bg-zinc-100 text-zinc-700'
                                            : 'bg-blue-50 text-blue-700'
                                        )}
                                      >
                                        {isPdf ? 'PDF' : 'DOCX'}
                                      </span>
                                      {isHead && (
                                        <span className="text-[9px] font-mono font-bold bg-zinc-950 text-white px-1.5 py-0.2 rounded">
                                          HEAD
                                        </span>
                                      )}
                                    </div>
                                    <h4 className="font-semibold text-xs text-zinc-900 truncate group-hover:text-zinc-700">
                                      {version.label}
                                    </h4>
                                    <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
                                      {formatVersionDate(version.versionDate)} • {formatFileSize(version.sizeBytes)}
                                    </p>

                                    {/* Latest Application Anchor */}
                                    {latestApp && (
                                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-50 border border-zinc-200/90 text-[10px] font-mono text-zinc-800 shadow-2xs">
                                          <Briefcase size={10} className="text-zinc-500 shrink-0" />
                                          <span className="font-bold text-zinc-950 truncate max-w-[110px] sm:max-w-[130px]">
                                            {latestApp.company}
                                          </span>
                                          <span className="text-zinc-300">•</span>
                                          <span
                                            className={clsx(
                                              'text-[9px] font-semibold capitalize',
                                              latestApp.status === 'interviewing' && 'text-blue-700',
                                              latestApp.status === 'offer' && 'text-emerald-700 font-bold',
                                              latestApp.status === 'applied' && 'text-zinc-600',
                                              latestApp.status === 'rejected' && 'text-rose-600',
                                              latestApp.status === 'ghosted' && 'text-amber-600'
                                            )}
                                          >
                                            {latestApp.status}
                                          </span>
                                        </span>
                                        {versionApps.length > 1 && (
                                          <span
                                            className="text-[9px] font-mono font-medium text-zinc-400 bg-zinc-100 px-1 py-0.2 rounded border border-zinc-200/60"
                                            title={`${versionApps.length} total applications sent with this version`}
                                          >
                                            +{versionApps.length - 1}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedResumeForSheet({ version, branch });
                                    }}
                                    className="p-1 text-zinc-400 hover:text-zinc-700 rounded-md hover:bg-zinc-100 transition-colors"
                                  >
                                    <MoreVertical size={13} />
                                  </button>
                                </div>

                                {version.note && (
                                  <p className="text-[10px] text-zinc-500 font-mono line-clamp-1 mt-1.5 pt-1 border-t border-zinc-100">
                                    {version.note}
                                  </p>
                                )}

                                {/* Hover / Touch Quick Action Bar */}
                                <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectResume(version);
                                    }}
                                    className="text-zinc-900 font-semibold hover:underline flex items-center gap-1"
                                  >
                                    <EyeIcon size={12} />
                                    <span>View</span>
                                  </button>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => handleDownload(e, version)}
                                      title="Download"
                                      className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100"
                                    >
                                      <DownloadIcon size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleShare(e, version)}
                                      title="Share"
                                      className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100"
                                    >
                                      <ShareIcon size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleMoveToTrash(e, version.id, version.label)}
                                      title="Delete"
                                      className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Footer: Branch Switcher Shortcut */}
                <div className="pt-4 mt-3 border-t border-zinc-100 flex items-center justify-between">
                  <Link
                    href={`/branch/${branch.id}`}
                    className="text-[11px] font-mono text-zinc-500 hover:text-zinc-950 flex items-center gap-1"
                  >
                    <span>Branch details</span>
                    <ArrowRight size={11} />
                  </Link>

                  <Link
                    href={`/add?branch=${branch.id}`}
                    className="text-[11px] font-mono font-medium text-zinc-900 hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} />
                    <span>Add resume</span>
                  </Link>
                </div>
              </div>
            );
          })}

          {/* "+ New Branch" Lane */}
          <div className="w-[200px] flex-shrink-0 flex items-center justify-center p-4">
            <button
              type="button"
              onClick={() => setIsCreateBranchOpen(true)}
              className="w-full h-48 rounded-2xl border-2 border-dashed border-zinc-200 hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50 p-6 flex flex-col items-center justify-center text-center gap-2 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 group-hover:scale-110 group-hover:text-zinc-950 transition-all shadow-xs">
                <Plus size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-800 group-hover:text-zinc-950">
                  New Branch
                </p>
                <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
                  e.g. consulting, exec
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Bottom Sheet for mobile and desktop preview */}
      <AnimatePresence>
        {selectedResumeForSheet && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedResumeForSheet(null)}
              className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-zinc-200 shadow-floating p-6 z-10 space-y-4"
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    style={{ backgroundColor: selectedResumeForSheet.branch.color || '#18181B' }}
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-zinc-950 truncate">
                      {selectedResumeForSheet.version.label}
                    </h3>
                    <p className="text-xs font-mono text-zinc-400">
                      Branch: /{selectedResumeForSheet.branch.name} • {formatVersionDate(selectedResumeForSheet.version.versionDate)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedResumeForSheet(null)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg"
                >
                  <Plus size={18} className="rotate-45" />
                </button>
              </div>

              {selectedResumeForSheet.version.note && (
                <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-mono text-zinc-600">
                  <span className="font-semibold text-zinc-800">Note: </span>
                  {selectedResumeForSheet.version.note}
                </div>
              )}

              {/* Action Buttons in Drawer */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleSelectResume(selectedResumeForSheet.version);
                    setSelectedResumeForSheet(null);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <EyeIcon size={14} />
                  <span>View Document</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    handleDownload(e, selectedResumeForSheet.version);
                  }}
                  className="py-2.5 px-4 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-xs font-medium hover:bg-zinc-50 flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <DownloadIcon size={14} />
                  <span>Download</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    handleShare(e, selectedResumeForSheet.version);
                  }}
                  className="py-2.5 px-4 rounded-xl border border-zinc-200 bg-white text-zinc-900 text-xs font-medium hover:bg-zinc-50 flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <ShareIcon size={14} />
                  <span>Share</span>
                </button>

                <button
                  type="button"
                  onClick={(e) =>
                    handleMoveToTrash(
                      e,
                      selectedResumeForSheet.version.id,
                      selectedResumeForSheet.version.label
                    )
                  }
                  className="py-2.5 px-4 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Trash2 size={14} />
                  <span>Move to Trash</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modals for Create & Delete Branch */}
      <CreateBranchModal
        isOpen={isCreateBranchOpen}
        onClose={() => setIsCreateBranchOpen(false)}
      />

      <DeleteBranchModal
        isOpen={Boolean(branchToDelete)}
        branch={branchToDelete}
        onClose={() => setBranchToDelete(null)}
      />
    </div>
  );
}

