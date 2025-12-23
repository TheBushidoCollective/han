import type { CSSProperties, ReactNode } from 'react';

interface BadgeProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
}

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function Badge({
  children,
  style,
  className,
  variant = 'default',
}: BadgeProps) {
  const classes = cn('badge-base', `badge-${variant}`, className);

  return (
    <span className={classes} style={style}>
      {children}
    </span>
  );
}
