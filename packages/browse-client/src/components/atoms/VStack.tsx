import type { CSSProperties, ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native-web';
import { type SpacingKey, StyleSheet, spacing } from '../../theme.ts';

/** Extended style type allowing both ViewStyle and web CSSProperties */
type StackStyle = ViewStyle | CSSProperties;

export interface VStackProps {
  children?: ReactNode;
  style?: StackStyle;
  className?: string;
  gap?: SpacingKey;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  flex?: ViewStyle['flex'];
  width?: ViewStyle['width'];
  height?: ViewStyle['height'];
  p?: SpacingKey;
  px?: SpacingKey;
  py?: SpacingKey;
}

const baseStyle = StyleSheet.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
});

export function VStack({
  children,
  style,
  className,
  gap,
  align,
  justify,
  flex,
  width,
  height,
  p,
  px,
  py,
}: VStackProps) {
  const computedStyle = StyleSheet.flatten(
    [
      baseStyle.container,
      gap && { gap: spacing[gap] },
      align && { alignItems: align },
      justify && { justifyContent: justify },
      flex !== undefined && { flex },
      width !== undefined && { width },
      height !== undefined && { height },
      p && { padding: spacing[p] },
      px && { paddingHorizontal: spacing[px] },
      py && { paddingVertical: spacing[py] },
      style,
    ].filter(Boolean) as unknown as ViewStyle[]
  );

  return (
    <View className={className} style={computedStyle}>
      {children}
    </View>
  );
}
