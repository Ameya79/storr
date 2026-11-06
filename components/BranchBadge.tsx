'use client';

import React from 'react';
import { GitBranchIcon } from '@/components/SvgIcons';
import clsx from 'clsx';

import { Branch } from '@/types';

interface BranchBadgeProps {
  branch?: Branch;
  name?: string;
  color?: string;
  active?: boolean;
  size?: 'sm' | 'md';
  onClick?: () => void;
  className?: string;
}

export function BranchBadge({
  branch,
  name,
  color,
  active = false,
  size = 'md',
  onClick,
  className = '',
}: BranchBadgeProps) {
  const actualName = branch?.name || name || 'main';
  const actualColor = branch?.color || color || '#18181B';
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 font-mono rounded-md border transition-all duration-150 select-none',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        active
          ? 'bg-zinc-950 text-white border-zinc-950 font-semibold shadow-xs'
          : 'bg-white text-zinc-800 border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50/80',
        onClick && 'cursor-pointer active:scale-95',
        className
      )}
    >
      <GitBranchIcon
        size={size === 'sm' ? 12 : 13}
        className={active ? 'text-white' : 'text-zinc-500'}
      />
      <span className="truncate max-w-[130px]">{actualName}</span>
      <span
        style={{ backgroundColor: actualColor }}
        className="w-1.5 h-1.5 rounded-full flex-shrink-0 opacity-90"
      />
    </Component>
  );
}
