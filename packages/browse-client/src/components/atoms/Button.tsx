import { type CSSProperties, type ReactNode, useState } from 'react';
import { colors, fontSizes, radii, spacing } from '../../theme.ts';

export interface ButtonProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  accessibilityLabel?: string;
}

const sizeStyles: Record<string, CSSProperties> = {
  sm: {
    padding: `${spacing.xs}px ${spacing.sm}px`,
    fontSize: fontSizes.xs,
  },
  md: {
    padding: `${spacing.sm}px ${spacing.md}px`,
    fontSize: fontSizes.sm,
  },
  lg: {
    padding: `${spacing.md}px ${spacing.lg}px`,
    fontSize: fontSizes.md,
  },
};

const getVariantStyles = (
  variant: string,
  isHovered: boolean,
  active?: boolean
): CSSProperties => {
  const variants: Record<string, CSSProperties> = {
    primary: {
      backgroundColor: isHovered ? colors.primaryHover : colors.primary,
      color: '#fff',
      border: 'none',
    },
    secondary: {
      backgroundColor:
        isHovered || active ? colors.border.default : colors.bg.tertiary,
      color: active ? colors.primary : colors.text.primary,
      border: `1px solid ${colors.border.default}`,
    },
    ghost: {
      backgroundColor: isHovered || active ? colors.bg.tertiary : 'transparent',
      color: active ? colors.primary : colors.text.primary,
      border: 'none',
    },
    danger: {
      backgroundColor: isHovered ? '#da3633' : colors.danger,
      color: '#fff',
      border: 'none',
    },
  };
  return variants[variant];
};

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
  accessibilityLabel,
}: ButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const computedStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    fontFamily: 'inherit',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.15s, color 0.15s',
    opacity: disabled ? 0.6 : 1,
    ...sizeStyles[size],
    ...getVariantStyles(variant, isHovered, active),
    ...style,
  };

  return (
    <button
      type={type}
      className={className}
      style={computedStyle}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={accessibilityLabel}
    >
      {children}
    </button>
  );
}
