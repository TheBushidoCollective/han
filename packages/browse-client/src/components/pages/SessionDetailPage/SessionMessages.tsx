/**
 * Session Messages Component
 *
 * Displays messages with backward pagination (load earlier messages).
 * Uses VirtualList (@shopify/flash-list) for performance.
 *
 * CRITICAL ARCHITECTURE RULES (see .claude/rules/browse/):
 * - Uses VirtualList for virtualized rendering (virtualized-lists.md)
 * - Uses inverted={true} for chat UX - newest at bottom (chat-log-scroll.md)
 * - Uses Gluestack components, NO HTML tags (react-native-first.md)
 */

import type React from "react";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import { createPortal } from "react-dom";
import {
	graphql,
	usePaginationFragment,
	useRelayEnvironment,
	useSubscription,
} from "react-relay";
import { fetchQuery, type GraphQLSubscriptionConfig } from "relay-runtime";
import { Box } from "@/components/atoms/Box.tsx";
import { Button } from "@/components/atoms/Button.tsx";
import { Center } from "@/components/atoms/Center.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Input } from "@/components/atoms/Input.tsx";
import { Spinner } from "@/components/atoms/Spinner.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import { VirtualList, type VirtualListRef } from "@/lists/index.ts";
import { colors, spacing } from "@/theme.ts";
import type { SessionMessages_session$key } from "./__generated__/SessionMessages_session.graphql.ts";
import type { SessionMessagesPaginationQuery } from "./__generated__/SessionMessagesPaginationQuery.graphql.ts";
import type { SessionMessagesSearchQuery } from "./__generated__/SessionMessagesSearchQuery.graphql.ts";
import type { SessionMessagesSubscription } from "./__generated__/SessionMessagesSubscription.graphql.ts";
import { MessageCard } from "./MessageCards/index.tsx";

/**
 * Query for server-side message search
 */
const SessionMessagesSearchQueryDef = graphql`
  query SessionMessagesSearchQuery($sessionId: ID!, $query: String!) {
    node(id: $sessionId) {
      ... on Session {
        searchMessages(query: $query, limit: 20) {
          messageId
          messageIndex
          preview
          matchContext
        }
      }
    }
  }
`;

interface SearchResult {
	messageId: string;
	messageIndex: number;
	preview: string;
	matchContext: string;
}

/**
 * Pagination fragment for messages (forward pagination through DESC-ordered list).
 * Messages are returned newest-first from API, so `first: N` gets newest N,
 * and `after: cursor` gets older messages for "load more" when scrolling up.
 *
 * CRITICAL: Uses inverted VirtualList so newest messages appear at the bottom.
 * The data order stays as-is (newest first), CSS transform handles display.
 */
const SessionMessagesFragment = graphql`
  fragment SessionMessages_session on Session
  @argumentDefinitions(
    first: { type: "Int", defaultValue: 50 }
    after: { type: "String" }
  )
  @refetchable(queryName: "SessionMessagesPaginationQuery") {
    messageCount
    messages(first: $first, after: $after)
      @connection(key: "SessionMessages_messages") {
      __id
      edges {
        node {
          id
          searchText
          ...MessageCards_message
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
 * Subscription for new messages in this session.
 * Uses @prependEdge to add new messages to the connection.
 *
 * NOTE ON ORDERING WITH INVERTED LIST:
 * - API returns messages in DESC order (newest first)
 * - Connection stores [newest, ..., oldest]
 * - Inverted VirtualList displays them visually as [oldest at top, newest at bottom]
 * - New messages prepend to connection start = appear at visual bottom
 * - @prependEdge adds to START of Relay's connection = correct!
 */
const SessionMessagesSubscriptionDef = graphql`
  subscription SessionMessagesSubscription(
    $sessionId: ID!
    $connections: [ID!]!
  ) {
    sessionMessageAdded(sessionId: $sessionId) {
      sessionId
      messageIndex
      newMessageEdge @prependEdge(connections: $connections) {
        node {
          id
          searchText
          ...MessageCards_message
        }
        cursor
      }
    }
  }
