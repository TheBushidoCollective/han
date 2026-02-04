/**
 * FileHistorySnapshotMessageCard Component
 *
 * Renders file history snapshot messages that track file state changes.
 */

import type React from "react";
import { graphql, useFragment } from "react-relay";
import { Badge } from "@/components/atoms/Badge.tsx";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import type { FileHistorySnapshotMessageCard_message$key } from "./__generated__/FileHistorySnapshotMessageCard_message.graphql.ts";
import {
	formatTimestamp,
	MessageHeader,
	type MessageRoleInfo,
	MessageWrapper,
	RawJsonView,
	useRawJsonToggle,
} from "./shared.tsx";

const FileHistorySnapshotMessageCardFragment = graphql`
  fragment FileHistorySnapshotMessageCard_message on FileHistorySnapshotMessage {
    id
    timestamp
    rawJson
    messageId
    isSnapshotUpdate
    fileCount
    snapshotTimestamp
  }
`;

interface FileHistorySnapshotMessageCardProps {
	fragmentRef: FileHistorySnapshotMessageCard_message$key;
}

/**
 * Get role info for file history snapshot message
 */
function getFileHistoryRoleInfo(): MessageRoleInfo {
	return {
		label: "File Snapshot",
		color: "#8b949e",
		icon: "📸",
	};
}

export function FileHistorySnapshotMessageCard({
	fragmentRef,
}: FileHistorySnapshotMessageCardProps): React.ReactElement {
	const data = useFragment(FileHistorySnapshotMessageCardFragment, fragmentRef);
	const { showRawJson, toggleRawJson } = useRawJsonToggle();

	const roleInfo = getFileHistoryRoleInfo();

	const badges = (
		<HStack gap="xs">
			{data.isSnapshotUpdate && <Badge variant="info">Update</Badge>}
			{data.fileCount != null && data.fileCount > 0 && (
				<Badge variant="default">{data.fileCount} files</Badge>
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
						borderLeft: "3px solid #6e40c9",
						paddingLeft: "12px",
						marginTop: "8px",
					}}
				>
					<VStack gap="xs" align="stretch">
						{data.messageId && (
							<HStack gap="sm">
								<Text size="sm" color="muted">
									Related message:
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
									{data.messageId.length > 30
										? `${data.messageId.slice(0, 30)}...`
										: data.messageId}
								</Text>
							</HStack>
						)}

						<HStack gap="sm">
							<Text size="sm" color="muted">
								Files tracked:
							</Text>
							<Text size="sm" weight="medium">
								{data.fileCount}
							</Text>
						</HStack>

						{data.snapshotTimestamp && (
							<HStack gap="sm">
								<Text size="sm" color="muted">
									Snapshot time:
								</Text>
								<Text size="sm">{formatTimestamp(data.snapshotTimestamp)}</Text>
							</HStack>
						)}
					</VStack>
				</Box>
			)}
		</MessageWrapper>
	);
}
