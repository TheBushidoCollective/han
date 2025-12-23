import type { CSSProperties, ReactNode } from 'react';

type SpacingKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface VStackProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  gap?: SpacingKey;
  align?: CSSProperties['alignItems'];
  justify?: CSSProperties['justifyContent'];
}

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Map CSS align values to class names
const alignMap: Record<string, string> = {
  'flex-start': 'items-start',
  start: 'items-start',
  'flex-end': 'items-end',
  end: 'items-end',
  center: 'items-center',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

// Map CSS justify values to class names
const justifyMap: Record<string, string> = {
  'flex-start': 'justify-start',
  start: 'justify-start',
  'flex-end': 'justify-end',
  end: 'justify-end',
  center: 'justify-center',
  'space-between': 'justify-between',
  'space-around': 'justify-around',
  'space-evenly': 'justify-evenly',
};

export function VStack({
  children,
  style,
  className,
  gap,
  align,
  justify,
}: VStackProps) {
  const classes = cn(
    'flex flex-col',
    gap && `gap-${gap}`,
    align && alignMap[align as string],
    justify && justifyMap[justify as string],
    className
  );

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}