`;

interface SessionMessagesProps {
	fragmentRef: SessionMessages_session$key;
	sessionId: string;
}

export function SessionMessages({
	fragmentRef,
	sessionId,
}: SessionMessagesProps): React.ReactElement {
	const [isPending, startTransition] = useTransition();
	const [searchQuery, setSearchQuery] = useState("");
	const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
	const [showDropdown, setShowDropdown] = useState(false);
	const [selectedResultIndex, setSelectedResultIndex] = useState(0);
	const [dropdownPosition, setDropdownPosition] = useState({
		top: 0,
		right: 0,
	});
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
	const searchContainerRef = useRef<HTMLDivElement>(null);
	const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const listRef = useRef<VirtualListRef>(null);
	const environment = useRelayEnvironment();

	// Tail/non-tail state - when true, auto-scroll on new messages
	const isTailingRef = useRef(true);
	const isLoadingRef = useRef(false);
	const prevMessageCountRef = useRef(0);

	// Update dropdown position when showing
	useEffect(() => {
		if (showDropdown && searchContainerRef.current) {
			const rect = searchContainerRef.current.getBoundingClientRect();
			setDropdownPosition({
				top: rect.bottom + 4,
				right: window.innerWidth - rect.right,
			});
		}
	}, [showDropdown]);

	// Server-side search with debouncing
	useEffect(() => {
		if (searchDebounceRef.current) {
			clearTimeout(searchDebounceRef.current);
		}

		const query = searchQuery.trim();
		if (!query) {
			setSearchResults([]);
			setIsSearching(false);
			return;
		}

		setIsSearching(true);
		searchDebounceRef.current = setTimeout(async () => {
			try {
				const globalSessionId = `Session:${sessionId}`;
				const result = await fetchQuery<SessionMessagesSearchQuery>(
					environment,
					SessionMessagesSearchQueryDef,
					{ sessionId: globalSessionId, query },
				).toPromise();

				const results =
					(result?.node as { searchMessages?: SearchResult[] })
						?.searchMessages ?? [];
				setSearchResults(results);
			} catch (err) {
				console.error("Search failed:", err);
				setSearchResults([]);
			} finally {
				setIsSearching(false);
			}
		}, 300);

		return () => {
			if (searchDebounceRef.current) {
				clearTimeout(searchDebounceRef.current);
			}
		};
	}, [searchQuery, sessionId, environment]);

	const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
		SessionMessagesPaginationQuery,
		SessionMessages_session$key
	>(SessionMessagesFragment, fragmentRef);

	// Get connection ID for @prependEdge directive
	const connectionId = data?.messages?.__id;

	// Subscription for live updates
	const subscriptionConfig = useMemo<
		GraphQLSubscriptionConfig<SessionMessagesSubscription>
	>(
		() => ({
			subscription: SessionMessagesSubscriptionDef,
			variables: {
				sessionId,
				connections: connectionId ? [connectionId] : [],
			},
			onError: (err: Error) => {
				console.warn("SessionMessages subscription error:", err);
			},
		}),
		[sessionId, connectionId],
	);

	useSubscription<SessionMessagesSubscription>(subscriptionConfig);

	// Get message nodes from edges, filtering out null/undefined
	// DO NOT reverse - inverted VirtualList handles visual order
	const messageNodes = useMemo(
		() =>
			(data?.messages?.edges ?? [])
				.map((edge) => edge?.node)
				.filter(
					(node): node is NonNullable<typeof node> =>
						node != null && node.id != null,
				),
		[data?.messages?.edges],
	);

	// Track message count changes for auto-scroll
	useEffect(() => {
		const currentCount = messageNodes.length;
		const prevCount = prevMessageCountRef.current;

		// New messages arrived (not from pagination loading)
		if (
			currentCount > prevCount &&
			!isLoadingRef.current &&
			isTailingRef.current
		) {
			// Scroll to top (which is visual bottom with inverted list)
			listRef.current?.scrollToTop(true);
		}

		prevMessageCountRef.current = currentCount;
	}, [messageNodes.length]);

	// Load older messages (called when scrolling to the END of inverted list = visual TOP)
	const handleLoadOlder = useCallback(() => {
		if (hasNext && !isLoadingNext && !isPending && !isLoadingRef.current) {
			isLoadingRef.current = true;
			startTransition(() => {
				loadNext(50);
			});
		}
	}, [hasNext, isLoadingNext, isPending, loadNext]);

	// Reset loading flag
	useEffect(() => {
		if (!isLoadingNext && !isPending && isLoadingRef.current) {
			isLoadingRef.current = false;
		}
	}, [isLoadingNext, isPending]);

	// Handle tail state changes from VirtualList
	const handleTailStateChange = useCallback((isTailing: boolean) => {
		isTailingRef.current = isTailing;
	}, []);

	// Jump to a specific message
	const jumpToMessage = useCallback(
		(messageIndex: number, messageId: string) => {
			setHighlightedIndex(messageIndex);
			const element = messageRefs.current.get(messageId);
			if (element) {
				element.scrollIntoView({ behavior: "smooth", block: "center" });
			}
			setShowDropdown(false);
			setSearchQuery("");
			setSelectedResultIndex(0);
		},
		[],
	);

	// Handle search input key events
	const handleSearchKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "ArrowDown" && searchResults.length > 0) {
				e.preventDefault();
				setSelectedResultIndex((prev) =>
					Math.min(prev + 1, searchResults.length - 1),
				);
			}
			if (e.key === "ArrowUp" && searchResults.length > 0) {
				e.preventDefault();
				setSelectedResultIndex((prev) => Math.max(prev - 1, 0));
			}
			if (e.key === "Enter" && searchResults.length > 0) {
				e.preventDefault();
				const result = searchResults[selectedResultIndex];
				jumpToMessage(result.messageIndex, result.messageId);
			}
			if (e.key === "Escape") {
				setSearchQuery("");
				setShowDropdown(false);
				setHighlightedIndex(null);
			}
		},
		[searchResults, selectedResultIndex, jumpToMessage],
	);

	// Render a single message item
	const renderMessage = useCallback(
		(node: NonNullable<(typeof messageNodes)[number]>, index: number) => {
			const isHighlighted = highlightedIndex === index;
			return (
				<Box
					ref={(el: HTMLDivElement | null) => {
						if (el && node.id) messageRefs.current.set(node.id, el);
					}}
					style={{
						paddingVertical: spacing.xs,
						paddingHorizontal: spacing.sm,
						borderRadius: 6,
						borderWidth: isHighlighted ? 2 : 0,
						borderColor: isHighlighted ? colors.accent.primary : "transparent",
						borderStyle: "solid",
						width: "100%",
					}}
				>
					<MessageCard fragmentRef={node} />
				</Box>
			);
		},
		[highlightedIndex],
	);

	return (
		<VStack style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
			{/* Sticky header */}
			<Box
				style={{
					flexShrink: 0,
					backgroundColor: colors.bg.primary,
					padding: spacing.sm,
					paddingLeft: spacing.md,
					paddingRight: spacing.md,
					borderBottom: `1px solid ${colors.border.default}`,
				}}
			>
				<HStack
					gap="sm"
					align="center"
					style={{ justifyContent: "space-between" }}
				>
					<HStack gap="sm" align="center">
						<Text size="sm" style={{ fontWeight: 600 }}>
							Messages ({data?.messageCount ?? 0})
						</Text>
						<Box
							style={{
								width: 8,
								height: 8,
								borderRadius: "50%",
								backgroundColor: "#22c55e",
								boxShadow: "0 0 0 2px rgba(34, 197, 94, 0.3)",
							}}
						/>
					</HStack>

					{/* Search input */}
					<Box ref={searchContainerRef} style={{ position: "relative" }}>
						<HStack gap="xs" align="center">
							<Input
								value={searchQuery}
								onChange={(value) => {
									setSearchQuery(value);
									setShowDropdown(true);
									setSelectedResultIndex(0);
								}}
								placeholder="Jump to message..."
								size="sm"
								style={{ width: 200 }}
								onKeyDown={handleSearchKeyDown}
							/>
							{searchQuery && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setSearchQuery("");
										setShowDropdown(false);
										setHighlightedIndex(null);
									}}
									style={{ padding: 2, minWidth: "auto" }}
								>
									<Text size="sm">×</Text>
								</Button>
							)}
						</HStack>

						{/* Search dropdown - portal for z-index */}
						{showDropdown &&
							searchResults.length > 0 &&
							createPortal(
								<Box
									style={{
										position: "fixed",
										top: dropdownPosition.top,
										right: dropdownPosition.right,
										width: 400,
										maxHeight: 350,
										overflowY: "auto",
										backgroundColor: colors.bg.primary,
										border: `1px solid ${colors.border.default}`,
										borderRadius: 6,
										boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
										zIndex: 10000,
									}}
								>
									{searchResults.map((result, idx) => (
										<Button
											key={result.messageId}
											variant="ghost"
											onClick={() =>
												jumpToMessage(result.messageIndex, result.messageId)
											}
											style={{
												display: "block",
												width: "100%",
												padding: spacing.sm,
												textAlign: "left",
												borderRadius: 0,
												borderBottom:
													idx < searchResults.length - 1
														? `1px solid ${colors.border.subtle}`
														: "none",
												backgroundColor:
													idx === selectedResultIndex
														? colors.bg.tertiary
														: "transparent",
											}}
										>
											<VStack gap="xs" align="flex-start">
												<Text size="xs" color="muted">
													Message #{result.messageIndex + 1}
												</Text>
												<Text
													size="sm"
													style={{
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
														maxWidth: "100%",
													}}
												>
													{result.matchContext || result.preview || "(empty)"}
												</Text>
											</VStack>
										</Button>
									))}
								</Box>,
								document.body,
							)}

						{showDropdown &&
							searchQuery.trim() &&
							searchResults.length === 0 &&
							createPortal(
								<Box
									style={{
										position: "fixed",
										top: dropdownPosition.top,
										right: dropdownPosition.right,
										width: 200,
										padding: spacing.sm,
										backgroundColor: colors.bg.primary,
										border: `1px solid ${colors.border.default}`,
										borderRadius: 6,
										boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
										zIndex: 10000,
									}}
								>
									{isSearching ? (
										<HStack gap="xs" align="center">
											<Spinner />
											<Text size="xs" color="muted">
												Searching...
											</Text>
										</HStack>
									) : (
										<Text size="xs" color="muted">
											No matching messages
										</Text>
									)}
								</Box>,
								document.body,
							)}
					</Box>
				</HStack>
			</Box>

			{/* Scrollable messages list */}
			<VirtualList
				ref={listRef}
				data={messageNodes}
				renderItem={(node, index) => renderMessage(node, index)}
				itemHeight={200}
				inverted
				onEndReached={handleLoadOlder}
				onTailStateChange={handleTailStateChange}
				ListEmptyComponent={
					<Center style={{ height: "100%" }}>
						<Text color="muted">No messages in this session.</Text>
					</Center>
				}
			/>
		</VStack>
	);
}
