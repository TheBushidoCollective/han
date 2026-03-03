/**
 * Not Found Page
 *
 * Displayed when the user navigates to an invalid route.
 * Provides a clear message and a button to return to the dashboard.
 */

import type React from "react";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { theme } from "@/components/atoms";
import { Button } from "@/components/atoms/Button.tsx";
import { Heading } from "@/components/atoms/Heading.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";

export default function NotFoundPage(): React.ReactElement {
	const navigate = useNavigate();

	const handleGoHome = useCallback(() => {
		navigate("/");
	}, [navigate]);

	return (
		<VStack
			gap="lg"
			align="center"
			justify="center"
			style={{
				flex: 1,
				minHeight: "60vh",
				padding: theme.spacing.xl,
			}}
		>
			<Text
				size="lg"
				color="muted"
				style={{ fontSize: 64, lineHeight: 72 }}
			>
				404
			</Text>
			<Heading size="lg">Page Not Found</Heading>
			<Text color="secondary" style={{ textAlign: "center" as const }}>
				The page you are looking for does not exist or has been moved.
			</Text>
			<Button onClick={handleGoHome}>Go to Dashboard</Button>
		</VStack>
	);
}
