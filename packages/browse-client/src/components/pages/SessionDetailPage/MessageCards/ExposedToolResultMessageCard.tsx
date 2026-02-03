/**
 * ExposedToolResultMessageCard Component
 *
 * Renders exposed tool result events with success/failure status.
 */

import type React from "react";
import { graphql, useFragment } from "react-relay";
import { Badge } from "@/components/atoms/Badge.tsx";
import { Box } from "@/components/atoms/Box.tsx";
import { CodeBlock } from "@/components/atoms/CodeBlock.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import type { ExposedToolResultMessageCard_message$key } from "./__generated__/ExposedToolResultMessageCard_message.graphql.ts";
import {
	MessageHeader,
	type MessageRoleInfo,
	MessageWrapper,
	RawJsonView,
	useRawJsonToggle,
} from "./shared.tsx";

const ExposedToolResultMessageCardFragment = graphql`
  fragment ExposedToolResultMessageCard_message on ExposedToolResultMessage {
    id
    timestamp
    rawJson
    tool
    prefixedName
    durationMs
    success
    output
    error
  }
`;

interface ExposedToolResultMessageCardProps {
	fragmentRef: ExposedToolResultMessageCard_message$key;
}

/**
 * Get role info for exposed tool result message
 */
function getExposedToolResultRoleInfo(success: boolean): MessageRoleInfo {
	return {
		label: "Exposed Tool Result",
		color: "#3fb950",
		icon: success ? "✅" : "❌",
	};
}

export function ExposedToolResultMessageCard({
	fragmentRef,
}: ExposedToolResultMessageCardProps): React.ReactElement {
	const data = useFragment(ExposedToolResultMessageCardFragment, fragmentRef);
	const { showRawJson, toggleRawJson } = useRawJsonToggle();

	const roleInfo = getExposedToolResultRoleInfo(data.success ?? false);

	const badges = (
		<HStack gap="xs">
			<Badge variant={data.success ? "success" : "danger"}>
				{data.success ? "Success" : "Failed"}
			</Badge>
			{data.durationMs != null && (
				<Badge variant="default">{data.durationMs}ms</Badge>
			)}
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
						borderLeft: `3px solid ${data.success ? "#3fb950" : "#f85149"}`,
						paddingLeft: "12px",
						marginTop: "8px",
					}}
				>
					<VStack gap="xs" align="stretch">
						<HStack gap="sm">
							<Text size="sm" color="muted">
								Tool:
							</Text>
							<Text size="sm" weight="medium">
								{data.tool ?? data.prefixedName ?? "unknown"}
							</Text>
						</HStack>

						{data.error && (
							<VStack gap="xs" align="stretch">
								<Text size="sm" color="muted">
									Error:
								</Text>
								<Text size="sm" style={{ color: "#f85149" }}>
									{data.error}
								</Text>
							</VStack>
						)}

						{data.output && (
							<VStack gap="xs" align="stretch">
								<Text size="sm" color="muted">
									Output:
								</Text>
								<CodeBlock maxHeight={200}>{data.output}</CodeBlock>
							</VStack>
						)}
					</VStack>
				</Box>
			)}
		</MessageWrapper>
	);
}
