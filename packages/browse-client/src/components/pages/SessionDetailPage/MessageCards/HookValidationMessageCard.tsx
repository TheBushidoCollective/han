/**
 * HookValidationMessageCard Component
 *
 * Renders per-directory validation hook result events.
 */

import type React from "react";
import { graphql, useFragment } from "react-relay";
import { Badge } from "@/components/atoms/Badge.tsx";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import type { HookValidationMessageCard_message$key } from "./__generated__/HookValidationMessageCard_message.graphql.ts";
import {
	MessageHeader,
	type MessageRoleInfo,
	MessageWrapper,
	RawJsonView,
	useRawJsonToggle,
} from "./shared.tsx";

const HookValidationMessageCardFragment = graphql`
  fragment HookValidationMessageCard_message on HookValidationMessage {
    id
    timestamp
    rawJson
    plugin
    hook
    directory
    cached
    durationMs
    exitCode
    success
    output
    error
  }
`;

interface HookValidationMessageCardProps {
	fragmentRef: HookValidationMessageCard_message$key;
}

/**
 * Get role info for hook validation message
 */
function getHookValidationRoleInfo(
	success: boolean | null | undefined,
): MessageRoleInfo {
	return {
		label: "Validation",
		color: success ? "#3fb950" : "#f85149",
		icon: success ? "✅" : "❌",
	};
}

export function HookValidationMessageCard({
	fragmentRef,
}: HookValidationMessageCardProps): React.ReactElement {
	const data = useFragment(HookValidationMessageCardFragment, fragmentRef);
	const { showRawJson, toggleRawJson } = useRawJsonToggle();

	const roleInfo = getHookValidationRoleInfo(data.success);

	const badges = (
		<HStack gap="xs">
			{data.cached && <Badge variant="info">Cached</Badge>}
			{data.success ? (
				<Badge variant="success">Passed</Badge>
			) : (
				<Badge variant="danger">Failed</Badge>
			)}
			{data.durationMs && <Badge variant="default">{data.durationMs}ms</Badge>}
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
								Hook:
							</Text>
							<Text size="sm" weight="medium">
								{data.plugin}/{data.hook}
							</Text>
						</HStack>

						<HStack gap="sm">
							<Text size="sm" color="muted">
								Directory:
							</Text>
							<Text
								size="xs"
								style={{
									fontFamily: "monospace",
									color: "#8b949e",
								}}
							>
								{data.directory ?? "."}
							</Text>
						</HStack>

						{data.error && (
							<Box
								style={{
									backgroundColor: "rgba(248, 81, 73, 0.1)",
									borderRadius: 4,
									padding: 8,
									marginTop: 4,
								}}
							>
								<Text size="xs" style={{ color: "#f85149" }}>
									{data.error}
								</Text>
							</Box>
						)}
					</VStack>
				</Box>
			)}
		</MessageWrapper>
	);
}
