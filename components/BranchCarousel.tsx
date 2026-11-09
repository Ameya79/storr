'use client';

import React from 'react';
import { Branch } from '@/types';
import { useVault, selectOrderedBranches, selectVersionsByBranch } from '@/store/useVault';
import clsx from 'clsx';
import { Plus } from 'lucide-react';

interface BranchCarouselProps {
  onOpenCreateBranch?: () => void;
  className?: string;
}

export function BranchCarousel({
  onOpenCreateBranch,
  className = '',
}: BranchCarouselProps) {
  const { manifest, activeBranchId, setActiveBranchId } = useVault();
  const branches = selectOrderedBranches(manifest);

  if (branches.length === 0) return null;

  return (
    <div className={clsx('w-full', className)}>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-0.5 select-none font-mono text-xs">
        {branches.map((b) => {
          const isActive = b.id === activeBranchId || (!activeBranchId && b.order === 0);
          const versions = selectVersionsByBranch(manifest, b.id);

          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setActiveBranchId(b.id)}
              className={clsx(
                'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium transition-all shrink-0 active:scale-97 min-h-[42px]',
                isActive
                  ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs font-semibold'
                  : 'bg-white text-zinc-700 border-zinc-200/90 hover:border-zinc-300 hover:bg-zinc-50'
              )}
            >
              <span
                style={{ backgroundColor: b.color || '#18181B' }}
                className={clsx(
                  'w-2 h-2 rounded-full shrink-0',
                  isActive && 'ring-1 ring-white/60'
                )}
              />
              <span className="truncate max-w-[140px]">{b.name}</span>
              <span
                className={clsx(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                  isActive ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-500'
                )}
              >
                {versions.length}
              </span>
            </button>
          );
        })}

        {onOpenCreateBranch && (
          <button
            type="button"
            onClick={onOpenCreateBranch}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-zinc-300 hover:border-zinc-900 text-zinc-500 hover:text-zinc-950 bg-white/70 hover:bg-white transition-all text-xs shrink-0 min-h-[42px]"
          >
            <Plus size={13} />
            <span>Branch</span>
          </button>
        )}
      </div>
    </div>
  );
}

