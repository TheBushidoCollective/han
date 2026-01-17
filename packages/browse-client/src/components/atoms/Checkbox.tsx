import type { CSSProperties, ReactNode } from 'react';
import { colors, fontSizes, spacing } from '../../theme.ts';

interface CheckboxProps {
  children?: ReactNode;
  style?: CSSProperties;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({
  children,
  style,
  checked = false,
  onChange,
  disabled = false,
}: CheckboxProps) {
  const labelStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.sm,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontSize: fontSizes.md,
    color: colors.text.primary,
    ...style,
  };

  const inputStyle: CSSProperties = {
    width: 16,
    height: 16,
    accentColor: colors.primary,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };

  return (
    <label style={labelStyle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
        style={inputStyle}
      />
      {children && <span>{children}</span>}
    </label>
  );
}
