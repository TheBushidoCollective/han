import type { CSSProperties } from 'react';
import { colors } from '../../theme.ts';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  style?: CSSProperties;
}

const sizes = {
  sm: 16,
  md: 24,
  lg: 32,
};

export function Spinner({ size = 'md', style }: SpinnerProps) {
  const dimension = sizes[size];

  const computedStyle: CSSProperties = {
    width: dimension,
    height: dimension,
    border: `2px solid ${colors.border.default}`,
    borderTopColor: colors.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    ...style,
  };

  return (
    <>
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={computedStyle} />
    </>
  );
}
