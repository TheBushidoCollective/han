import type { CSSProperties, ReactNode } from 'react';

interface CenterProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function Center({ children, style, className }: CenterProps) {
  const classes = cn('center-base', className);

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}
