import type { CSSProperties } from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  style?: CSSProperties;
  className?: string;
}

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function Spinner({ size = 'md', style, className }: SpinnerProps) {
  const classes = cn('spinner-base', `spinner-${size}`, className);

  return <div className={classes} style={style} />;
}
