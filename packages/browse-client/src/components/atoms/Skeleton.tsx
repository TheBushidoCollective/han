import type { CSSProperties } from 'react';

type BorderRadiusKey = 'sm' | 'md' | 'lg' | 'xl';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: BorderRadiusKey;
  style?: CSSProperties;
  className?: string;
}

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 'md',
  style,
  className,
}: SkeletonProps) {
  const classes = cn(
    'bg-tertiary animate-pulse',
    `rounded-${borderRadius}`,
    className
  );

  return (
    <div
      className={classes}
      style={{
        width,
        height,
        ...style,
      }}
    />
  );
}
