import type { CSSProperties, ReactNode } from 'react';

type FontSizeKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
type TextColorKey = 'primary' | 'secondary' | 'muted';

export interface TextProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  size?: FontSizeKey;
  color?: TextColorKey;
  weight?: CSSProperties['fontWeight'];
  truncate?: boolean;
  title?: string;
}

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Map font weight to class names
const weightMap: Record<string | number, string> = {
  400: 'font-normal',
  normal: 'font-normal',
  500: 'font-medium',
  medium: 'font-medium',
  600: 'font-semibold',
  semibold: 'font-semibold',
  700: 'font-bold',
  bold: 'font-bold',
};

export function Text({
  children,
  style,
  className,
  size = 'md',
  color = 'primary',
  weight,
  truncate,
  title,
}: TextProps) {
  const classes = cn(
    `text-${size}`,
    `text-${color}`,
    weight && weightMap[weight],
    truncate && 'truncate',
    className
  );

  return (
    <span className={classes} style={style} title={title}>
      {children}
    </span>
  );
}
