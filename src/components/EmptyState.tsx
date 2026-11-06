import clsx from 'clsx';

interface EmptyStateProps {
  emoji: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  emoji,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center p-8 text-center rounded-card border border-dashed border-border bg-surface/50 my-4',
        className
      )}
    >
      <div className="text-4xl mb-3 select-none">{emoji}</div>
      <h3 className="text-base font-semibold text-text mb-1">{title}</h3>
      {description && <p className="text-sm text-muted max-w-xs mb-4">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full bg-track-indigo text-white shadow-sm hover:opacity-90 active:scale-95 transition-all min-h-[44px] min-w-[120px]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

