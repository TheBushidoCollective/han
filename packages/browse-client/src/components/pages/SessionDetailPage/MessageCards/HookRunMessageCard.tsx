/**
 * HookRunMessageCard Component
 *
 * Renders hook execution start events with inline result display.
 * The result is loaded via DataLoader on the backend.
 * Subscribes to hookResultAdded to get real-time updates when result arrives.
 */

import type React from "react";
import { useMemo } from "react";
import {
	graphql,
	useFragment,
	useRelayEnvironment,
	useSubscription,
} from "react-relay";
import {
	commitLocalUpdate,
	type GraphQLSubscriptionConfig,
} from "relay-runtime";
import { Badge } from "@/components/atoms/Badge.tsx";
import { Box } from "@/components/atoms/Box.tsx";
import { CodeBlock } from "@/components/atoms/CodeBlock.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import type { HookRunMessageCard_message$key } from "./__generated__/HookRunMessageCard_message.graphql.ts";
import type { HookRunMessageCardResultSubscription } from "./__generated__/HookRunMessageCardResultSubscription.graphql.ts";
import {
	MessageHeader,
	type MessageRoleInfo,
	MessageWrapper,
	RawJsonView,
	useRawJsonToggle,
} from "./shared.tsx";

const HookRunMessageCardFragment = graphql`
  fragment HookRunMessageCard_message on HookRunMessage {
    id
    timestamp
    rawJson
    plugin
    hook
    directory
    cached
    hookRunId
    result {
      id
      success
      durationMs
      exitCode
      output
      error
    }
  }
`;

/**
 * Subscription to receive hook result updates.
 * Only subscribed when result is pending (null).
 */
const HookRunMessageCardResultSubscriptionDef = graphql`
  subscription HookRunMessageCardResultSubscription($hookRunId: String!) {
    hookResultAdded(hookRunId: $hookRunId) {
      sessionId
      hookRunId
      pluginName
      hookName
      success
      durationMs
    }
  }
`;

interface HookRunMessageCardProps {
	fragmentRef: HookRunMessageCard_message$key;
}

/**
 * Get role info for hook run message
 */
function getHookRunRoleInfo(): MessageRoleInfo {
	return {
		label: "Hook Run",
		color: "#a371f7",
		icon: "🎣",
	};
}

export function HookRunMessageCard({
	fragmentRef,
}: HookRunMessageCardProps): React.ReactElement {
	const data = useFragment(HookRunMessageCardFragment, fragmentRef);
	const { showRawJson, toggleRawJson } = useRawJsonToggle();
	const environment = useRelayEnvironment();

	const roleInfo = getHookRunRoleInfo();
	const result = data.result;

	// Subscribe to hook result updates only when result is pending
	// When subscription fires, invalidate the message to trigger a refetch
	const subscriptionConfig = useMemo<
		GraphQLSubscriptionConfig<HookRunMessageCardResultSubscription>
	>(
		() => ({
			subscription: HookRunMessageCardResultSubscriptionDef,
			variables: { hookRunId: data.hookRunId ?? "" },
			onNext: () => {
				// Result arrived - invalidate this message's record to refetch result
				const messageId = data.id;
				if (messageId) {
					commitLocalUpdate(environment, (store) => {
						const record = store.get(messageId);
						if (record) {
							record.invalidateRecord();
						}
					});
				}
			},
			onError: (err: Error) => {
				console.warn("Hook result subscription error:", err);
			},
		}),
		[data.hookRunId, data.id, environment],
	);

	// Only subscribe if result is pending and we have a hookRunId
	useSubscription<HookRunMessageCardResultSubscription>(
		result === null && data.hookRunId
			? subscriptionConfig
			: {
					subscription: HookRunMessageCardResultSubscriptionDef,
					variables: { hookRunId: "" },
				},
	);

	const badges = (
		<HStack gap="xs">
			{data.cached && <Badge variant="info">Cached</Badge>}
			{result &&
				(result.success ? (
					<Badge variant="success">{result.durationMs}ms</Badge>
				) : (
					<Badge variant="danger">Failed</Badge>
				))}
			{!result && <Badge variant="warning">Pending</Badge>}
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
						borderLeft: `3px solid ${result && !result.success ? "#f85149" : "#6e40c9"}`,
						paddingLeft: "12px",
						marginTop: "8px",
					}}
				>
					<VStack gap="xs" align="stretch">
						<HStack gap="sm">
							<Text size="sm" color="muted">
								Plugin:
							</Text>
							<Text size="sm" weight="medium">
								{data.plugin ?? "unknown"}
							</Text>
						</HStack>

						<HStack gap="sm">
							<Text size="sm" color="muted">
								Hook:
							</Text>
							<Text size="sm" weight="medium">
								{data.hook ?? "unknown"}
							</Text>
						</HStack>

						{data.directory && (
							<HStack gap="sm">
								<Text size="sm" color="muted">
									Directory:
								</Text>
								<Text
									size="xs"
									style={{
										fontFamily: "monospace",
										color: "#8b949e",
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
								>
									{data.directory}
								</Text>
							</HStack>
						)}

						{/* Show result inline if available */}
						{result && (
							<>
								<HStack gap="sm" style={{ marginTop: "8px" }}>
									<Text size="sm" color="muted">
										Status:
									</Text>
									<Text
										size="sm"
										style={{
											color: result.success ? "#3fb950" : "#f85149",
										}}
									>
										{result.success ? "Success" : "Failed"}
									</Text>
									{result.durationMs != null && result.durationMs > 0 && (
										<Text size="xs" color="muted">
											({result.durationMs}ms)
										</Text>
									)}
									{result.exitCode != null && result.exitCode !== 0 && (
										<Text size="xs" color="muted">
											exit: {result.exitCode}
										</Text>
									)}
								</HStack>

								{result.error && (
									<VStack gap="xs" align="stretch">
										<Text size="sm" color="muted">
											Error:
										</Text>
										<CodeBlock
											maxHeight={200}
											isError
											containerStyle={{ backgroundColor: "#2d1f1f" }}
										>
											{result.error}
										</CodeBlock>
									</VStack>
								)}

								{result.output && !result.error && (
									<VStack gap="xs" align="stretch">
										<Text size="sm" color="muted">
											Output:
										</Text>
										<CodeBlock maxHeight={200}>{result.output}</CodeBlock>
									</VStack>
								)}
							</>
						)}
					</VStack>
				</Box>
			)}
		</MessageWrapper>
	);
}
