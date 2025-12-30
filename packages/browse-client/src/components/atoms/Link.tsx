import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useState,
} from 'react';
import { colors } from '../../theme.ts';

export interface LinkProps {
  children?: ReactNode;
  href?: string;
  style?: CSSProperties;
  className?: string;
  external?: boolean;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

export function Link({
  children,
  href,
  style,
  className,
  external,
  onClick,
}: LinkProps) {
  const [isHovered, setIsHovered] = useState(false);

  const computedStyle: CSSProperties = {
    color: colors.primary,
    textDecoration: isHovered ? 'underline' : 'none',
    cursor: 'pointer',
    transition: 'color 0.15s',
    ...style,
  };

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
      className={className}
      style={computedStyle}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  );
}
