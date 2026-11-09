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
import { Plus, MoreVertical, Trash2, Briefcase } from 'lucide-react';
import { useVault, selectApplicationsByVersion } from '@/store/useVault';
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
  const { manifest, softDeleteVersion } = useVault();
  const commitCount = totalCommits ?? totalBranchVersions ?? 0;
  const applications = version ? selectApplicationsByVersion(manifest, version.id) : [];

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
      className="group cursor-pointer bg-white rounded-2xl border border-zinc-200/90 shadow-subtle hover:shadow-card hover:border-zinc-300 transition-all p-4 sm:p-5"
    >
      <div className="flex gap-4 sm:gap-5 items-start">
        {/* Document Thumbnail: Sleek compact aspect ratio on mobile, comfortable on desktop */}
        <div className="w-20 h-28 sm:w-36 sm:h-48 rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden flex-shrink-0 relative flex items-center justify-center shadow-xs">
          {isThumbLoading ? (
            <Skeleton className="w-full h-full" />
          ) : thumbUrl ? (
            <img
              src={thumbUrl}
              alt="Resume preview thumbnail"
              className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-102"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-400 gap-1 p-2 text-center">
              <PaperResumeIcon size={24} />
              <span className="font-mono text-[9px] uppercase font-bold tracking-wider text-zinc-500">
                {isPdf ? 'PDF' : 'DOCX'}
              </span>
            </div>
          )}

          {/* HEAD tag badge */}
          <div className="absolute top-1.5 left-1.5 bg-zinc-950/90 backdrop-blur-xs text-white text-[9px] font-mono font-bold px-1.5 py-0.2 rounded shadow-xs">
            HEAD
          </div>
        </div>

        {/* Content & Metadata */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <span
                  style={{ backgroundColor: branch.color }}
                  className="w-2 h-2 rounded-full"
                />
                <span className="font-mono text-xs font-semibold text-zinc-900 truncate max-w-[120px] sm:max-w-none">
                  {branch.name}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
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
                  <MoreVertical size={15} />
                </button>
              )}
            </div>

            <h2 className="text-sm sm:text-base font-bold text-zinc-950 tracking-tight leading-snug group-hover:text-zinc-700 transition-colors truncate">
              {version.label}
            </h2>

            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] sm:text-[11px] font-mono text-zinc-400">
              <span>{formatVersionDate(version.versionDate)}</span>
              <span>•</span>
              <span>{formatFileSize(version.sizeBytes)}</span>
              <span>•</span>
              <span className="uppercase font-semibold">{isPdf ? 'PDF' : 'DOCX'}</span>
            </div>

            {/* Application Tracking Badge on Card */}
            <div className="mt-2.5">
              <Link
                href={`/view/${version.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 border border-zinc-200/80 text-zinc-800 text-[11px] font-mono font-medium transition-colors"
              >
                <Briefcase size={12} className="text-zinc-600" />
                <span>
                  {applications.length > 0
                    ? `${applications.length} ${applications.length === 1 ? 'Application' : 'Applications'}`
                    : '+ Track Application'}
                </span>
              </Link>
            </div>

            {version.note && (
              <p className="text-[11px] font-mono text-zinc-600 bg-zinc-50 border border-zinc-100 p-2 rounded-lg mt-2.5 line-clamp-2 leading-relaxed">
                {version.note}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons: 44px touch targets on mobile */}
      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-zinc-100 mt-3">
        <button
          type="button"
          onClick={handleOpenView}
          className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-950 text-white text-xs font-mono font-medium shadow-xs hover:bg-zinc-800 active:scale-98 transition-all min-h-[44px]"
        >
          <EyeIcon size={14} />
          <span>View</span>
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-white border border-zinc-200 text-zinc-800 text-xs font-mono font-medium hover:bg-zinc-50 hover:border-zinc-300 active:scale-98 transition-all min-h-[44px]"
          title="Share file"
        >
          <ShareIcon size={14} className="text-zinc-600" />
          <span className="hidden sm:inline">Share</span>
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-white border border-zinc-200 text-zinc-800 text-xs font-mono font-medium hover:bg-zinc-50 hover:border-zinc-300 active:scale-98 transition-all min-h-[44px]"
          title="Download file"
        >
          <DownloadIcon size={14} className="text-zinc-600" />
          <span className="hidden sm:inline">Download</span>
        </button>
        <button
          type="button"
          onClick={async (e) => {
            e.stopPropagation();
            await softDeleteVersion(version.id);
            showToast({ type: 'info', message: `"${version.label}" moved to Trash` });
          }}
          className="inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-white border border-red-200 text-red-600 text-xs font-mono font-medium hover:bg-red-50 hover:border-red-300 active:scale-98 transition-all min-h-[44px]"
          title="Delete resume"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>
    </motion.div>
  );
}
