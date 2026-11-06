'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useVault, selectOrderedBranches } from '@/store/useVault';
import { isAllowedFileType, computeSha256 } from '@/lib/files';
import { makeThumbnail } from '@/lib/pdf';
import { setCachedBlob } from '@/lib/cache';
import { getTodayISODate } from '@/lib/dates';
import { BranchBadge } from '@/components/BranchBadge';
import {
  GitBranchIcon,
  GitCommitIcon,
  PaperResumeIcon,
} from '@/components/SvgIcons';
import { showToast } from '@/components/ToastContainer';
import {
  UploadCloud,
  FileText,
  Calendar,
  Tag,
  AlignLeft,
  X,
  Check,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

function AddVersionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBranchId = searchParams.get('branch') || searchParams.get('track');

  const { manifest, addVersion, activeBranchId, setActiveBranchId } = useVault();
  const branches = selectOrderedBranches(manifest);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isGeneratingThumb, setIsGeneratingThumb] = useState(false);

  const [label, setLabel] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [versionDate, setVersionDate] = useState<string>(getTodayISODate());
  const [note, setNote] = useState('');
  const [tagInput, setTagInput] = useState('');

  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      if (initialBranchId && branches.some((b) => b.id === initialBranchId)) {
        setSelectedBranchId(initialBranchId);
      } else if (activeBranchId && branches.some((b) => b.id === activeBranchId)) {
        setSelectedBranchId(activeBranchId);
      } else {
        setSelectedBranchId(branches[0].id);
      }
    }
  }, [branches, initialBranchId, activeBranchId, selectedBranchId]);

  useEffect(() => {
    return () => {
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [thumbnailUrl]);

  const handleProcessFile = async (file: File) => {
    setErrorMsg(null);
    const check = isAllowedFileType(file);
    if (!check.ok) {
      setErrorMsg(check.error || 'Invalid file format. Provide a PDF or DOCX file.');
      return;
    }

    setSelectedFile(file);

    const baseName = file.name
      .replace(/\.(pdf|docx)$/i, '')
      .replace(/[_-]/g, ' ')
      .trim();
    setLabel(baseName.slice(0, 60));

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setIsGeneratingThumb(true);
      try {
        const thumb = await makeThumbnail(file);
        setThumbnailBlob(thumb);
        const url = URL.createObjectURL(thumb);
        setThumbnailUrl(url);
      } catch (err) {
        console.warn('Could not generate PDF thumbnail:', err);
      } finally {
        setIsGeneratingThumb(false);
      }
    } else {
      setThumbnailBlob(null);
      setThumbnailUrl(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleProcessFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedBranchId || !label.trim()) return;

    setIsSaving(true);
    try {
      const fileBytes = new Uint8Array(await selectedFile.arrayBuffer());
      const sha256 = await computeSha256(fileBytes);
      const isPdf =
        selectedFile.type === 'application/pdf' ||
        selectedFile.name.toLowerCase().endsWith('.pdf');
      const ext = isPdf ? 'pdf' : 'docx';
      const versionId = crypto.randomUUID();

      const filePath = `files/${versionId}.${ext}`;
      const thumbPath = thumbnailBlob ? `thumbs/${versionId}.webp` : null;

      // 1. Store in local offline cache (IndexedDB)
      await setCachedBlob(filePath, fileBytes);
      if (thumbnailBlob && thumbPath) {
        const thumbBytes = new Uint8Array(await thumbnailBlob.arrayBuffer());
        await setCachedBlob(thumbPath, thumbBytes);
      }

      // Parse tags
      const tags = tagInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      // 2. Commit version to Zustand store (outbox queue + optimistic state)
      await addVersion({
        trackId: selectedBranchId,
        label: label.trim(),
        note: note.trim() || undefined,
        versionDate,
        fileName: selectedFile.name,
        mime: isPdf
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: selectedFile.size,
        sha256,
        filePath,
        thumbPath,
        tags: tags.length > 0 ? tags : undefined,
      });

      setActiveBranchId(selectedBranchId);
      showToast({ type: 'success', message: 'Committed to branch. Syncing outbox…' });
      router.push(`/branch/${selectedBranchId}`);
    } catch (err: unknown) {
      showToast({
        type: 'error',
        message: (err as Error)?.message || 'Failed to commit version',
      });
      setIsSaving(false);
    }
  };

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  return (
    <div className="max-w-xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-zinc-200">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl border border-zinc-200 flex items-center justify-center text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="font-mono font-bold text-base text-zinc-950">
              Commit Resume Version
            </h1>
            <p className="text-[11px] font-mono text-zinc-400">
              git commit -m &quot;new resume revision&quot;
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3.5 rounded-xl bg-zinc-100 border border-zinc-300 text-zinc-900 text-xs font-mono flex items-center gap-2.5">
          <AlertCircle size={16} className="text-zinc-700 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Dropzone */}
        {!selectedFile ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all min-h-[220px]',
              isDragging
                ? 'border-zinc-950 bg-zinc-50 scale-[1.01]'
                : 'border-zinc-200 bg-white hover:border-zinc-400 shadow-xs'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-900 flex items-center justify-center mb-3">
              <UploadCloud size={24} />
            </div>
            <p className="text-sm font-semibold text-zinc-900 font-mono">
              Select or Drop Resume File
            </p>
            <p className="text-[11px] font-mono text-zinc-400 mt-1 max-w-xs">
              PDF or DOCX (up to 25 MB). Instant SHA-256 integrity hash is computed.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-14 h-[75px] rounded-lg border border-zinc-200 overflow-hidden bg-zinc-50 flex-shrink-0 flex items-center justify-center relative">
                {isGeneratingThumb ? (
                  <Loader2 size={16} className="text-zinc-600 animate-spin" />
                ) : thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt="Preview"
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <PaperResumeIcon size={22} className="text-zinc-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate text-zinc-900">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB •{' '}
                  {selectedFile.name.endsWith('.pdf') ? 'PDF' : 'DOCX'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setThumbnailBlob(null);
                setThumbnailUrl(null);
              }}
              className="p-2 text-zinc-400 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
              title="Replace file"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Commit Details */}
        {selectedFile && (
          <div className="space-y-4 animate-in fade-in">
            {/* Target Branch Selector */}
            <div>
              <label className="block text-xs font-mono font-medium text-zinc-600 mb-2">
                Target Branch
              </label>
              <div className="flex flex-wrap gap-2">
                {branches.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBranchId(b.id)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2 border transition-all',
                      selectedBranchId === b.id
                        ? 'border-zinc-950 bg-zinc-950 text-white font-semibold'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          selectedBranchId === b.id ? '#FFFFFF' : b.color,
                      }}
                    />
                    <span>{b.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Commit Label */}
            <div>
              <label className="block text-xs font-mono font-medium text-zinc-600 mb-1.5">
                Commit Label / Revision Title
              </label>
              <input
                type="text"
                required
                maxLength={60}
                placeholder="e.g. Added executive summary, trimmed education"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-950"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-mono font-medium text-zinc-600 mb-1.5">
                Commit Date
              </label>
              <input
                type="date"
                required
                value={versionDate}
                onChange={(e) => setVersionDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-950"
              />
            </div>

            {/* Note / Commit Message */}
            <div>
              <label className="block text-xs font-mono font-medium text-zinc-600 mb-1.5">
                Change Notes (optional)
              </label>
              <textarea
                rows={3}
                maxLength={500}
                placeholder="Details of adjustments made in this revision…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-950 resize-none"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-mono font-medium text-zinc-600 mb-1.5">
                Tags (comma separated)
              </label>
              <input
                type="text"
                placeholder="e.g. executive, director, fintech"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-950"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving || !selectedBranch || !label.trim()}
                className="w-full py-3 px-4 rounded-xl bg-zinc-950 text-white font-mono font-semibold text-xs shadow-xs hover:bg-zinc-800 disabled:opacity-40 transition-all flex items-center justify-center gap-2 min-h-[44px]"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <GitCommitIcon size={16} />
                    <span>Commit Version to /{selectedBranch?.name}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export default function AddVersionPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-8 text-center text-xs font-mono text-zinc-400">
          Loading commit form…
        </div>
      }
    >
      <AddVersionContent />
    </React.Suspense>
  );
}
