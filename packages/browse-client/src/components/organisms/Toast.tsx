/**
 * Toast Organism
 *
 * Notification toast component and container for displaying alerts.
 */

import type React from "react";
import type { ViewStyle } from "react-native";
import { Pressable, Text, View } from "react-native";
import { colors, fontSizes, radii, spacing } from "../../theme.ts";

export interface Toast {
	id: number;
	message: string;
	type: "info" | "success" | "warning";
}

interface ToastContainerProps {
	toasts: Toast[];
	onDismiss: (id: number) => void;
}

const containerStyle: ViewStyle = {
	position: "absolute",
	bottom: spacing.xl,
	right: spacing.xl,
	zIndex: 1000,
	display: "flex",
	flexDirection: "column",
	gap: spacing.sm,
};

const toastBaseStyle: ViewStyle = {
	display: "flex",
	flexDirection: "row",
	alignItems: "center",
	gap: spacing.md,
	padding: spacing.md,
	paddingLeft: spacing.lg,
	paddingRight: spacing.lg,
	borderRadius: radii.md,
	shadowColor: "#000",
	shadowOffset: { width: 0, height: 4 },
	shadowOpacity: 0.3,
	shadowRadius: 8,
	minWidth: 280,
	maxWidth: 400,
};

const toastTypeStyles: Record<Toast["type"], ViewStyle> = {
	info: {
		backgroundColor: colors.bg.tertiary,
		borderLeftWidth: 4,
		borderLeftColor: colors.primary,
	},
	success: {
		backgroundColor: colors.bg.tertiary,
		borderLeftWidth: 4,
		borderLeftColor: colors.success,
	},
	warning: {
		backgroundColor: colors.bg.tertiary,
		borderLeftWidth: 4,
		borderLeftColor: colors.warning,
	},
};

export function ToastContainer({
	toasts,
	onDismiss,
}: ToastContainerProps): React.ReactElement | null {
	if (toasts.length === 0) return null;

	return (
		<View style={containerStyle}>
			{toasts.map((toast) => (
				<View
					key={toast.id}
					style={[toastBaseStyle, toastTypeStyles[toast.type]]}
				>
					<Text
						style={{
							flex: 1,
							fontSize: fontSizes.md,
							color: colors.text.primary,
						}}
					>
						{toast.message}
					</Text>
					<Pressable
						onPress={() => onDismiss(toast.id)}
						style={{
							padding: spacing.xs,
						}}
					>
						<Text
							style={{
								color: colors.text.muted,
								fontSize: fontSizes.lg,
								lineHeight: fontSizes.lg,
							}}
						>
							×
						</Text>
					</Pressable>
				</View>
			))}
		</View>
	);
}
