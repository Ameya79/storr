'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Version, Branch } from '@/types';
import { formatVersionDate } from '@/lib/dates';
import { useBlobUrl } from '@/lib/useBlobUrl';
import { getCachedBlob } from '@/lib/cache';
import { getFile } from '@/lib/github';
import { shareBlob, downloadBlob, createBlobFromBytes, formatFileSize } from '@/lib/files';
import { showToast } from '@/components/ToastContainer';
import {
  DownloadIcon,
  ShareIcon,
  EyeIcon,
  PaperResumeIcon,
  GitBranchIcon,
  GitCommitIcon,
} from '@/components/SvgIcons';
import { Skeleton } from '@/src/components/Skeleton';
import { Plus, MoreVertical, Trash2 } from 'lucide-react';
import { useVault } from '@/store/useVault';
import clsx from 'clsx';

interface HeroVersionCardProps {
  version: Version | null;
  branch: Branch;
  totalBranchVersions?: number;
  totalCommits?: number;
  onOpenActions?: () => void;
  onView?: () => void;
}

export function HeroVersionCard({
  version,
  branch,
  totalBranchVersions,
  totalCommits,
  onOpenActions,
  onView,
}: HeroVersionCardProps) {
  const router = useRouter();
  const { softDeleteVersion } = useVault();
  const commitCount = totalCommits ?? totalBranchVersions ?? 0;

  const { url: thumbUrl, isLoading: isThumbLoading } = useBlobUrl(
    version?.thumbPath || null
  );

  if (!version) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-subtle p-6 text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-600">
          <GitBranchIcon size={22} />
        </div>
        <h3 className="font-semibold text-sm text-zinc-900 font-mono">
          No commits on /{branch.name} yet
        </h3>
        <p className="text-xs font-mono text-zinc-400 max-w-sm mx-auto">
          This branch has no revisions. Commit a resume to make it the branch HEAD.
        </p>
        <Link
          href={`/add?branch=${branch.id}`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-950 text-white text-xs font-mono font-medium hover:bg-zinc-800 transition-colors shadow-xs"
        >
          <Plus size={14} />
          <span>Commit First Resume</span>
        </Link>
      </div>
    );
  }

  const isPdf =
    version.mime === 'application/pdf' || version.fileName.endsWith('.pdf');

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      let bytes = await getCachedBlob(version.filePath);
      if (!bytes) {
        bytes = await getFile(version.filePath);
      }
      if (bytes) {
        const blob = createBlobFromBytes(bytes, version.mime);
        await shareBlob(
          blob,
          version.fileName,
          `${version.label} (${version.fileName})`
        );
        showToast({ type: 'success', message: 'Shared successfully' });
      } else {
        showToast({
          type: 'error',
          message: 'File not available to share offline',
        });
      }
    } catch {
      showToast({ type: 'error', message: 'Could not share file' });
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      let bytes = await getCachedBlob(version.filePath);
      if (!bytes) {
        bytes = await getFile(version.filePath);
      }
      if (bytes) {
        const blob = createBlobFromBytes(bytes, version.mime);
        downloadBlob(blob, version.fileName);
        showToast({ type: 'success', message: 'Downloaded resume file' });
      } else {
        showToast({ type: 'error', message: 'File not available in cache' });
      }
    } catch {
      showToast({ type: 'error', message: 'Could not download file' });
    }
  };

  const handleOpenView = () => {
    if (onView) {
      onView();
    } else {
      router.push(`/view/${version.id}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      onClick={handleOpenView}
      className="group cursor-pointer bg-white rounded-2xl border border-zinc-200/90 shadow-subtle hover:shadow-card hover:border-zinc-300 transition-all p-5 sm:p-6"
    >
      <div className="flex flex-col md:flex-row gap-5 items-start">
        {/* Document Thumbnail with crisp border */}
        <div className="w-full md:w-36 h-48 md:h-44 rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden flex-shrink-0 relative flex items-center justify-center shadow-xs">
          {isThumbLoading ? (
            <Skeleton className="w-full h-full" />
          ) : thumbUrl ? (
            <img
              src={thumbUrl}
              alt="Resume preview thumbnail"
              className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-102"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-400 gap-1.5 p-4">
              <PaperResumeIcon size={32} />
              <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                {isPdf ? 'PDF Document' : 'DOCX Document'}
              </span>
            </div>
          )}

          {/* HEAD tag badge */}
          <div className="absolute top-2 left-2 bg-zinc-950/90 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-xs">
            HEAD
          </div>
        </div>

        {/* Content & Metadata */}
        <div className="flex-1 min-w-0 flex flex-col justify-between h-full w-full">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span
                  style={{ backgroundColor: branch.color }}
                  className="w-2.5 h-2.5 rounded-full"
                />
                <span className="font-mono text-xs font-semibold text-zinc-900">
                  {branch.name}
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  • {commitCount} {commitCount === 1 ? 'commit' : 'commits'}
                </span>
              </div>

              {onOpenActions && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenActions();
                  }}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  <MoreVertical size={16} />
                </button>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-bold text-zinc-950 tracking-tight leading-snug group-hover:text-zinc-700 transition-colors truncate">
              {version.label}
            </h2>

            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-mono text-zinc-500">
              <span>{formatVersionDate(version.versionDate)}</span>
              <span>•</span>
              <span>{formatFileSize(version.sizeBytes)}</span>
              <span>•</span>
              <span className="uppercase font-bold">{isPdf ? 'PDF' : 'DOCX'}</span>
            </div>

            {version.note && (
              <p className="text-xs font-mono text-zinc-600 bg-zinc-50 border border-zinc-100 p-2.5 rounded-lg mt-3 line-clamp-2 leading-relaxed">
                {version.note}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-zinc-100 mt-4">
            <button
              type="button"
              onClick={handleOpenView}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-950 text-white text-xs font-mono font-medium shadow-xs hover:bg-zinc-800 active:scale-98 transition-all min-h-[40px]"
            >
              <EyeIcon size={14} />
              <span>View</span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white border border-zinc-200 text-zinc-800 text-xs font-mono font-medium hover:bg-zinc-50 hover:border-zinc-300 active:scale-98 transition-all min-h-[40px]"
            >
              <ShareIcon size={14} className="text-zinc-600" />
              <span>Share</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white border border-zinc-200 text-zinc-800 text-xs font-mono font-medium hover:bg-zinc-50 hover:border-zinc-300 active:scale-98 transition-all min-h-[40px]"
            >
              <DownloadIcon size={14} className="text-zinc-600" />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                await softDeleteVersion(version.id);
                showToast({ type: 'info', message: `"${version.label}" moved to Trash` });
              }}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white border border-red-200 text-red-600 text-xs font-mono font-medium hover:bg-red-50 hover:border-red-300 active:scale-98 transition-all min-h-[40px]"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
