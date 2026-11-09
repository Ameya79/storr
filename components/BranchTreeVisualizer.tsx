'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Version, Branch } from '@/types';
import { formatVersionDate } from '@/lib/dates';
import { PaperResumeIcon, EyeIcon } from '@/components/SvgIcons';
import { useVault, selectApplicationsByVersion } from '@/store/useVault';
import { Briefcase } from 'lucide-react';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';

interface BranchTreeVisualizerProps {
  branch: Branch;
  versions: Version[];
  latestVersionId?: string | null;
  onSelectVersion?: (version: Version) => void;
}

export function BranchTreeVisualizer({
  branch,
  versions,
  latestVersionId,
  onSelectVersion,
}: BranchTreeVisualizerProps) {
  const router = useRouter();
  const { manifest } = useVault();
  const effectiveLatestId =
    latestVersionId !== undefined ? latestVersionId : versions[0]?.id || null;

  const handleSelect = (v: Version) => {
    if (onSelectVersion) {
      onSelectVersion(v);
    } else {
      router.push(`/view/${v.id}`);
    }
  };

  if (versions.length === 0) {
    return null;
  }

  const isSingleItem = versions.length === 1;

  return (
    <div className="relative py-1 space-y-3">
      {versions.map((version, index) => {
        const isLatest = version.id === effectiveLatestId;
        const isFirst = index === 0;
        const isLast = index === versions.length - 1;
        const apps = selectApplicationsByVersion(manifest, version.id);
        const latestApp = apps[0] || null;

        return (
          <motion.div
            key={version.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: 'spring',
              stiffness: 350,
              damping: 28,
              delay: index * 0.04,
            }}
            className="flex items-center gap-3 sm:gap-4 group cursor-pointer"
            onClick={() => handleSelect(version)}
          >
            {/* Timeline Track: Self-stretches to exactly match the card height */}
            <div className="relative flex flex-col items-center justify-center flex-shrink-0 w-6 self-stretch">
              {/* Upper Line Segment */}
              <div
                style={{ backgroundColor: branch.color || '#18181B' }}
                className={clsx(
                  'w-0.5 flex-1 transition-opacity',
                  isFirst || isSingleItem ? 'opacity-0' : 'opacity-25'
                )}
              />

              {/* Commit Node: Always perfectly vertically centered */}
              <div
                style={{
                  borderColor: branch.color || '#18181B',
                  backgroundColor: isLatest ? branch.color || '#18181B' : '#FFFFFF',
                }}
                className={clsx(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center my-1 z-10 transition-transform group-hover:scale-125 shadow-xs',
                  isLatest ? 'bg-zinc-950 text-white' : 'bg-white'
                )}
              >
                {isLatest && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>

              {/* Lower Line Segment */}
              <div
                style={{ backgroundColor: branch.color || '#18181B' }}
                className={clsx(
                  'w-0.5 flex-1 transition-opacity',
                  isLast || isSingleItem ? 'opacity-0' : 'opacity-25'
                )}
              />
            </div>

            {/* Commit Card */}
            <div className="flex-1 min-w-0 p-3 sm:p-4 bg-white rounded-xl border border-zinc-200 shadow-xs hover:border-zinc-400 hover:shadow-subtle transition-all flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center flex-shrink-0">
                  <PaperResumeIcon size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-xs sm:text-sm font-semibold text-zinc-950 truncate">
                      {version.label}
                    </p>
                    {isLatest && (
                      <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-zinc-950 text-white px-1.5 py-0.2 rounded">
                        HEAD
                      </span>
                    )}
                    {latestApp && (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-zinc-50 border border-zinc-200/90 px-2 py-0.5 rounded-md text-zinc-800 shadow-2xs">
                        <Briefcase size={10} className="text-zinc-500 shrink-0" />
                        <span className="font-bold text-zinc-950 truncate max-w-[100px] sm:max-w-[140px]">
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
                        {apps.length > 1 && (
                          <span className="text-[9px] text-zinc-400 font-medium">
                            +{apps.length - 1}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
                    <span>{formatVersionDate(version.versionDate)}</span>
                    <span>•</span>
                    <span className="truncate max-w-[160px] sm:max-w-xs">{version.fileName}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  type="button"
                  className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-600 transition-colors"
                  aria-label="View version"
                >
                  <EyeIcon size={15} />
                </button>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
