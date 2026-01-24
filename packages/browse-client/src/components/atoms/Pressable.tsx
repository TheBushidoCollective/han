import type { CSSProperties, ReactNode } from 'react';
import type { ViewStyle } from 'react-native-web';

export interface PressableProps {
  children?: ReactNode;
  style?: ViewStyle | CSSProperties;
  className?: string;
  onPress?: () => void;
  disabled?: boolean;
}

export function Pressable({
  children,
  style,
  className,
  onPress,
  disabled,
}: PressableProps) {
  const computedStyle: CSSProperties = {
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    margin: 0,
    font: 'inherit',
    color: 'inherit',
    opacity: disabled ? 0.6 : 1,
    ...(style as CSSProperties),
  };

  return (
    <button
      type="button"
      className={className}
      style={computedStyle}
      onClick={disabled ? undefined : onPress}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
