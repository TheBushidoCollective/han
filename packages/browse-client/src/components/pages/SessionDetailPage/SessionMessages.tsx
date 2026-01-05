/**
 * Session Messages Component
 *
 * Displays messages with backward pagination (load earlier messages).
 * Uses usePaginationFragment for pagination.
 * Uses column-reverse for natural scroll-to-bottom behavior.
 */

import type React from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { createPortal } from 'react-dom';
import {
  graphql,
  usePaginationFragment,
  useRelayEnvironment,
  useSubscription,
} from 'react-relay';
import { fetchQuery, type GraphQLSubscriptionConfig } from 'relay-runtime';
import { Center } from '@/components/atoms/Center.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { colors, spacing } from '@/theme.ts';
import type { SessionMessages_session$key } from './__generated__/SessionMessages_session.graphql.ts';
import type { SessionMessagesPaginationQuery } from './__generated__/SessionMessagesPaginationQuery.graphql.ts';
import type { SessionMessagesSearchQuery } from './__generated__/SessionMessagesSearchQuery.graphql.ts';
import type { SessionMessagesSubscription } from './__generated__/SessionMessagesSubscription.graphql.ts';
import { MessageCard } from './MessageCards/index.tsx';

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
 * Uses column-reverse so newest messages appear at the bottom.
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
 * Uses @appendEdge to add new messages to the connection.
 *
 * NOTE ON ORDERING (may seem backwards but is correct):
 * - API returns messages in DESC order (newest first)
 * - CSS column-reverse displays items bottom-to-top
 * - So: FIRST item in array = BOTTOM of visual display = newest message
 * - New messages need to appear at the BOTTOM (as newest)
 * - @appendEdge adds to END of Relay's connection edges
 * - With column-reverse, END of edges = TOP visually... BUT
 * - Relay connections with forward pagination (first/after) append new items
 *   at the logical "end" which with DESC data means they appear correctly
 */
