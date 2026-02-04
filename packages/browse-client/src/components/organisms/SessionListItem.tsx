/**
 * Session List Item Organism
 *
 * Displays a session in a list format with project name, summary, and stats.
 * Colocates its data requirements via a Relay fragment.
 * Subscribes to session updates and moves updated sessions to the front of the connection.
 */

import type { CSSProperties, MouseEvent } from "react";
import { useMemo } from "react";
import { graphql, useFragment, useSubscription } from "react-relay";
import { Link } from "react-router-dom";
import type { GraphQLSubscriptionConfig } from "relay-runtime";
import { Badge, HStack, Text, theme, VStack } from "../atoms/index.ts";
import type { SessionListItem_session$key } from "./__generated__/SessionListItem_session.graphql.ts";
import type { SessionListItemSubscription } from "./__generated__/SessionListItemSubscription.graphql.ts";

/**
 * Fragment defining the data requirements for SessionListItem.
 * Parent queries should spread this fragment on Session nodes.
 */
export const SessionListItemFragment = graphql`
  fragment SessionListItem_session on Session {
    id
    sessionId
    name
    projectName
    projectSlug
    projectId
    worktreeName
    summary
    messageCount
    startedAt
    updatedAt
    currentTodo {
      content
      activeForm
      status
    }
    activeTasks {
      totalCount
      edges {
        node {
          id
          taskId
          description
          type
          status
        }
      }
    }
    todoCounts {
      total
      pending
      inProgress
      completed
    }
  }
`;

/**
 * Subscription to watch for session updates via the unified Node interface.
 * When a session is updated, the store updater moves it to the front of the connection.
 * Returns the updated node data which Relay uses to update the store.
 */
const SessionListItemSubscriptionDef = graphql`
  subscription SessionListItemSubscription($id: ID!) {
    nodeUpdated(id: $id) {
      node {
        ... on Session {
          ...SessionListItem_session
        }
      }
    }
  }
`;

interface SessionListItemProps {
	session: SessionListItem_session$key;
	/** Connection ID to update when session changes (pass connection.__id) */
	connectionId?: string;
	style?: CSSProperties;
}

function getTaskTypeVariant(
	type: string | null | undefined,
): "default" | "info" | "success" | "warning" | "danger" {
	switch (type?.toUpperCase()) {
		case "FIX":
			return "danger";
		case "IMPLEMENTATION":
			return "success";
		case "REFACTOR":
			return "info";
		case "RESEARCH":
			return "warning";
		default:
			return "default";
	}
}

function formatDate(date: string) {
	const d = new Date(date);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / 60000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
	return d.toLocaleDateString();
}

export function SessionListItem({
	session: sessionRef,
	connectionId,
	style,
}: SessionListItemProps) {
	const session = useFragment(SessionListItemFragment, sessionRef);

	// Subscribe to session updates and move to front of connection when updated
	const subscriptionConfig = useMemo<
		GraphQLSubscriptionConfig<SessionListItemSubscription>
	>(
		() => ({
			subscription: SessionListItemSubscriptionDef,
			variables: { id: session.id },
			updater: (store) => {
				if (!connectionId) return;

				// Get the connection record by its ID
				const connection = store.get(connectionId);
				if (!connection) return;

				// Get the session record
				const sessionRecord = store.get(session.id);
				if (!sessionRecord) return;

				// Get existing edges
				const edges = connection.getLinkedRecords("edges");
				if (!edges) return;

				// Find the edge containing this session
				const edgeIndex = edges.findIndex((edge) => {
					const node = edge?.getLinkedRecord("node");
					return node?.getDataID() === session.id;
				});

				// If found and not already first, move to front
				if (edgeIndex > 0) {
					const edge = edges[edgeIndex];
					const newEdges = [
						edge,
						...edges.slice(0, edgeIndex),
						...edges.slice(edgeIndex + 1),
					];
					connection.setLinkedRecords(newEdges, "edges");
				}
			},
		}),
		[session.id, connectionId],
	);

	// Only subscribe if we have a connectionId
	useSubscription(subscriptionConfig);

	const handleMouseEnter = (e: MouseEvent<HTMLAnchorElement>) => {
		e.currentTarget.style.backgroundColor = theme.colors.bg.hover;
	};

	const handleMouseLeave = (e: MouseEvent<HTMLAnchorElement>) => {
		e.currentTarget.style.backgroundColor = theme.colors.bg.primary;
	};

	// Sessions are globally unique by UUID, so we can link directly
	const sessionUrl = session.sessionId ? `/sessions/${session.sessionId}` : "#";

	// Calculate todo progress
	const total = session.todoCounts?.total ?? 0;
	const completed = session.todoCounts?.completed ?? 0;
	const todoProgress = total > 0 ? Math.round((completed / total) * 100) : null;

	// Extract and filter to only active tasks
	const activeTasks =
		session.activeTasks?.edges
			?.map((edge) => edge.node)
			.filter((node): node is NonNullable<typeof node> => node != null)
			.filter((task) => task.status === "ACTIVE") ?? [];
	const hasActiveTasks = activeTasks.length > 0;
	const hasActiveTodo = session.currentTodo && !hasActiveTasks;

	return (
		<Link
			to={sessionUrl}
			className="session-list-item"
			style={{
				display: "block",
				width: "100%",
				textAlign: "left",
				textDecoration: "none",
				padding: theme.spacing.md,
				borderBottom: `1px solid ${theme.colors.border.default}`,
				borderTop: "none",
				borderLeft: "none",
				borderRight: "none",
				cursor: "pointer",
				backgroundColor: theme.colors.bg.primary,
				transition: "background-color 0.15s",
				color: "inherit",
				font: "inherit",
				...style,
			}}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			<HStack justify="space-between" align="center">
				<VStack gap="xs" style={{ flex: 1, minWidth: 0 }}>
					<HStack gap="sm" align="center">
						<Text size="md" weight="medium" truncate>
							{session.name}
						</Text>
						<Text size="sm" color="secondary" truncate>
							{session.projectName}
						</Text>
						{session.worktreeName && (
							<Text size="xs" color="muted">
								{session.worktreeName}
							</Text>
						)}
					</HStack>
					{/* Show active tasks (subagents) if any */}
					{hasActiveTasks && (
						<HStack gap="sm" align="center" style={{ flexWrap: "wrap" }}>
							{activeTasks.map((task) => (
								<Badge
									key={task.taskId ?? task.id ?? task.description}
									variant={getTaskTypeVariant(task.type)}
								>
									{task.description ?? (task.type ?? "task").toLowerCase()}
								</Badge>
							))}
						</HStack>
					)}
					{/* Show current todo if no active task */}
					{hasActiveTodo && (
						<HStack gap="sm" align="center">
							<Badge variant="warning">
								{session.currentTodo?.activeForm ?? "Working"}
							</Badge>
						</HStack>
					)}
					{/* Show summary if no active task or todo */}
					{session.summary && !hasActiveTasks && !hasActiveTodo && (
						<Text size="sm" color="secondary" truncate>
							{session.summary}
						</Text>
					)}
					<HStack gap="sm" align="center">
						<Badge variant="default">{session.messageCount} msgs</Badge>
						{todoProgress !== null && (
							<Badge variant={todoProgress === 100 ? "success" : "default"}>
								{todoProgress}% ({completed}/{total})
							</Badge>
						)}
					</HStack>
				</VStack>
				<Text
					size="sm"
					color="muted"
					style={{ flexShrink: 0, marginLeft: theme.spacing.md }}
				>
					{formatDate(session.updatedAt ?? session.startedAt)}
				</Text>
			</HStack>
		</Link>
	);
}
