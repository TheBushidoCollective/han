import type { CSSProperties, ReactNode } from 'react';

interface HeadingProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  as?: 'h1' | 'h2' | 'h3' | 'h4';
}

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Map heading size to font size class
const sizeMap = {
  sm: 'text-md',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-xxl',
};

export function Heading({
  children,
  style,
  className,
  size = 'md',
  as: Tag = 'h2',
}: HeadingProps) {
  const classes = cn(
    sizeMap[size],
    'text-heading font-semibold m-0',
    className
  );

  return (
    <Tag className={classes} style={style}>
      {children}
    </Tag>
  );
}
