/**
 * Page Layout Template
 *
 * Main application layout with sidebar and content area.
 * This is the template that wraps all pages.
 */

import type React from "react";
import type { ReactNode } from "react";
import { colors, fonts, spacing } from "../../theme.ts";
import { Box } from "../atoms/index.ts";
import type { ToastType } from "../organisms/index.ts";
import { ToastContainer } from "../organisms/index.ts";
import { Sidebar } from "./Sidebar.tsx";

interface PageLayoutProps {
	children: ReactNode;
	toasts: ToastType[];
	onDismissToast: (id: number) => void;
}

const appStyle = {
	display: "flex" as const,
	flexDirection: "row" as const,
	minHeight: "100vh",
	backgroundColor: colors.bg.primary,
	color: colors.text.primary,
	fontFamily: fonts.body,
};

const mainContentStyle = {
	flex: 1,
	padding: spacing.xl,
	marginLeft: 220,
	minHeight: "100vh",
	overflowX: "auto" as const,
};

export function PageLayout({
	children,
	toasts,
	onDismissToast,
}: PageLayoutProps): React.ReactElement {
	return (
		<Box style={appStyle}>
			<Sidebar />
			<Box style={mainContentStyle}>{children}</Box>
			<ToastContainer toasts={toasts} onDismiss={onDismissToast} />
		</Box>
	);
}