const SessionMessagesSubscriptionDef = graphql`
  subscription SessionMessagesSubscription(
    $sessionId: ID!
    $connections: [ID!]!
  ) {
    sessionMessageAdded(sessionId: $sessionId) {
      sessionId
      messageIndex
      newMessageEdge @appendEdge(connections: $connections) {
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
  isLive: boolean;
}

export function SessionMessages({
  fragmentRef,
  sessionId,
  isLive,
}: SessionMessagesProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState('');
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const environment = useRelayEnvironment();

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
        // Build the global ID for the session
        // The format matches what the server expects
        const globalSessionId = `Session:${sessionId}`;
        const result = await fetchQuery<SessionMessagesSearchQuery>(
          environment,
          SessionMessagesSearchQueryDef,
          { sessionId: globalSessionId, query }
        ).toPromise();

        const results =
          (result?.node as { searchMessages?: SearchResult[] })
            ?.searchMessages ?? [];
        setSearchResults(results);
      } catch (err) {
        console.error('Search failed:', err);
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

  // Get connection ID for @appendEdge directive
  // The connection ID is the __id of the messages connection
  const connectionId = data?.messages?.__id;

  // Subscription for live updates - uses @appendEdge to add new messages without refetching
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
        console.warn('SessionMessages subscription error:', err);
      },
    }),
    [sessionId, connectionId]
  );

  useSubscription<SessionMessagesSubscription>(subscriptionConfig);

  // Get message nodes from edges, filtering out null/undefined
  // API returns newest-first (DESC), reverse to show oldest-first (newest at bottom)
  const messageNodes = (data?.messages?.edges ?? [])
    .map((edge) => edge?.node)
    .filter(
      (node): node is NonNullable<typeof node> =>
        node != null && node.id != null
    )
    .reverse();

  // Refs for scroll container and load more trigger
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);
  const prevScrollHeightRef = useRef<number>(0);

  // Load older messages when scrolling up (forward pagination through DESC list)
  // Preserves scroll position by recording scroll height before load
  const handleLoadMore = useCallback(() => {
    if (hasNext && !isLoadingNext && !isPending && !isLoadingRef.current) {
      isLoadingRef.current = true;
      // Record scroll height before loading
      if (scrollRef.current) {
        prevScrollHeightRef.current = scrollRef.current.scrollHeight;
      }
      startTransition(() => {
        loadNext(50);
      });
    }
  }, [hasNext, isLoadingNext, isPending, loadNext]);

  // Restore scroll position after loading older messages
  useEffect(() => {
    if (!isLoadingNext && !isPending && isLoadingRef.current) {
      isLoadingRef.current = false;
      const scrollEl = scrollRef.current;
      if (scrollEl && prevScrollHeightRef.current > 0) {
        // Calculate new scroll position to maintain view
        const newScrollHeight = scrollEl.scrollHeight;
        const heightDiff = newScrollHeight - prevScrollHeightRef.current;
        if (heightDiff > 0) {
          scrollEl.scrollTop += heightDiff;
        }
        prevScrollHeightRef.current = 0;
      }
    }
  }, [isLoadingNext, isPending]);

  // Scroll to bottom on initial load only
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (
      !hasInitializedRef.current &&
      bottomRef.current &&
      messageNodes.length > 0
    ) {
      hasInitializedRef.current = true;
      bottomRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [messageNodes.length]);

  // Jump to a specific message by index
  // The index comes from the server-side FTS search (lineNumber)
  const jumpToMessage = useCallback(
    (messageIndex: number, messageId: string) => {
      setHighlightedIndex(messageIndex);
      // Try to find the message in already-loaded messages
      const element = messageRefs.current.get(messageId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // Message not loaded yet - we'd need to load more messages
        // For now, just highlight and let the user know
        console.log(
          `Message ${messageId} at index ${messageIndex} not yet loaded`
        );
      }
      setShowDropdown(false);
      setSearchQuery('');
      setSelectedResultIndex(0);
    },
    []
  );

  // Intersection observer for infinite scroll - triggers when "load older" element is visible
  // Only triggers if not already loading
  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !hasNext) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingRef.current) {
          handleLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNext, handleLoadMore]);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Sticky header at top */}
      <div
        style={{
          flexShrink: 0,
          backgroundColor: colors.bg.primary,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
          paddingLeft: spacing.md,
          paddingRight: spacing.md,
          borderBottom: `1px solid ${colors.border.default}`,
        }}
      >
        <HStack
          gap="sm"
          align="center"
          style={{ justifyContent: 'space-between' }}
        >
          <HStack gap="sm" align="center">
            <Text size="sm" style={{ fontWeight: 600 }}>
              Messages ({data?.messageCount ?? 0})
            </Text>
            {isLive && (
              <span
                title="Live - receiving updates"
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  boxShadow: '0 0 0 2px rgba(34, 197, 94, 0.3)',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
            )}
          </HStack>
          <div ref={searchContainerRef} style={{ position: 'relative' }}>
            <HStack gap="xs" align="center">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Jump to message..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  setSelectedResultIndex(0);
                }}
                onFocus={() => {
                  if (searchQuery.trim()) setShowDropdown(true);
                }}
                onBlur={() => {
                  // Delay to allow click on dropdown item
                  setTimeout(() => setShowDropdown(false), 150);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' && searchResults.length > 0) {
                    e.preventDefault();
                    setSelectedResultIndex((prev) =>
                      Math.min(prev + 1, searchResults.length - 1)
                    );
                  }
                  if (e.key === 'ArrowUp' && searchResults.length > 0) {
                    e.preventDefault();
                    setSelectedResultIndex((prev) => Math.max(prev - 1, 0));
                  }
                  if (e.key === 'Enter' && searchResults.length > 0) {
                    e.preventDefault();
                    const result = searchResults[selectedResultIndex];
                    jumpToMessage(result.messageIndex, result.messageId);
                  }
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    setShowDropdown(false);
                    setHighlightedIndex(null);
                  }
                }}
                style={{
                  padding: `${spacing.xs}px ${spacing.sm}px`,
                  fontSize: 12,
                  backgroundColor: colors.bg.secondary,
                  border: `1px solid ${colors.border.subtle}`,
                  borderRadius: 4,
                  color: colors.text.primary,
                  width: 200,
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setShowDropdown(false);
                    setHighlightedIndex(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: colors.text.muted,
                    fontSize: 14,
                    padding: 2,
                  }}
                >
                  ×
                </button>
              )}
            </HStack>
            {/* Autocomplete dropdown - rendered via portal to avoid z-index clipping */}
            {showDropdown &&
              searchResults.length > 0 &&
              createPortal(
                <div
                  style={{
                    position: 'fixed',
                    top: dropdownPosition.top,
                    right: dropdownPosition.right,
                    width: 400,
                    maxHeight: 350,
                    overflowY: 'auto',
                    backgroundColor: colors.bg.primary,
                    border: `1px solid ${colors.border.default}`,
                    borderRadius: 6,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                    zIndex: 10000,
                  }}
                >
                  {searchResults.map((result, resultIdx) => (
                    <button
                      key={result.messageId}
                      type="button"
                      onClick={() =>
                        jumpToMessage(result.messageIndex, result.messageId)
                      }
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: `${spacing.sm}px ${spacing.md}px`,
                        textAlign: 'left',
                        border: 'none',
                        borderBottom:
                          resultIdx < searchResults.length - 1
                            ? `1px solid ${colors.border.subtle}`
                            : 'none',
                        backgroundColor:
                          resultIdx === selectedResultIndex
                            ? colors.bg.tertiary
                            : 'transparent',
                        cursor: 'pointer',
                        color: colors.text.primary,
                      }}
                      onMouseEnter={() => setSelectedResultIndex(resultIdx)}
                    >
                      <Text size="xs" color="muted" style={{ marginBottom: 2 }}>
                        Message #{result.messageIndex + 1}
                      </Text>
                      <span
                        style={{
                          fontSize: 12,
                          lineHeight: 1.4,
                          color: colors.text.primary,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {result.matchContext || result.preview || '(empty)'}
                      </span>
                    </button>
                  ))}
                </div>,
                document.body
              )}
            {showDropdown &&
              searchQuery.trim() &&
              searchResults.length === 0 &&
              createPortal(
                <div
                  style={{
                    position: 'fixed',
                    top: dropdownPosition.top,
                    right: dropdownPosition.right,
                    width: 200,
                    padding: spacing.sm,
                    backgroundColor: colors.bg.primary,
                    border: `1px solid ${colors.border.default}`,
                    borderRadius: 6,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
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
                </div>,
                document.body
              )}
          </div>
          <style>
            {`
              @keyframes pulse {
                0%, 100% {
                  opacity: 1;
                  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3);
                }
                50% {
                  opacity: 0.6;
                  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2);
                }
              }
            `}
          </style>
        </HStack>
      </div>

      {/* Scrollable messages area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: 0,
        }}
      >
        {messageNodes.length === 0 ? (
          <Center style={{ padding: spacing.xl }}>
            <Text color="muted">No messages in this session.</Text>
          </Center>
        ) : (
          <>
            {/* Load more trigger at top */}
            {hasNext && (
              <div ref={loadMoreRef}>
                <Center style={{ padding: spacing.md }}>
                  {isLoadingNext || isPending ? (
                    <Spinner />
                  ) : (
                    <Text size="xs" color="muted">
                      ↑ Scroll up to load older messages
                    </Text>
                  )}
                </Center>
              </div>
            )}

            {/* Messages in chronological order (oldest first) */}
            <div style={{ padding: spacing.md, paddingTop: 0 }}>
              {messageNodes.map((node, idx) => {
                const isHighlighted = highlightedIndex === idx;
                return (
                  <div
                    key={node.id ?? idx}
                    ref={(el) => {
                      if (el && node.id) messageRefs.current.set(node.id, el);
                    }}
                    style={{
                      marginBottom: spacing.sm,
                      borderRadius: 6,
                      outline: isHighlighted
                        ? `2px solid ${colors.accent.primary}`
                        : 'none',
                      outlineOffset: 2,
                    }}
                  >
                    <MessageCard fragmentRef={node} />
                  </div>
                );
              })}
            </div>

            {/* Bottom anchor for scroll-to-bottom */}
            <div ref={bottomRef} style={{ height: spacing.md }} />
          </>
        )}
      </div>
    </div>
  );
}
