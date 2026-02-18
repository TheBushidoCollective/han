/**
 * useMessageGroups - Groups messages by parent-child relationships
 * for subway line visual connectors.
 *
 * Takes a message array with id/parentId fields and returns a Map
 * of grouping metadata per message ID.
 */

import { useMemo } from "react";

/** 6 muted subway line colors that rotate per group */
const SUBWAY_COLORS = [
	"#58a6ff", // blue
	"#3fb950", // green
	"#d29922", // amber
	"#a371f7", // purple
	"#f778ba", // pink
	"#79c0ff", // light blue
] as const;

export interface GroupInfo {
	/** Consistent color for this group (based on parent ID hash) */
	groupColor: string;
	/** True if this message has children in the timeline */
	isParent: boolean;
	/** True if this message has a parentId */
	isChild: boolean;
	/** The parent message ID (if child) */
	parentId: string | null;
}

interface MessageNode {
	readonly id: string;
	readonly parentId?: string | null;
}

/** Simple string hash to pick a consistent color */
function hashToColorIndex(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash) % SUBWAY_COLORS.length;
}

/**
 * Build a Map of message ID -> GroupInfo for all messages
 * that participate in parent-child relationships.
 */
export function useMessageGroups(
	messages: readonly MessageNode[],
): Map<string, GroupInfo> {
	return useMemo(() => {
		const groups = new Map<string, GroupInfo>();
		const parentIds = new Set<string>();

		// First pass: identify all parent IDs
		for (const msg of messages) {
			if (msg.parentId) {
				parentIds.add(msg.parentId);
			}
		}

		// Second pass: build group info for all participating messages
		for (const msg of messages) {
			const isChild = !!msg.parentId;
			const isParent = parentIds.has(msg.id);

			if (!isChild && !isParent) continue;

			// Group color is based on the parent ID (children share parent's color)
			const groupKey = msg.parentId ?? msg.id;
			const groupColor = SUBWAY_COLORS[hashToColorIndex(groupKey)];

			groups.set(msg.id, {
				groupColor,
				isParent,
				isChild,
				parentId: msg.parentId ?? null,
			});
		}

		return groups;
	}, [messages]);
}
