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
import {
	Badge,
	Box,
	HStack,
	Pressable,
	Text,
	theme,
	VStack,
} from "../atoms/index.ts";
import {
	cleanSessionSummary,
	formatDuration,
	formatRelativeTime,
} from "../helpers/formatters.ts";
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
    owner {
      id
      name
      email
      avatarUrl
    }
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
    gitBranch
    prNumber
    prUrl
    teamName
    turnCount
    compactionCount
    estimatedCostUsd
    duration
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
			<VStack gap="sm" style={{ minWidth: 0 }}>
				{/* Row 1: Summary + timestamp */}
				<HStack justify="space-between" align="flex-start">
					<Text
						size="md"
						weight="medium"
						truncate
						style={{ flex: 1, minWidth: 0 }}
					>
						{cleanSessionSummary(session.summary) ?? session.name}
					</Text>
					<Text
						size="xs"
						color="muted"
						style={{ flexShrink: 0, marginLeft: theme.spacing.md }}
					>
						{formatRelativeTime(session.updatedAt ?? session.startedAt)}
					</Text>
				</HStack>

				{/* Row 2: Project + branch + PR + team */}
				<HStack gap="sm" align="center" style={{ flexWrap: "wrap" }}>
					<Text size="sm" color="secondary" truncate>
						{session.projectName}
					</Text>
					{session.worktreeName && (
						<Text size="xs" color="muted">
							{session.worktreeName}
						</Text>
					)}
					{session.prNumber != null &&
						(session.prUrl ? (
							<Pressable
								onPress={() => {
									window.open(session.prUrl!, "_blank", "noopener,noreferrer");
								}}
							>
								<Badge variant="success">PR #{session.prNumber}</Badge>
							</Pressable>
						) : (
							<Badge variant="success">PR #{session.prNumber}</Badge>
						))}
					{session.teamName && (
						<Badge variant="purple">{session.teamName}</Badge>
					)}
				</HStack>

				{/* Row 3: Active work indicator */}
				{hasActiveTasks && (
					<HStack gap="xs" align="center">
						<Box
							style={{
								width: 6,
								height: 6,
								borderRadius: "50%",
								backgroundColor: theme.colors.accent.primary,
								animation: "pulse 2s infinite",
							}}
						/>
						<Text size="xs" color="secondary" truncate>
							{activeTasks[0].description ??
								(activeTasks[0].type ?? "task").toLowerCase()}
						</Text>
					</HStack>
				)}
				{hasActiveTodo && (
					<HStack gap="xs" align="center">
						<Box
							style={{
								width: 6,
								height: 6,
								borderRadius: "50%",
								backgroundColor: theme.colors.accent.primary,
							}}
						/>
						<Text size="xs" color="secondary" truncate>
							{session.currentTodo?.activeForm ?? "Working"}
						</Text>
					</HStack>
				)}

				{/* Row 4: Stats + progress */}
				<HStack gap="sm" align="center" style={{ flexWrap: "wrap" }}>
					{session.gitBranch && (
						<Badge variant="info">{session.gitBranch}</Badge>
					)}
					{session.estimatedCostUsd != null &&
						session.estimatedCostUsd >= 0.01 && (
							<Text size="xs" color="muted">
								${session.estimatedCostUsd.toFixed(2)}
							</Text>
						)}
					{session.turnCount != null && session.turnCount > 0 && (
						<Text size="xs" color="muted">
							{session.turnCount}t
						</Text>
					)}
					{session.duration != null && session.duration > 0 && (
						<Text size="xs" color="muted">
							{formatDuration(session.duration)}
						</Text>
					)}
					{/* Mini task progress bar */}
					{todoProgress !== null && (
						<HStack gap="xs" align="center" style={{ minWidth: 80 }}>
							<Box
								style={{
									flex: 1,
									height: 4,
									backgroundColor: theme.colors.bg.tertiary,
									borderRadius: theme.radii.full,
									overflow: "hidden",
								}}
							>
								<Box
									style={{
										width: `${todoProgress}%`,
										height: "100%",
										backgroundColor:
											todoProgress === 100
												? theme.colors.success
												: theme.colors.accent.primary,
										borderRadius: theme.radii.full,
									}}
								/>
							</Box>
							<Text size="xs" color="muted">
								{completed}/{total}
							</Text>
						</HStack>
					)}
				</HStack>
			</VStack>
		</Link>
	);
}
