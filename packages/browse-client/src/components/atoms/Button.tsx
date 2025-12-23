import type { CSSProperties, ReactNode } from 'react';

interface ButtonProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function Button({
  children,
  style,
  className,
  variant = 'secondary',
  size = 'md',
  disabled,
  active,
  onClick,
  type = 'button',
}: ButtonProps) {
  const classes = cn(
    'btn-base',
    `btn-${variant}`,
    `btn-${size}`,
    disabled && 'btn-disabled',
    active && 'btn-active',
    className
  );

  return (
    <button
      type={type}
      className={classes}
      style={style}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
