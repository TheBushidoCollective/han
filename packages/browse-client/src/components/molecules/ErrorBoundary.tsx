/**
 * ErrorBoundary Molecule
 *
 * A reusable error boundary component that catches JavaScript errors
 * anywhere in the child component tree and displays a fallback UI.
 */

import type React from "react";
import { Component } from "react";
import { Box } from "@/components/atoms/Box.tsx";
import { Heading } from "@/components/atoms/Heading.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import { colors, fonts, spacing } from "@/theme.ts";

interface ErrorBoundaryProps {
	children: React.ReactNode;
	/** Optional custom fallback component */
	fallback?: React.ReactNode;
	/** Optional callback when error is caught */
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

/**
 * Error boundary component for catching and displaying errors
 */
export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error("Error caught by boundary:", error, errorInfo);
		this.props.onError?.(error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<Box style={{ padding: spacing.lg }}>
					<VStack gap="md" align="stretch">
						<Heading size="md" style={{ color: colors.danger }}>
							Something went wrong
						</Heading>
						<Box
							style={{
								fontFamily: fonts.mono,
								fontSize: 12,
								whiteSpace: "pre-wrap",
								wordBreak: "break-word",
								color: colors.danger,
							}}
						>
							<Text>{this.state.error?.message}</Text>
						</Box>
						<Box
							style={{
								fontFamily: fonts.mono,
								fontSize: 10,
								whiteSpace: "pre-wrap",
								wordBreak: "break-word",
								color: colors.text.muted,
							}}
						>
							<Text size="xs">{this.state.error?.stack}</Text>
						</Box>
					</VStack>
				</Box>
			);
		}
		return this.props.children;
	}
}
