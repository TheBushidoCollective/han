/**
 * HookReferenceMessageCard Component
 *
 * Renders hook reference injection events (must-read-first files).
 */

import type React from "react";
import { graphql, useFragment } from "react-relay";
import { Badge } from "@/components/atoms/Badge.tsx";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import type { HookReferenceMessageCard_message$key } from "./__generated__/HookReferenceMessageCard_message.graphql.ts";
import {
	MessageHeader,
	type MessageRoleInfo,
	MessageWrapper,
	RawJsonView,
	useRawJsonToggle,
} from "./shared.tsx";

const HookReferenceMessageCardFragment = graphql`
  fragment HookReferenceMessageCard_message on HookReferenceMessage {
    id
    timestamp
    rawJson
    plugin
    filePath
    reason
    success
    durationMs
  }
`;

interface HookReferenceMessageCardProps {
	fragmentRef: HookReferenceMessageCard_message$key;
}

/**
 * Get role info for hook reference message
 */
function getHookReferenceRoleInfo(): MessageRoleInfo {
	return {
		label: "Reference",
		color: "#58a6ff",
		icon: "📎",
	};
}

export function HookReferenceMessageCard({
	fragmentRef,
}: HookReferenceMessageCardProps): React.ReactElement {
	const data = useFragment(HookReferenceMessageCardFragment, fragmentRef);
	const { showRawJson, toggleRawJson } = useRawJsonToggle();

	const roleInfo = getHookReferenceRoleInfo();

	const badges = (
		<HStack gap="xs">
			{data.success ? (
				<Badge variant="success">Injected</Badge>
			) : (
				<Badge variant="danger">Failed</Badge>
			)}
			{data.durationMs && <Badge variant="default">{data.durationMs}ms</Badge>}
		</HStack>
	);

	// Extract filename from path for display
	const filename = data.filePath?.split("/").pop() ?? "unknown";

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
						borderLeft: "3px solid #58a6ff",
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

						{data.reason && (
							<HStack gap="sm">
								<Text size="sm" color="muted">
									Reason:
								</Text>
								<Text size="sm" style={{ fontStyle: "italic" }}>
									{data.reason}
								</Text>
							</HStack>
						)}

						<HStack gap="sm">
							<Text size="sm" color="muted">
								Plugin:
							</Text>
							<Text size="sm">{data.plugin ?? "unknown"}</Text>
						</HStack>
					</VStack>
				</Box>
			)}
		</MessageWrapper>
	);
}
