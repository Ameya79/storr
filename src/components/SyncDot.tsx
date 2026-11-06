import { SyncStatus } from '@/types';
import clsx from 'clsx';

interface SyncDotProps {
  status: SyncStatus;
  showLabel?: boolean;
  className?: string;
}

export function SyncDot({ status, showLabel = false, className }: SyncDotProps) {
  const config = {
    synced: {
      dot: 'bg-emerald-500',
      label: 'Synced',
      ping: false,
    },
    syncing: {
      dot: 'bg-amber-500',
      label: 'Syncing…',
      ping: true,
    },
    offline: {
      dot: 'bg-gray-400 dark:bg-gray-600',
      label: 'Offline',
      ping: false,
    },
    error: {
      dot: 'bg-rose-500',
      label: 'Sync error',
      ping: false,
    },
    authError: {
      dot: 'bg-rose-600',
      label: 'Auth invalid',
      ping: true,
    },
  }[status];

  return (
    <div className={clsx('inline-flex items-center gap-1.5 text-xs', className)} title={config.label}>
      <span className="relative flex h-2 w-2">
        {config.ping && (
          <span className={clsx('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', config.dot)} />
        )}
        <span className={clsx('relative inline-flex rounded-full h-2 w-2', config.dot)} />
      </span>
      {showLabel && <span className="text-muted font-medium">{config.label}</span>}
    </div>
  );
}

