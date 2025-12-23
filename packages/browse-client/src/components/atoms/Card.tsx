import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';

interface CardProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function Card({
  children,
  style,
  className,
  onClick,
  hoverable,
}: CardProps) {
  const classes = cn(
    'card-base',
    hoverable && 'card-hoverable',
    onClick && 'focus-ring',
    className
  );

  const handleKeyDown = onClick
    ? (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }
    : undefined;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Card is a generic container that optionally supports click handlers
    <div
      className={classes}
      style={style}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
