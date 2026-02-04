/**
 * MCP Server Card Component
 *
 * Displays an MCP server configuration.
 */

import type React from "react";
import { theme } from "@/components/atoms";
import { Badge } from "@/components/atoms/Badge.tsx";
import { Box } from "@/components/atoms/Box.tsx";
import { Card } from "@/components/atoms/Card.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import type { McpServer } from "./types.ts";

interface McpServerCardProps {
	server: McpServer;
}

export function McpServerCard({
	server,
}: McpServerCardProps): React.ReactElement {
	return (
		<Card>
			<VStack gap="sm">
				<HStack justify="space-between" align="center">
					<Text weight="semibold">{server.name}</Text>
					<Badge variant={server.type === "http" ? "purple" : "success"}>
						{server.type}
					</Badge>
				</HStack>
				<VStack gap="xs">
					{server.command && (
						<HStack gap="sm" align="center">
							<Box
								bg="tertiary"
								p="xs"
								borderRadius="sm"
								style={{
									fontFamily: "monospace",
									fontSize: theme.fontSize.sm,
								}}
							>
								<Text size="sm">{server.command}</Text>
							</Box>
							{server.argCount > 0 && (
								<Text size="xs" color="muted">
									+{server.argCount} args
								</Text>
							)}
						</HStack>
					)}
					{server.url && (
						<Box
							bg="tertiary"
							p="xs"
							borderRadius="sm"
							style={{ fontFamily: "monospace", fontSize: theme.fontSize.sm }}
						>
							<Text size="sm">{server.url}</Text>
						</Box>
					)}
					{server.hasEnv && <Badge variant="warning">Has env vars</Badge>}
				</VStack>
			</VStack>
		</Card>
	);
}
