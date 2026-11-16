'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Version } from '@/types';
import { useVault } from '@/store/useVault';
import { isAllowedFileType, computeSha256, formatFileSize, readFileAsUint8Array } from '@/lib/files';
import { makeThumbnail } from '@/lib/pdf';
import { setCachedBlob } from '@/lib/cache';
import { showToast } from '@/components/ToastContainer';
import { RefreshCw, UploadCloud, X, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export interface ReplaceResumeModalProps {
  isOpen: boolean;
  version: Version | null;
  onClose: () => void;
  onReplaced?: (updatedVersion: Version) => void;
}

export function ReplaceResumeModal({
  isOpen,
  version,
  onClose,
  onReplaced,
}: ReplaceResumeModalProps) {
  const { replaceVersion } = useVault();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isGeneratingThumb, setIsGeneratingThumb] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (version && isOpen) {
      setLabel(version.label);
      setSelectedFile(null);
      setThumbnailBlob(null);
      setThumbnailUrl(null);
      setErrorMsg(null);
      setIsSaving(false);
    }
  }, [version, isOpen]);

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
      setErrorMsg(check.error || 'Invalid file format. Please upload a PDF or DOCX file.');
      return;
    }

    setSelectedFile(file);

    // If label was not customized or equals previous label, suggest the clean file name
    if (version && (!label.trim() || label === version.label)) {
      const baseName = file.name
        .replace(/\.(pdf|docx)$/i, '')
        .replace(/[_-]/g, ' ')
        .trim();
      setLabel(baseName.slice(0, 60));
    }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!version) return;

    if (!selectedFile) {
      setErrorMsg('Please select a replacement file.');
      return;
    }

    const cleanLabel = label.trim();
    if (!cleanLabel) {
      setErrorMsg('Resume name cannot be empty.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const fileBytes = await readFileAsUint8Array(selectedFile);
      const sha256 = await computeSha256(fileBytes);
      const isPdf =
        selectedFile.type === 'application/pdf' ||
        selectedFile.name.toLowerCase().endsWith('.pdf');
      const ext = isPdf ? 'pdf' : 'docx';
      const newFileId = crypto.randomUUID();

      const filePath = `files/${newFileId}.${ext}`;
      const thumbPath = thumbnailBlob ? `thumbs/${newFileId}.webp` : null;

      // 1. Store blobs in offline cache (IndexedDB)
      await setCachedBlob(filePath, fileBytes);
      if (thumbnailBlob && thumbPath) {
        const thumbBytes = await readFileAsUint8Array(thumbnailBlob);
        await setCachedBlob(thumbPath, thumbBytes);
      }

      // 2. Commit replacement to vault store
      const updated = await replaceVersion(version.id, {
        label: cleanLabel,
        fileName: selectedFile.name,
        mime: isPdf
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: selectedFile.size,
        sha256,
        filePath,
        thumbPath,
      });

      // Update metrics counter
      try {
        if (typeof fetch === 'function') {
          const origin =
            typeof window !== 'undefined' &&
            window.location?.origin &&
            window.location.origin !== 'null'
              ? window.location.origin
              : '';
          const url = origin ? `${origin}/api/stats` : '/api/stats';
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'resume_committed' }),
          }).catch(() => {});
        }
      } catch {
        // Non-critical telemetry
      }

      showToast({ type: 'success', message: `Resume "${cleanLabel}" updated successfully` });
      onReplaced?.(updated);
      onClose();
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Failed to replace resume');
      setIsSaving(false);
    }
  };

  if (!isOpen || !version) return null;

  const isPdf =
    selectedFile
      ? selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')
      : version.mime === 'application/pdf' || version.fileName.endsWith('.pdf');

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

        {/* Modal Sheet Content */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-zinc-200 shadow-floating p-6 z-10 space-y-5 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center shadow-xs">
                <RefreshCw size={15} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 tracking-tight">Replace Resume</h3>
                <p className="text-xs text-zinc-400 font-mono truncate max-w-[240px] sm:max-w-xs">
                  Updating &quot;{version.label}&quot;
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
              aria-label="Close replace modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* File Upload Zone */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5 font-mono">
                Replacement File (PDF or DOCX)
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                className="hidden"
                id="replacement-file-input"
              />

              {!selectedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={clsx(
                    'border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 min-h-[140px]',
                    isDragging
                      ? 'border-zinc-950 bg-zinc-50 scale-101'
                      : 'border-zinc-200 hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50'
                  )}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  aria-label="Upload replacement resume file"
                >
                  <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 shadow-xs">
                    <UploadCloud size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-800">
                      Choose replacement file or drag here
                    </p>
                    <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                      Current file: {version.fileName} ({formatFileSize(version.sizeBytes)})
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-16 rounded-lg border border-zinc-200 bg-white overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {isGeneratingThumb ? (
                        <Loader2 size={16} className="animate-spin text-zinc-400" />
                      ) : thumbnailUrl ? (
                        <img
                          src={thumbnailUrl}
                          alt="Thumbnail preview"
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <FileText size={20} className="text-zinc-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-zinc-950 text-white px-1.5 py-0.2 rounded">
                          {isPdf ? 'PDF' : 'DOCX'}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-600 font-semibold flex items-center gap-0.5">
                          <Check size={11} /> Ready
                        </span>
                      </div>
                      <p className="text-xs font-bold text-zinc-900 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 min-h-[44px] min-w-[44px] rounded-xl border border-zinc-200 bg-white hover:bg-zinc-100 text-xs font-mono font-medium text-zinc-800 transition-colors shadow-xs flex-shrink-0 flex items-center justify-center"
                  >
                    Change File
                  </button>
                </div>
              )}
            </div>

            {/* Resume Title / Name */}
            <div>
              <label htmlFor="replace-resume-name" className="block text-xs font-semibold text-zinc-700 mb-1.5 font-mono">
                Resume Name / Title
              </label>
              <input
                id="replace-resume-name"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs sm:text-sm font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 shadow-xs min-h-[44px]"
              />
              <p className="text-[11px] font-mono text-zinc-400 mt-1">
                Edit or confirm the title displayed for this resume entry.
              </p>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs font-mono text-red-600">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 min-h-[44px] min-w-[44px] rounded-xl border border-zinc-200 text-xs font-mono font-medium text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center justify-center"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!selectedFile || !label.trim() || isSaving}
                className={clsx(
                  'px-5 py-2.5 min-h-[44px] min-w-[44px] rounded-xl text-xs font-mono font-medium text-white transition-all shadow-xs flex items-center justify-center gap-2',
                  !selectedFile || !label.trim() || isSaving
                    ? 'bg-zinc-300 cursor-not-allowed'
                    : 'bg-zinc-950 hover:bg-zinc-800'
                )}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving Replacement...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    <span>Replace Resume</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
