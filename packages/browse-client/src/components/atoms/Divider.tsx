import type { CSSProperties } from 'react';
import { colors, spacing } from '../../theme.ts';

interface DividerProps {
  style?: CSSProperties;
  orientation?: 'horizontal' | 'vertical';
  my?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function Divider({
  style,
  orientation = 'horizontal',
  my,
}: DividerProps) {
  const isVertical = orientation === 'vertical';

  const computedStyle: CSSProperties = {
    border: 'none',
    backgroundColor: colors.border.default,
    ...(isVertical
      ? {
          width: 1,
          height: '100%',
          margin: 0,
        }
      : {
          height: 1,
          width: '100%',
          margin: my ? `${spacing[my]}px 0` : 0,
        }),
    ...style,
  };

  return <hr style={computedStyle} />;
}
