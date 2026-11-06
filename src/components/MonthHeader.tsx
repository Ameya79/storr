interface MonthHeaderProps {
  header: string;
  count: number;
}

export function MonthHeader({ header, count }: MonthHeaderProps) {
  return (
    <div className="sticky top-14 lg:top-0 z-20 backdrop-blur-md bg-bg/95 py-2.5 -mx-4 px-4 sm:mx-0 sm:px-0 flex items-center justify-between border-b border-border/40 select-none">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-track-indigo" />
        <h3 className="text-xs font-bold text-text uppercase tracking-wider">{header}</h3>
      </div>
      <span className="text-[11px] font-medium text-muted">
        {count} {count === 1 ? 'version' : 'versions'}
      </span>
    </div>
  );
}

