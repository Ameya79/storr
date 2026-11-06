import clsx from 'clsx';

interface TrackChipProps {
  emoji: string;
  name: string;
  color: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function TrackChip({
  emoji,
  name,
  color,
  active = false,
  onClick,
  className,
}: TrackChipProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        backgroundColor: active ? color : `${color}18`,
        borderColor: active ? color : `${color}40`,
        color: active ? '#FFFFFF' : 'inherit',
      }}
      className={clsx(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150',
        onClick && 'cursor-pointer active:scale-95 hover:opacity-90 min-h-[36px]',
        className
      )}
    >
      <span className="text-sm leading-none">{emoji}</span>
      <span className="truncate max-w-[140px]">{name}</span>
    </Component>
  );
}

