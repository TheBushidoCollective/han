/**
 * HookFileChangeMessageCard Component
 *
 * Renders file change recording events.
 */

import type React from "react";
import { graphql, useFragment } from "react-relay";
import { Badge } from "@/components/atoms/Badge.tsx";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import type { HookFileChangeMessageCard_message$key } from "./__generated__/HookFileChangeMessageCard_message.graphql.ts";
import {
	MessageHeader,
	type MessageRoleInfo,
	MessageWrapper,
	RawJsonView,
	useRawJsonToggle,
} from "./shared.tsx";

const HookFileChangeMessageCardFragment = graphql`
  fragment HookFileChangeMessageCard_message on HookFileChangeMessage {
    id
    timestamp
    rawJson
    recordedSessionId
    changeToolName
    filePath
  }
`;

interface HookFileChangeMessageCardProps {
	fragmentRef: HookFileChangeMessageCard_message$key;
}

/**
 * Get role info for hook file change message
 */
function getHookFileChangeRoleInfo(
	toolName: string | null | undefined,
): MessageRoleInfo {
	const isEdit = toolName === "Edit";
	return {
		label: "File Change",
		color: isEdit ? "#f0883e" : "#3fb950",
		icon: isEdit ? "✏️" : "📝",
	};
}

export function HookFileChangeMessageCard({
	fragmentRef,
}: HookFileChangeMessageCardProps): React.ReactElement {
	const data = useFragment(HookFileChangeMessageCardFragment, fragmentRef);
	const { showRawJson, toggleRawJson } = useRawJsonToggle();

	const roleInfo = getHookFileChangeRoleInfo(data.changeToolName);

	// Extract filename from path
	const filename = data.filePath?.split("/").pop() ?? "unknown";

	const badges = (
		<HStack gap="xs">
			<Badge variant={data.changeToolName === "Edit" ? "warning" : "success"}>
				{data.changeToolName ?? "Change"}
			</Badge>
		</HStack>
	);

	return (
		<MessageWrapper type="han_event" showRawJson={showRawJson}>
			<MessageHeader
				roleInfo={roleInfo}
				timestamp={data.timestamp}
				badges={badges}
				showRawJson={showRawJson}
				onToggleRawJson={toggleRawJson}
			/>

			{showRawJson ? (
				<RawJsonView rawJson={data.rawJson ?? null} />
			) : (
				<Box
					style={{
						borderLeft: `3px solid ${data.changeToolName === "Edit" ? "#f0883e" : "#3fb950"}`,
						paddingLeft: "12px",
						marginTop: "8px",
					}}
				>
					<VStack gap="xs" align="stretch">
						<HStack gap="sm">
							<Text size="sm" color="muted">
								File:
							</Text>
							<Text
								size="sm"
								weight="medium"
								style={{ fontFamily: "monospace" }}
							>
								{filename}
							</Text>
						</HStack>

						{data.filePath && data.filePath !== filename && (
							<Text
								size="xs"
								style={{
									fontFamily: "monospace",
									color: "#8b949e",
									overflow: "hidden",
									textOverflow: "ellipsis",
								}}
							>
								{data.filePath}
							</Text>
						)}
					</VStack>
				</Box>
			)}
		</MessageWrapper>
	);
}
