/**
 * GraphQL FileHistorySnapshotMessage type
 *
 * A file history snapshot message tracking file state changes.
 */

import { builder } from "../../builder.ts";
import { encodeGlobalId } from "../../node-registry.ts";
import { parseFileHistorySnapshotMetadata } from "./message-helpers.ts";
import {
	MessageInterface,
	type MessageWithSession,
} from "./message-interface.ts";

const FileHistorySnapshotMessageRef = builder.objectRef<MessageWithSession>(
	"FileHistorySnapshotMessage",
);

export const FileHistorySnapshotMessageType =
	FileHistorySnapshotMessageRef.implement({
		description: "A file history snapshot message tracking file state changes",
		interfaces: [MessageInterface],
		isTypeOf: (obj) =>
			typeof obj === "object" &&
			obj !== null &&
			"type" in obj &&
			(obj as MessageWithSession).type === "file-history-snapshot",
		fields: (t) => ({
			id: t.id({
				description: "Message global ID",
				resolve: (msg) => encodeGlobalId("Message", msg.id),
			}),
			timestamp: t.field({
				type: "DateTime",
				description: "When the snapshot was taken",
				resolve: (msg) => msg.timestamp,
			}),
			rawJson: t.string({
				nullable: true,
				resolve: (msg) => msg.rawJson || null,
			}),
			// File history snapshot-specific fields
			messageId: t.string({
				nullable: true,
				description: "ID of the message this snapshot is associated with",
				resolve: (msg) =>
					parseFileHistorySnapshotMetadata(msg.rawJson).messageId,
			}),
			isSnapshotUpdate: t.boolean({
				description: "Whether this is an update to an existing snapshot",
				resolve: (msg) =>
					parseFileHistorySnapshotMetadata(msg.rawJson).isSnapshotUpdate,
			}),
			fileCount: t.int({
				description: "Number of files tracked in this snapshot",
				resolve: (msg) =>
					parseFileHistorySnapshotMetadata(msg.rawJson).fileCount,
			}),
			snapshotTimestamp: t.field({
				type: "DateTime",
				nullable: true,
				description: "Timestamp of the actual snapshot data",
				resolve: (msg) =>
					parseFileHistorySnapshotMetadata(msg.rawJson).snapshotTimestamp,
			}),
		}),
	});
