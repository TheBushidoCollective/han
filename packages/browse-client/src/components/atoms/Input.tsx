import type { CSSProperties, KeyboardEvent } from 'react';
import { theme } from './theme.ts';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: CSSProperties;
  className?: string;
  type?: 'text' | 'search' | 'email' | 'password' | 'number';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

const sizeStyles: Record<'sm' | 'md' | 'lg', CSSProperties> = {
  sm: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    fontSize: theme.fontSize.sm,
  },
  md: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.fontSize.md,
  },
  lg: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    fontSize: theme.fontSize.lg,
  },
};

export function Input({
  value,
  onChange,
  placeholder,
  style,
  className,
  type = 'text',
  size = 'md',
  disabled,
  onKeyDown,
}: InputProps) {
  const baseStyles: CSSProperties = {
    backgroundColor: theme.colors.background.tertiary,
    color: theme.colors.text.primary,
    border: `1px solid ${theme.colors.border.default}`,
    borderRadius: theme.borderRadius.md,
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    width: '100%',
    ...sizeStyles[size],
    ...(disabled && {
      opacity: 0.5,
      cursor: 'not-allowed',
    }),
    ...style,
  };

  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      style={baseStyles}
      disabled={disabled}
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = theme.colors.accent.primary;
        e.currentTarget.style.boxShadow = `0 0 0 2px rgba(88, 166, 255, 0.2)`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = theme.colors.border.default;
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  );
}
