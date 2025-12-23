import type { CSSProperties, ReactNode } from 'react';

interface CheckboxProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function Checkbox({
  children,
  style,
  className,
  checked = false,
  onChange,
  disabled = false,
}: CheckboxProps) {
  const classes = cn(
    'checkbox-base',
    disabled && 'checkbox-disabled',
    className
  );

  return (
    <label className={classes} style={style}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
      />
      {children && <span className="checkbox-label">{children}</span>}
    </label>
  );
}
