import {
  type CSSProperties,
  forwardRef,
  type KeyboardEvent,
  type ReactNode,
  type UIEvent,
} from 'react';

type SpacingKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
type BackgroundKey = 'primary' | 'secondary' | 'tertiary' | 'hover';
type BorderRadiusKey = 'sm' | 'md' | 'lg' | 'xl';

export interface BoxProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  bg?: BackgroundKey;
  p?: SpacingKey;
  px?: SpacingKey;
  py?: SpacingKey;
  m?: SpacingKey;
  borderRadius?: BorderRadiusKey;
  onClick?: () => void;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
}

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const Box = forwardRef<HTMLDivElement, BoxProps>(function Box(
  {
    children,
    style,
    className,
    bg,
    p,
    px,
    py,
    m,
    borderRadius,
    onClick,
    onScroll,
  },
  ref
) {
  const classes = cn(
    bg && `bg-${bg}`,
    p && `p-${p}`,
    px && `px-${px}`,
    py && `py-${py}`,
    m && `m-${m}`,
    borderRadius && `rounded-${borderRadius}`,
    onClick && 'cursor-pointer focus-ring',
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
    // biome-ignore lint/a11y/noStaticElementInteractions: Box is a generic container that optionally supports click handlers
    <div
      ref={ref}
      className={classes || undefined}
      style={style}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onScroll={onScroll}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
});
