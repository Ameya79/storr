'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Branch } from '@/types';
import { GitBranchIcon } from '@/components/SvgIcons';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { CreateBranchModal } from '@/components/BranchModal';
import clsx from 'clsx';

import { useVault, selectOrderedBranches } from '@/store/useVault';

interface BranchSwitcherProps {
  branches?: Branch[];
  activeBranch?: Branch | null;
  onSelectBranch?: (branchId: string) => void;
  onOpenCreateBranch?: () => void;
  className?: string;
}

export function BranchSwitcher({
  branches,
  activeBranch,
  onSelectBranch,
  onOpenCreateBranch,
  className = '',
}: BranchSwitcherProps = {}) {
  const vault = useVault();
  const allBranches = branches ?? selectOrderedBranches(vault.manifest);
  const currentBranch =
    activeBranch !== undefined
      ? activeBranch
      : allBranches.find((b) => b.id === vault.activeBranchId) || allBranches[0] || null;
  const selectHandler = onSelectBranch ?? vault.setActiveBranchId;

  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleOpenCreate = () => {
    setIsOpen(false);
    if (onOpenCreateBranch) {
      onOpenCreateBranch();
    } else {
      setIsCreateOpen(true);
    }
  };

  return (
    <>
      <div ref={containerRef} className={clsx('relative inline-block', className)}>
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 shadow-subtle hover:border-zinc-300 hover:bg-zinc-50 active:scale-98 transition-all text-xs font-mono font-medium text-zinc-900 min-h-[38px]"
        >
          <span
            style={{ backgroundColor: currentBranch?.color || '#18181B' }}
            className="w-2 h-2 rounded-full flex-shrink-0"
          />
          <span className="truncate max-w-[130px] font-semibold">
            {currentBranch?.name || 'select-branch'}
          </span>
          <ChevronDown
            size={13}
            className={clsx('text-zinc-400 transition-transform duration-180', isOpen && 'rotate-180')}
          />
        </button>

        {/* Popover Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-2xl border border-zinc-200 shadow-floating p-2 z-50 text-xs"
            >
              <div className="px-2.5 py-1.5 border-b border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                <span>Select Branch</span>
                <span>{allBranches.length} total</span>
              </div>

              <div className="py-1 max-h-56 overflow-y-auto space-y-0.5">
                {allBranches.map((b) => {
                  const isSelected = currentBranch?.id === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        selectHandler(b.id);
                        setIsOpen(false);
                      }}
                      className={clsx(
                        'w-full px-2.5 py-2 rounded-xl flex items-center justify-between transition-colors font-mono text-left',
                        isSelected
                          ? 'bg-zinc-100 text-zinc-950 font-semibold'
                          : 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          style={{ backgroundColor: b.color || '#18181B' }}
                          className="w-2 h-2 rounded-full flex-shrink-0"
                        />
                        <span className="truncate">{b.name}</span>
                      </div>
                      {isSelected && <Check size={14} className="text-zinc-950 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-1.5 border-t border-zinc-100 mt-1">
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="w-full px-2.5 py-2 rounded-xl flex items-center gap-2 text-zinc-800 hover:text-zinc-950 hover:bg-zinc-50 transition-colors text-left font-medium"
                >
                  <Plus size={14} />
                  <span>Create new branch…</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CreateBranchModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </>
  );
}
