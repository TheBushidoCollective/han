/**
 * Worktree Item Component
 *
 * Displays a worktree with session count.
 */

import type React from "react";
import { useNavigate } from "react-router-dom";
import { theme } from "@/components/atoms";
import { Badge } from "@/components/atoms/Badge.tsx";
import { Card } from "@/components/atoms/Card.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import type { Worktree } from "./types.ts";

interface WorktreeItemProps {
	worktree: Worktree;
	projectId: string;
}

export function WorktreeItem({
	worktree,
	projectId,
}: WorktreeItemProps): React.ReactElement {
	const navigate = useNavigate();
	const handleClick = () => {
		// projectId uses dash format (no encoding needed), but worktree.name may contain special chars
		navigate(
			`/repos/${projectId}/worktrees/${encodeURIComponent(worktree.name)}/sessions`,
		);
	};

	return (
		<Card hoverable onClick={handleClick} style={{ padding: theme.spacing.md }}>
			<HStack justify="space-between" align="center">
				<VStack gap="xs">
					<Text weight="medium">{worktree.name}</Text>
					<Text color="muted" size="xs">
						{worktree.path}
					</Text>
				</VStack>
				<Badge>{worktree.sessionCount} sessions</Badge>
			</HStack>
		</Card>
	);
}
