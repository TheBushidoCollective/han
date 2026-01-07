/**
 * CodeBlock Atom
 *
 * React Native compatible replacement for <pre><code> HTML elements.
 * Displays multi-line preformatted monospace text with background styling.
 *
 * Note: On web (react-native-web), whiteSpace: 'pre-wrap' preserves formatting.
 * On native, line breaks in the content are preserved naturally by Text.
 */

import type { CSSProperties, ReactNode } from 'react';
import { Text as RNText, type TextStyle, View, type ViewStyle } from 'react-native-web';
import {
  colors,
  type FontSizeKey,
  fontSizes,
  fonts,
  radii,
  spacing,
  StyleSheet,
} from '../../theme.ts';

/** Extended style type allowing both styles and web CSSProperties */
type CodeBlockStyleExtended = TextStyle | CSSProperties;
type ContainerStyleExtended = ViewStyle | CSSProperties;

export interface CodeBlockProps {
  children?: ReactNode;
  /** Style applied to the text content */
  style?: CodeBlockStyleExtended;
  /** Style applied to the container */
  containerStyle?: ContainerStyleExtended;
  size?: FontSizeKey;
  /** Whether to show background styling (default: true) */
  showBackground?: boolean;
  /** Whether content is an error (shows danger color) */
  isError?: boolean;
  /** Maximum height before scrolling (web only) */
  maxHeight?: number;
  /** Whether to wrap long lines (default: true) */
  wrap?: boolean;
}

export function CodeBlock({
  children,
  style,
  containerStyle,
  size = 'sm',
  showBackground = true,
  isError = false,
  maxHeight,
  wrap = true,
}: CodeBlockProps) {
  const containerStyles = StyleSheet.flatten(
    [
      showBackground && {
        backgroundColor: colors.bg.tertiary,
        borderRadius: radii.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border.subtle,
      },
      maxHeight && {
        maxHeight,
        overflow: 'auto' as const,
      },
      containerStyle,
    ].filter(Boolean) as unknown as ViewStyle[]
  );

  const textStyles = StyleSheet.flatten(
    [
      {
        fontFamily: fonts.mono,
        fontSize: fontSizes[size],
        color: isError ? colors.danger : colors.text.primary,
        // Web-only: preserve whitespace and line breaks
        whiteSpace: wrap ? 'pre-wrap' : 'pre',
        wordBreak: wrap ? 'break-word' : 'normal',
      } as TextStyle & CSSProperties,
      style,
    ].filter(Boolean) as unknown as TextStyle[]
  );

  if (showBackground) {
    return (
      <View style={containerStyles}>
        <RNText style={textStyles}>{children}</RNText>
      </View>
    );
  }

  return <RNText style={textStyles}>{children}</RNText>;
}
