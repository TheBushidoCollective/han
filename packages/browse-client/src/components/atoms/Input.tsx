import type { CSSProperties, KeyboardEvent } from "react";
import { colors, fontSizes, radii, spacing } from "../../theme.ts";

interface InputProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	style?: CSSProperties;
	type?: "text" | "search" | "email" | "password" | "number";
	size?: "sm" | "md" | "lg";
	disabled?: boolean;
	onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
	autoFocus?: boolean;
}

const sizeStyles: Record<"sm" | "md" | "lg", CSSProperties> = {
	sm: {
		padding: `${spacing.xs}px ${spacing.sm}px`,
		fontSize: fontSizes.sm,
	},
	md: {
		padding: `${spacing.sm}px ${spacing.md}px`,
		fontSize: fontSizes.md,
	},
	lg: {
		padding: `${spacing.md}px ${spacing.lg}px`,
		fontSize: fontSizes.lg,
	},
};

export function Input({
	value,
	onChange,
	placeholder,
	style,
	type = "text",
	size = "md",
	disabled,
	onKeyDown,
	autoFocus,
}: InputProps) {
	const baseStyles: CSSProperties = {
		backgroundColor: colors.bg.primary,
		color: colors.text.primary,
		border: `1px solid ${colors.border.default}`,
		borderRadius: radii.md,
		outline: "none",
		transition: "border-color 0.2s ease, box-shadow 0.2s ease",
		width: "100%",
		...sizeStyles[size],
		...(disabled && {
			opacity: 0.5,
			cursor: "not-allowed",
		}),
		...style,
	};

	return (
		<input
			type={type}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			placeholder={placeholder}
			style={baseStyles}
			disabled={disabled}
			onKeyDown={onKeyDown}
			// biome-ignore lint/a11y/noAutofocus: autoFocus is controlled by the component consumer
			autoFocus={autoFocus}
			onFocus={(e) => {
				e.currentTarget.style.borderColor = colors.primary;
				e.currentTarget.style.boxShadow = "0 0 0 2px rgba(88, 166, 255, 0.2)";
			}}
			onBlur={(e) => {
				e.currentTarget.style.borderColor = colors.border.default;
				e.currentTarget.style.boxShadow = "none";
			}}
		/>
	);
}
