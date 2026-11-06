import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'card' | 'thumbnail' | 'text' | 'circle';
}

export function Skeleton({ className, variant = 'rectangular' }: SkeletonProps) {
  const variantClass = {
    rectangular: 'rounded-md',
    card: 'rounded-card',
    thumbnail: 'rounded-card aspect-3/4 w-full',
    text: 'h-4 w-3/4 rounded',
    circle: 'rounded-full',
  }[variant];

  return (
    <div
      className={clsx(
        'animate-pulse bg-gray-200 dark:bg-gray-800/80',
        variantClass,
        className
      )}
    />
  );
}

