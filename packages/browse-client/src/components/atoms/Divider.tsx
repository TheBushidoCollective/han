import type { CSSProperties } from 'react';

interface DividerProps {
  style?: CSSProperties;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function Divider({
  style,
  className,
  orientation = 'horizontal',
}: DividerProps) {
  const classes = cn(
    'divider-base',
    orientation === 'vertical' ? 'divider-vertical' : 'divider-horizontal',
    className
  );

  return <hr className={classes} style={style} />;
}
