/**
 * Sessions Content Component
 *
 * Displays sessions list with pagination using usePaginationFragment.
 * Uses usePreloadedQuery to read from the preloaded query reference.
 * In hosted mode, shows team filter and view toggle components.
 */

import type React from "react";
import { useCallback, useMemo, useState, useTransition } from "react";
import type { PreloadedQuery } from "react-relay";
import {
	graphql,
	usePaginationFragment,
	usePreloadedQuery,
	useSubscription,
} from "react-relay";
import type { GraphQLSubscriptionConfig } from "relay-runtime";
import { theme } from "@/components/atoms";
import { Box } from "@/components/atoms/Box.tsx";
import { Heading } from "@/components/atoms/Heading.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Input } from "@/components/atoms/Input.tsx";
import { Pressable } from "@/components/atoms/Pressable.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import { SessionListItem } from "@/components/organisms/SessionListItem.tsx";
import { VirtualList } from "@/components/organisms/VirtualList.tsx";
import type { SessionListPageQuery } from "./__generated__/SessionListPageQuery.graphql.ts";
import type { SessionsContent_query$key } from "./__generated__/SessionsContent_query.graphql.ts";
import type { SessionsContentPaginationQuery } from "./__generated__/SessionsContentPaginationQuery.graphql.ts";
import type { SessionsContentSubscription } from "./__generated__/SessionsContentSubscription.graphql.ts";
import { SessionListPageQuery as SessionListPageQueryDef } from "./index.tsx";

/**
 * Pagination fragment for sessions connection
 */
const SessionsConnectionFragment = graphql`
  fragment SessionsContent_query on Query
  @argumentDefinitions(
    first: { type: "Int", defaultValue: 50 }
    after: { type: "String" }
    filter: { type: "SessionFilter" }
  )
  @refetchable(queryName: "SessionsContentPaginationQuery") {
    sessions(
      first: $first
      after: $after
      filter: $filter
    ) @connection(key: "SessionsContent_sessions") {
      __id
      edges {
        node {
          id
          sessionId
          projectName
          worktreeName
          summary
          updatedAt
          startedAt
          gitBranch
          estimatedCostUsd
          turnCount
          duration
          ...SessionListItem_session
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

/**
 * Subscription for new sessions being added.
 * Uses @prependEdge to add new sessions to the connection.
 */
const SessionsContentSubscriptionDef = graphql`
  subscription SessionsContentSubscription(
    $connections: [ID!]!
    $projectId: ID
  ) {
    sessionAdded(projectId: $projectId) {
      sessionId
      projectId
      newSessionEdge @prependEdge(connections: $connections) {
        node {
          id
          sessionId
          projectName
          worktreeName
          summary
          updatedAt
          startedAt
          gitBranch
          estimatedCostUsd
          turnCount
          duration
          ...SessionListItem_session
        }
        cursor
      }
    }
  }
