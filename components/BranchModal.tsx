'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Branch, BRANCH_PALETTE } from '@/types';
import { useVault } from '@/store/useVault';
import { showToast } from '@/components/ToastContainer';
import { GitBranchIcon } from '@/components/SvgIcons';
import { X, AlertTriangle, Plus, Trash2, Check } from 'lucide-react';
import clsx from 'clsx';

const EMOJI_OPTIONS: string[] = [];

interface CreateBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (branch: Branch) => void;
}

export function CreateBranchModal({ isOpen, onClose, onCreated }: CreateBranchModalProps) {
  const { addBranch, setActiveBranchId } = useVault();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(BRANCH_PALETTE[1]); // Default Blue
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!cleanName) return;

    setIsSubmitting(true);
    try {
      const newBranch = await addBranch({
        name: cleanName,
        emoji: '',
        color,
      });
      setActiveBranchId(newBranch.id);
      showToast({ type: 'success', message: `Branch "${newBranch.name}" created` });
      setName('');
      onClose();
      onCreated?.(newBranch);
    } catch {
      showToast({ type: 'error', message: 'Failed to create branch' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

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

        {/* Modal / Sheet Content */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-zinc-200 shadow-floating p-6 z-10 space-y-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2.5">
              <div
                style={{ backgroundColor: color }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-xs"
              >
                <GitBranchIcon size={14} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 tracking-tight">Create New Branch</h3>
                <p className="text-xs text-zinc-400 font-mono">Organize resumes by career focus</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Branch Name */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Branch Name
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. product-lead, fintech, design"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50/50 text-sm font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white transition-all min-h-[44px]"
              />
            </div>

            {/* Color Accent */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Accent Color
              </label>
              <div className="flex items-center gap-2.5">
                {BRANCH_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center transition-transform',
                      color === c ? 'scale-125 ring-2 ring-zinc-950 ring-offset-2' : 'hover:scale-110'
                    )}
                  >
                    {color === c && <Check size={12} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-zinc-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 text-xs font-medium hover:bg-zinc-50 transition-colors min-h-[42px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className="px-5 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-40 transition-all flex items-center gap-1.5 min-h-[42px]"
              >
                <Plus size={14} />
                <span>{isSubmitting ? 'Creating…' : 'Create Branch'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

interface DeleteBranchModalProps {
  isOpen: boolean;
  branch: Branch | null;
  onClose: () => void;
  onDeleted?: () => void;
}

export function DeleteBranchModal({
  isOpen,
  branch,
  onClose,
  onDeleted,
}: DeleteBranchModalProps) {
  const { manifest, deleteBranch } = useVault();
  const [deleteResumes, setDeleteResumes] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !branch) return null;

  const resumesOnBranch =
    manifest?.versions.filter((v) => !v.deletedAt && v.trackId === branch.id) || [];
  const activeBranches = manifest?.tracks.filter((t) => !t.archived && !t.deletedAt) || [];
  const isOnlyBranch = activeBranches.length <= 1;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteBranch(branch.id, { deleteResumes });
      if (res.success) {
        showToast({
          type: 'info',
          message: `Branch "${branch.name}" deleted`,
        });
        onClose();
        onDeleted?.();
      } else {
        showToast({ type: 'error', message: res.error || 'Could not delete branch' });
      }
    } catch {
      showToast({ type: 'error', message: 'Could not delete branch' });
    } finally {
      setIsDeleting(false);
    }
  };

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

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-zinc-200 shadow-floating p-6 z-10 space-y-4"
        >
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-zinc-950 tracking-tight">
                Delete Branch &quot;{branch.name}&quot;?
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                This branch contains {resumesOnBranch.length} {resumesOnBranch.length === 1 ? 'resume version' : 'resume versions'}.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
            >
              <X size={16} />
            </button>
          </div>

          {isOnlyBranch ? (
            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-600">
              Cannot delete this branch because it is the only remaining branch in your vault.
            </div>
          ) : (
            <>
              {resumesOnBranch.length > 0 && (
                <div className="space-y-2 py-1">
                  <p className="text-xs font-semibold text-zinc-700">What should happen to its resumes?</p>
                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-200 cursor-pointer hover:bg-zinc-50 transition-colors">
                    <input
                      type="radio"
                      name="resumeHandling"
                      checked={!deleteResumes}
                      onChange={() => setDeleteResumes(false)}
                      className="mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-zinc-900 block">Safely move to &quot;main&quot; branch</span>
                      <span className="text-zinc-500 text-[11px]">Resumes will be preserved under the main branch.</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-200 cursor-pointer hover:bg-zinc-50 transition-colors">
                    <input
                      type="radio"
                      name="resumeHandling"
                      checked={deleteResumes}
                      onChange={() => setDeleteResumes(true)}
                      className="mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-zinc-900 block">Move resumes to Archive / Trash</span>
                      <span className="text-zinc-500 text-[11px]">They can be restored within 30 days from Trash.</span>
                    </div>
                  </label>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 text-xs font-medium hover:bg-zinc-50 transition-colors min-h-[42px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors flex items-center gap-1.5 min-h-[42px]"
                >
                  <Trash2 size={14} />
                  <span>{isDeleting ? 'Deleting…' : 'Delete Branch'}</span>
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

