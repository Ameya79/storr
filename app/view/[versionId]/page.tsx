'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useVault } from '@/store/useVault';
import { getCachedBlob, setCachedBlob } from '@/lib/cache';
import { getFile } from '@/lib/github';
import { renderPages } from '@/lib/pdf';
import {
  shareBlob,
  downloadBlob,
  createBlobFromBytes,
  formatFileSize,
} from '@/lib/files';
import { formatVersionDate } from '@/lib/dates';
import { BranchBadge } from '@/components/BranchBadge';
import {
  PaperResumeIcon,
  DownloadIcon,
  ShareIcon,
  GitBranchIcon,
  GitCommitIcon,
} from '@/components/SvgIcons';
import { showToast } from '@/components/ToastContainer';
import { ArrowLeft, Loader2, WifiOff, RefreshCw, FileText, Trash2 } from 'lucide-react';

export default function DocumentViewerPage() {
  const params = useParams();
  const router = useRouter();
  const versionId = typeof params?.versionId === 'string' ? params.versionId : '';

  const { manifest, softDeleteVersion } = useVault();
  const version = manifest?.versions.find((v) => v.id === versionId);
  const branch = manifest?.tracks.find((t) => t.id === version?.trackId);

  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineUnavailable, setIsOfflineUnavailable] = useState(false);
  const [numPages, setNumPages] = useState<number | null>(null);

  const pagesContainerRef = useRef<HTMLDivElement>(null);

  const loadFile = async () => {
    if (!version) return;
    setIsLoading(true);
    setIsOfflineUnavailable(false);

    try {
      // 1. Try local IndexedDB cache
      let fileBytes = await getCachedBlob(version.filePath);

      // 2. Fall back to GitHub Contents API
      if (!fileBytes) {
        fileBytes = await getFile(version.filePath);
        if (fileBytes) {
          await setCachedBlob(version.filePath, fileBytes);
        }
      }

      if (fileBytes) {
        setBytes(fileBytes);
      } else {
        setIsOfflineUnavailable(true);
      }
    } catch {
      setIsOfflineUnavailable(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFile();
  }, [versionId, version]);

  // Lazy render pages when bytes are ready for PDF
  useEffect(() => {
    if (!bytes || !version) return;
    const isPdf =
      version.mime === 'application/pdf' || version.fileName.endsWith('.pdf');
    if (!isPdf || !pagesContainerRef.current) return;

    let cleanupFn: (() => void) | undefined;
    const blob = createBlobFromBytes(bytes, 'application/pdf');

    renderPages(blob, pagesContainerRef.current, (pages) => {
      setNumPages(pages);
    }).then((cleanup) => {
      cleanupFn = cleanup;
    });

    return () => {
      cleanupFn?.();
    };
  }, [bytes, version]);

  if (!version) {
    return (
      <div className="pt-12 text-center max-w-sm mx-auto space-y-3">
        <p className="text-xs font-mono text-zinc-500">
          Commit / resume version not found.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-zinc-950 underline"
        >
          <ArrowLeft size={12} />
          <span>Back to Branches</span>
        </Link>
      </div>
    );
  }

  const isPdf =
    version.mime === 'application/pdf' || version.fileName.endsWith('.pdf');

  const handleShare = async () => {
    if (!bytes) return;
    try {
      const blob = createBlobFromBytes(bytes, version.mime);
      await shareBlob(
        blob,
        version.fileName,
        `${version.label} (${version.fileName})`
      );
      showToast({ type: 'success', message: 'Shared successfully' });
    } catch {
      showToast({ type: 'error', message: 'Share operation canceled or unsupported' });
    }
  };

  const handleDownload = () => {
    if (!bytes) return;
    try {
      const blob = createBlobFromBytes(bytes, version.mime);
      downloadBlob(blob, version.fileName);
      showToast({ type: 'success', message: 'Downloaded resume file' });
    } catch {
      showToast({ type: 'error', message: 'Download failed' });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md pb-4 pt-1 border-b border-zinc-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl border border-zinc-200 flex items-center justify-center text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 transition-colors flex-shrink-0"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-sm sm:text-base text-zinc-950 truncate leading-tight">
                {version.label}
              </h1>
              {branch && <BranchBadge branch={branch} size="sm" />}
            </div>
            <p className="text-[11px] font-mono text-zinc-400 truncate mt-0.5">
              {formatVersionDate(version.versionDate)}
              {numPages ? ` • ${numPages} ${numPages === 1 ? 'page' : 'pages'}` : ''} •{' '}
              {formatFileSize(version.sizeBytes)} • {version.fileName}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!bytes}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 disabled:opacity-40 text-xs font-mono font-medium shadow-xs transition-all min-h-[40px]"
            title="Download file"
          >
            <DownloadIcon size={14} />
            <span className="hidden sm:inline">Download</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            disabled={!bytes}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 disabled:opacity-40 text-xs font-mono font-medium shadow-xs transition-all min-h-[40px]"
            title="Share file"
          >
            <ShareIcon size={14} />
            <span className="hidden sm:inline">Share</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              if (window.confirm(`Move "${version.label}" to Trash?`)) {
                await softDeleteVersion(version.id);
                showToast({ type: 'info', message: `"${version.label}" moved to Trash` });
                router.push(branch ? `/branch/${branch.id}` : '/');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-mono font-medium shadow-xs transition-all min-h-[40px]"
            title="Delete resume"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      {/* Change Note and Tags Banner */}
      {(version.note || (version.tags && version.tags.length > 0)) && (
        <div className="p-4 rounded-xl bg-white border border-zinc-200 space-y-2">
          {version.note && (
            <p className="text-xs font-mono text-zinc-700 leading-relaxed">
              <span className="font-semibold text-zinc-900">Commit note: </span>
              {version.note}
            </p>
          )}
          {version.tags && version.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {version.tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 font-mono text-[10px] border border-zinc-200/60"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Document View Canvas */}
      <div className="w-full flex flex-col items-center justify-center">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 size={24} className="text-zinc-600 animate-spin" />
            <p className="text-xs font-mono text-zinc-500">
              Reading document bytes from vault…
            </p>
          </div>
        ) : isOfflineUnavailable ? (
          <div className="py-16 flex flex-col items-center justify-center text-center max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-600 flex items-center justify-center mb-3">
              <WifiOff size={22} />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 mb-1">
              File not cached locally
            </h3>
            <p className="text-xs font-mono text-zinc-500 mb-4 leading-relaxed">
              This commit has not been cached on this device yet. Reconnect to sync with your private repository.
            </p>
            <button
              type="button"
              onClick={loadFile}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-mono font-medium hover:bg-zinc-800 transition-all"
            >
              <RefreshCw size={12} />
              <span>Retry Fetch</span>
            </button>
          </div>
        ) : isPdf ? (
          /* PDF Lazy Rendered Canvas Container */
          <div
            ref={pagesContainerRef}
            className="w-full max-w-2xl mx-auto space-y-6 select-auto shadow-subtle border border-zinc-200/80 rounded-xl overflow-hidden p-2 bg-zinc-100/60"
          />
        ) : (
          /* DOCX View / Download Card */
          <div className="max-w-md w-full p-8 rounded-2xl bg-white border border-zinc-200 shadow-subtle text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900 mb-4">
              <FileText size={28} />
            </div>

            <h2 className="text-sm font-bold text-zinc-950 mb-1">
              {version.fileName}
            </h2>
            <p className="text-xs font-mono text-zinc-400 mb-6">
              Microsoft Word Document • {formatFileSize(version.sizeBytes)}
            </p>

            <div className="w-full flex gap-3">
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-950 text-white text-xs font-mono font-medium hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
              >
                <DownloadIcon size={14} />
                <span>Download DOCX</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 transition-all text-xs font-mono font-medium flex items-center justify-center gap-2"
              >
                <ShareIcon size={14} />
                <span>Share</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

