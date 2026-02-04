/**
 * Han Dashboard Theme
 *
 * Design tokens for inline styles using React Native Web's StyleSheet.
 * StyleSheet.create() generates atomic CSS classes for optimal performance.
 */

import { StyleSheet } from "react-native-web";

const bgColors = {
	primary: "#0d1117",
	secondary: "#161b22",
	tertiary: "#21262d",
	hover: "#30363d",
} as const;

const accentColors = {
	primary: "#58a6ff",
	hover: "#79b8ff",
	success: "#3fb950",
	warning: "#d29922",
	danger: "#f85149",
} as const;

export const colors = {
	bg: bgColors,
	// Alias for backwards compatibility with theme.colors.background
	background: bgColors,
	border: {
		default: "#30363d",
		subtle: "#21262d",
	},
	text: {
		primary: "#c9d1d9",
		secondary: "#c9d1d9",
		muted: "#8b949e",
		heading: "#f0f6fc",
		accent: "#58a6ff",
	},
	primary: "#58a6ff",
	primaryHover: "#79b8ff",
	success: "#3fb950",
	warning: "#d29922",
	danger: "#f85149",
	purple: "#a371f7",
	// Alias for backwards compatibility with theme.colors.accent
	accent: accentColors,
} as const;

export const spacing = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	xxl: 32,
} as const;

export const fontSizes = {
	xs: 11,
	sm: 12,
	md: 14,
	lg: 16,
	xl: 20,
	xxl: 24,
} as const;

export const fontWeights = {
	normal: "400" as const,
	medium: "500" as const,
	semibold: "600" as const,
	bold: "700" as const,
};

export const radii = {
	sm: 4,
	md: 6,
	lg: 12,
	xl: 16,
	full: 9999,
} as const;

export const fonts = {
	body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
	mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
} as const;

export const shadows = {
	sm: "0 1px 2px rgba(0, 0, 0, 0.12)",
	md: "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)",
	lg: "0 4px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.12)",
} as const;

// Re-export as a unified theme object
export const theme = {
	colors,
	spacing,
	fontSizes,
	fontSize: fontSizes, // Alias for backwards compatibility
	fontWeights,
	radii,
	borderRadius: radii, // Alias for backwards compatibility
	fonts,
	shadows,
} as const;

// Type exports for components
export type SpacingKey = keyof typeof spacing;
export type FontSizeKey = keyof typeof fontSizes;
export type FontWeightKey = keyof typeof fontWeights;
export type RadiusKey = keyof typeof radii;
export type BackgroundKey = keyof typeof colors.bg;
export type TextColorKey = keyof typeof colors.text;

// Re-export StyleSheet from react-native-web for component use
export { StyleSheet };

// Helper to create typed stylesheets (convenience wrapper)
export const createStyles = StyleSheet.create.bind(StyleSheet);
