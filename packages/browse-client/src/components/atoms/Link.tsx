import type { CSSProperties, MouseEvent, ReactNode } from 'react';

interface LinkProps {
  children?: ReactNode;
  href?: string;
  style?: CSSProperties;
  className?: string;
  external?: boolean;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function Link({
  children,
  href,
  style,
  className,
  external,
  onClick,
}: LinkProps) {
  const classes = cn('link-base', className);

  // When no href is provided, use a button-styled anchor for onClick-only behavior
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!href) {
      e.preventDefault();
    }
    onClick?.(e);
  };

  return (
    <a
      href={href || '#'}
      className={classes}
      style={{ cursor: 'pointer', ...style }}
      onClick={handleClick}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  );
}