`;

/**
 * Branch filter dropdown
 */
function BranchDropdown({
	branches,
	selected,
	onSelect,
}: {
	branches: string[];
	selected: string;
	onSelect: (branch: string) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Box style={{ position: "relative" }}>
			<Pressable onPress={() => setIsOpen(!isOpen)}>
				<Box
					style={{
						padding: theme.spacing.sm,
						paddingHorizontal: theme.spacing.md,
						backgroundColor: selected
							? theme.colors.accent.primary
							: theme.colors.bg.tertiary,
						borderRadius: theme.radii.md,
						borderWidth: 1,
						borderColor: selected
							? theme.colors.accent.primary
							: theme.colors.border.default,
						minWidth: 130,
					}}
				>
					<HStack justify="space-between" align="center" gap="sm">
						<Text size="sm" style={selected ? { color: "#ffffff" } : undefined}>
							{selected || "All branches"}
						</Text>
						<Text
							size="xs"
							color={selected ? undefined : "muted"}
							style={selected ? { color: "#ffffff" } : undefined}
						>
							{isOpen ? "\u25B2" : "\u25BC"}
						</Text>
					</HStack>
				</Box>
			</Pressable>

			{isOpen && (
				<Box
					style={{
						position: "absolute",
						top: "100%",
						right: 0,
						marginTop: theme.spacing.xs,
						backgroundColor: theme.colors.bg.secondary,
						borderRadius: theme.radii.md,
						borderWidth: 1,
						borderColor: theme.colors.border.default,
						zIndex: 100,
						maxHeight: 300,
						minWidth: 200,
						overflow: "auto",
					}}
				>
					<Pressable
						onPress={() => {
							onSelect("");
							setIsOpen(false);
						}}
					>
						<Box
							style={{
								padding: theme.spacing.sm,
								paddingHorizontal: theme.spacing.md,
								backgroundColor: !selected
									? theme.colors.bg.hover
									: "transparent",
							}}
						>
							<Text size="sm">All branches</Text>
						</Box>
					</Pressable>
					{branches.map((branch) => (
						<Pressable
							key={branch}
							onPress={() => {
								onSelect(branch);
								setIsOpen(false);
							}}
						>
							<Box
								style={{
									padding: theme.spacing.sm,
									paddingHorizontal: theme.spacing.md,
									backgroundColor:
										selected === branch ? theme.colors.bg.hover : "transparent",
								}}
							>
								<Text size="sm" style={{ fontFamily: theme.fonts.mono }}>
									{branch}
								</Text>
							</Box>
						</Pressable>
					))}
				</Box>
			)}
		</Box>
	);
}

type SortOption = "updatedAt" | "startedAt" | "cost" | "turns" | "duration";

const SORT_LABELS: Record<SortOption, string> = {
	updatedAt: "Last Updated",
	startedAt: "Start Date",
	cost: "Cost",
	turns: "Turns",
	duration: "Duration",
};

/**
 * Sort option dropdown (follows BranchDropdown pattern)
 */
function SortDropdown({
	selected,
	onSelect,
}: {
	selected: SortOption;
	onSelect: (option: SortOption) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const options: SortOption[] = [
		"updatedAt",
		"startedAt",
		"cost",
		"turns",
		"duration",
	];

	return (
		<Box style={{ position: "relative" }}>
			<Pressable onPress={() => setIsOpen(!isOpen)}>
				<Box
					style={{
						padding: theme.spacing.sm,
						paddingHorizontal: theme.spacing.md,
						backgroundColor: theme.colors.bg.tertiary,
						borderRadius: theme.radii.md,
						borderWidth: 1,
						borderColor: theme.colors.border.default,
						minWidth: 140,
					}}
				>
					<HStack justify="space-between" align="center" gap="sm">
						<Text size="sm">{SORT_LABELS[selected]}</Text>
						<Text size="xs" color="muted">
							{isOpen ? "\u25B2" : "\u25BC"}
						</Text>
					</HStack>
				</Box>
			</Pressable>

			{isOpen && (
				<Box
					style={{
						position: "absolute",
						top: "100%",
						right: 0,
						marginTop: theme.spacing.xs,
						backgroundColor: theme.colors.bg.secondary,
						borderRadius: theme.radii.md,
						borderWidth: 1,
						borderColor: theme.colors.border.default,
						zIndex: 100,
						minWidth: 160,
						overflow: "hidden",
					}}
				>
					{options.map((option) => (
						<Pressable
							key={option}
							onPress={() => {
								onSelect(option);
								setIsOpen(false);
							}}
						>
							<Box
								style={{
									padding: theme.spacing.sm,
									paddingHorizontal: theme.spacing.md,
									backgroundColor:
										selected === option
											? theme.colors.bg.hover
											: "transparent",
								}}
							>
								<Text size="sm">{SORT_LABELS[option]}</Text>
							</Box>
						</Pressable>
					))}
				</Box>
			)}
		</Box>
	);
}

interface SessionsContentProps {
	queryRef: PreloadedQuery<SessionListPageQuery>;
	projectId: string | null;
	worktreeName: string | null;
}

export function SessionsContent({
	queryRef,
	projectId,
	worktreeName,
}: SessionsContentProps): React.ReactElement {
	const [filter, setFilter] = useState("");
	const [selectedBranch, setSelectedBranch] = useState<string>("");
	const [sortBy, setSortBy] = useState<SortOption>("updatedAt");
	const [isPending, startTransition] = useTransition();

	// First, read the preloaded query data
	const preloadedData = usePreloadedQuery<SessionListPageQuery>(
		SessionListPageQueryDef,
		queryRef,
	);

	// Then use pagination fragment to get paginated data
	const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
		SessionsContentPaginationQuery,
		SessionsContent_query$key
	>(SessionsConnectionFragment, preloadedData);

	// Get connection ID for @prependEdge
	const connectionId = data.sessions?.__id;

	// Subscribe to new sessions being added
	const subscriptionConfig = useMemo<
		GraphQLSubscriptionConfig<SessionsContentSubscription>
	>(
		() => ({
			subscription: SessionsContentSubscriptionDef,
			variables: {
				connections: connectionId ? [connectionId] : [],
				projectId: projectId || undefined,
			},
			onError: (err: Error) => {
				console.warn("SessionsContent subscription error:", err);
			},
		}),
		[connectionId, projectId],
	);

	useSubscription<SessionsContentSubscription>(subscriptionConfig);

	// Extract session edges and sort by updatedAt (most recent first)
	type SessionEdge = NonNullable<
		NonNullable<typeof data.sessions>["edges"]
	>[number];
	type ValidEdge = NonNullable<SessionEdge> & {
		node: NonNullable<NonNullable<SessionEdge>["node"]> & { id: string };
	};

	const sortedEdges = useMemo(() => {
		const edges = data.sessions?.edges ?? [];
		const filtered = edges.filter(
			(edge): edge is ValidEdge =>
				!!edge?.node?.id &&
				// Exclude agent sessions - they are child sessions shown in session detail
				!edge.node.sessionId?.startsWith("agent-"),
		);

		return filtered.sort((a, b) => {
			switch (sortBy) {
				case "startedAt": {
					const aTime = a.node.startedAt || "";
					const bTime = b.node.startedAt || "";
					return bTime.localeCompare(aTime);
				}
				case "cost": {
					const aCost = a.node.estimatedCostUsd ?? 0;
					const bCost = b.node.estimatedCostUsd ?? 0;
					return bCost - aCost;
				}
				case "turns": {
					const aTurns = a.node.turnCount ?? 0;
					const bTurns = b.node.turnCount ?? 0;
					return bTurns - aTurns;
				}
				case "duration": {
					const aDur = a.node.duration ?? 0;
					const bDur = b.node.duration ?? 0;
					return bDur - aDur;
				}
				case "updatedAt":
				default: {
					const aTime = a.node.updatedAt || a.node.startedAt || "";
					const bTime = b.node.updatedAt || b.node.startedAt || "";
					return bTime.localeCompare(aTime);
				}
			}
		});
	}, [data.sessions?.edges, sortBy]);

	// Extract unique branch names from loaded edges
	const uniqueBranches = useMemo(() => {
		const branches = new Set<string>();
		for (const edge of sortedEdges) {
			if (edge.node.gitBranch) {
				branches.add(edge.node.gitBranch);
			}
		}
		return Array.from(branches).sort();
	}, [sortedEdges]);

	// Filter edges by search text and branch
	const filteredEdges = useMemo(() => {
		let edges = sortedEdges;

		if (selectedBranch) {
			edges = edges.filter((edge) => edge.node.gitBranch === selectedBranch);
		}

		if (filter) {
			const searchLower = filter.toLowerCase();
			edges = edges.filter(
				(edge) =>
					edge.node.projectName?.toLowerCase().includes(searchLower) ||
					edge.node.summary?.toLowerCase().includes(searchLower) ||
					edge.node.gitBranch?.toLowerCase().includes(searchLower) ||
					edge.node.sessionId?.toLowerCase().includes(searchLower),
			);
		}

		return edges;
	}, [sortedEdges, filter, selectedBranch]);

	// Build page title based on context
	let pageTitle = "Sessions";
	let pageSubtitle = "";

	if (projectId && worktreeName) {
		pageTitle = `Sessions - ${worktreeName}`;
		pageSubtitle = `Worktree sessions for ${projectId}`;
	} else if (projectId) {
		pageTitle = "Project Sessions";
		pageSubtitle = `Sessions for ${projectId}`;
	}

	// Automatic pagination when reaching end of list
	const handleEndReached = useCallback(() => {
		if (hasNext && !isLoadingNext && !isPending) {
			startTransition(() => {
				loadNext(50);
			});
		}
	}, [hasNext, isLoadingNext, isPending, loadNext]);

	return (
		<VStack style={{ height: "100%", overflow: "hidden" }}>
			{/* Header with title and filter */}
			<HStack
				justify="space-between"
				align="center"
				style={{
					padding: theme.spacing.lg,
					borderBottom: `1px solid ${theme.colors.border.subtle}`,
					flexShrink: 0,
				}}
			>
				<HStack gap="md" align="center">
					<Heading size="md">{pageTitle}</Heading>
					{pageSubtitle && (
						<>
							<Text color="muted">|</Text>
							<Text color="secondary" size="sm">
								{pageSubtitle}
							</Text>
						</>
					)}
					{data.sessions?.totalCount !== undefined && (
						<>
							<Text color="muted">|</Text>
							<Text color="muted" size="sm">
								{data.sessions.totalCount} total
							</Text>
						</>
					)}
				</HStack>
				<HStack gap="sm" align="center">
					<SortDropdown selected={sortBy} onSelect={setSortBy} />
					{uniqueBranches.length > 0 && (
						<BranchDropdown
							branches={uniqueBranches}
							selected={selectedBranch}
							onSelect={setSelectedBranch}
						/>
					)}
					<Input
						placeholder="Filter sessions..."
						value={filter}
						onChange={setFilter}
						style={{ width: "250px" }}
					/>
				</HStack>
			</HStack>

			{/* Virtualized session list */}
			<VirtualList
				data={filteredEdges}
				renderItem={(edge) => (
					<SessionListItem
						session={edge.node}
						connectionId={data.sessions?.__id}
					/>
				)}
				keyExtractor={(edge) => edge.node.id}
				itemHeight={100}
				onEndReached={handleEndReached}
				endReachedThreshold={0.5}
				isLoadingMore={isLoadingNext || isPending}
				ListEmptyComponent={
					<VStack
						align="center"
						justify="center"
						style={{ height: "200px", padding: theme.spacing.xl }}
					>
						<Text color="secondary">
							{filter || selectedBranch
								? "No sessions match your filter."
								: "No sessions found. Start using Claude Code!"}
						</Text>
					</VStack>
				}
				style={{ flex: 1, minHeight: 0 }}
			/>
		</VStack>
	);
}
