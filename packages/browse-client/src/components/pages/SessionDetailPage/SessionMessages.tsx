/**
 * Session Messages Component
 *
 * Displays messages with backward pagination (load earlier messages).
 * Uses usePaginationFragment for pagination.
 * Uses column-reverse for natural scroll-to-bottom behavior.
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useTransition } from 'react';
import { graphql, usePaginationFragment, useSubscription } from 'react-relay';
import type { GraphQLSubscriptionConfig } from 'relay-runtime';
import { Center } from '@/components/atoms/Center.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { colors, spacing } from '@/theme.ts';
import type { SessionMessages_session$key } from './__generated__/SessionMessages_session.graphql.ts';
import type { SessionMessagesPaginationQuery } from './__generated__/SessionMessagesPaginationQuery.graphql.ts';
import type { SessionMessagesSubscription } from './__generated__/SessionMessagesSubscription.graphql.ts';
import { MessageCard } from './MessageCards/index.tsx';

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
      onError: (err) => {
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
              }}
            />
          )}
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
              {messageNodes.map((node) => (
                <div key={node.id} style={{ marginBottom: spacing.sm }}>
                  <MessageCard fragmentRef={node} />
                </div>
              ))}
            </div>

            {/* Bottom anchor for scroll-to-bottom */}
            <div ref={bottomRef} style={{ height: spacing.md }} />
          </>
        )}
      </div>
    </div>
  );
}
