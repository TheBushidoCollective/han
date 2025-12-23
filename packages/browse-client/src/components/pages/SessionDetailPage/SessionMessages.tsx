/**
 * Session Messages Component
 *
 * Displays messages with backward pagination (load earlier messages).
 * Uses usePaginationFragment for pagination.
 * Uses simple scrollable list for proper variable-height message rendering.
 * Implements smart auto-scroll: scrolls on new messages only if already at bottom.
 */

import type React from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { graphql, usePaginationFragment, useSubscription } from 'react-relay';
import type { GraphQLSubscriptionConfig } from 'relay-runtime';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Center } from '@/components/atoms/Center.tsx';
import { Checkbox } from '@/components/atoms/Checkbox.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import type { SessionMessages_session$key } from './__generated__/SessionMessages_session.graphql.ts';
import type { SessionMessagesPaginationQuery } from './__generated__/SessionMessagesPaginationQuery.graphql.ts';
import type { SessionMessagesSubscription } from './__generated__/SessionMessagesSubscription.graphql.ts';
import { MessageItem } from './components.ts';

/**
 * Pagination fragment for messages (backward pagination - load earlier messages)
 */
const SessionMessagesFragment = graphql`
  fragment SessionMessages_session on Session
  @argumentDefinitions(
    last: { type: "Int", defaultValue: 50 }
    before: { type: "String" }
  )
  @refetchable(queryName: "SessionMessagesPaginationQuery") {
    messageCount
    messages(last: $last, before: $before)
      @connection(key: "SessionMessages_messages") {
      edges {
        node {
          id
          type
          content
          timestamp
          isToolOnly
        }
        cursor
      }
      pageInfo {
        hasPreviousPage
        startCursor
      }
      totalCount
    }
  }
`;

/**
 * Subscription for new messages in this session
 */
const SessionMessagesSubscriptionDef = graphql`
  subscription SessionMessagesSubscription($sessionId: ID!) {
    sessionMessageAdded(sessionId: $sessionId) {
      sessionId
      messageIndex
    }
  }
`;

// Message type for internal use
interface Message {
  id: string;
  type: string | null | undefined;
  content: string | null | undefined;
  timestamp: string | null | undefined;
  isToolOnly: boolean | null | undefined;
}

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
  const [showToolOnly, setShowToolOnly] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [_isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const { data, loadPrevious, hasPrevious, isLoadingPrevious, refetch } =
    usePaginationFragment<
      SessionMessagesPaginationQuery,
      SessionMessages_session$key
    >(SessionMessagesFragment, fragmentRef);

  // Subscription for live updates - refetch when new messages arrive
  const subscriptionConfig = useMemo<
    GraphQLSubscriptionConfig<SessionMessagesSubscription>
  >(
    () => ({
      subscription: SessionMessagesSubscriptionDef,
      variables: { sessionId },
      onNext: (response) => {
        const event = response?.sessionMessageAdded;
        if (event?.sessionId === sessionId) {
          // Refetch to get the new messages
          startTransition(() => {
            refetch({}, { fetchPolicy: 'network-only' });
          });
        }
      },
      onError: (err) => {
        console.warn('SessionMessages subscription error:', err);
      },
    }),
    [sessionId, refetch]
  );

  useSubscription<SessionMessagesSubscription>(subscriptionConfig);

  const messages: Message[] = useMemo(() => {
    const edges = data?.messages?.edges ?? [];
    return edges
      .map((edge) => edge?.node)
      .filter((n) => n !== null && n !== undefined)
      .map((n) => ({
        id: n.id ?? '',
        type: n.type,
        content: n.content,
        timestamp: n.timestamp,
        isToolOnly: n.isToolOnly,
      })) as Message[];
  }, [data?.messages?.edges]);

  const filteredMessages = useMemo(() => {
    if (!messages.length) return [];
    return showToolOnly ? messages : messages.filter((m) => !m.isToolOnly);
  }, [messages, showToolOnly]);

  // Load earlier messages when scrolling to top
  const handleStartReached = useCallback(() => {
    if (hasPrevious && !isLoadingPrevious && !isPending) {
      // Save current scroll state to restore position after load
      if (scrollRef.current) {
        prevScrollHeightRef.current = scrollRef.current.scrollHeight;
        prevScrollTopRef.current = scrollRef.current.scrollTop;
        isLoadingEarlierRef.current = true;
      }
      startTransition(() => {
        loadPrevious(50);
      });
    }
  }, [hasPrevious, isLoadingPrevious, isPending, loadPrevious]);

  // Scroll container ref for auto-scroll behavior
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasInitialScrolledRef = useRef(false);
  const prevMessageCountRef = useRef(filteredMessages.length);
  const prevScrollHeightRef = useRef(0); // Track scroll height before loading
  const prevScrollTopRef = useRef(0); // Track scroll position before loading
  const isFollowingRef = useRef(true); // Track if we're following new messages
  const programmaticScrollRef = useRef(false); // Skip scroll events from programmatic scrolling
  const isLoadingEarlierRef = useRef(false); // Track if we're loading earlier messages
  const firstMessageIdRef = useRef<string | null>(null); // Track first message to detect prepends

  // Check if scrolled to bottom (within threshold)
  const checkIfAtBottom = useCallback(() => {
    if (!scrollRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const threshold = 100; // pixels from bottom to consider "at bottom"
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, []);

  // Scroll to bottom helper with smooth animation
  const scrollToBottom = useCallback((smooth = true) => {
    if (!scrollRef.current) return;
    programmaticScrollRef.current = true;

    if (smooth) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
      // Reset programmatic flag after smooth scroll completes (~300ms)
      setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 350);
    } else {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
    }
  }, []);

  // Scroll to bottom on initial load - use double RAF to ensure DOM is painted
  useEffect(() => {
    if (
      scrollRef.current &&
      filteredMessages.length > 0 &&
      !hasInitialScrolledRef.current
    ) {
      // Mark as scrolled first to prevent re-runs
      hasInitialScrolledRef.current = true;
      // Track the first message for prepend detection
      firstMessageIdRef.current = filteredMessages[0]?.id ?? null;
      // Double requestAnimationFrame to ensure DOM is fully painted
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            setIsAtBottom(true);
            setShowScrollButton(false);
          }
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredMessages.length, filteredMessages[0]?.id]);

  // Handle scroll position after loading earlier messages (useLayoutEffect for synchronous update)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Effect must trigger on message count change for scroll restoration
  useLayoutEffect(() => {
    if (!scrollRef.current || !hasInitialScrolledRef.current) return;

    // If we were loading earlier messages, restore scroll position immediately
    if (isLoadingEarlierRef.current && prevScrollHeightRef.current > 0) {
      const newScrollHeight = scrollRef.current.scrollHeight;
      const scrollDiff = newScrollHeight - prevScrollHeightRef.current;
      // Add the diff to the previous scrollTop to maintain visual position
      const newScrollTop = prevScrollTopRef.current + scrollDiff;
      programmaticScrollRef.current = true;
      scrollRef.current.scrollTop = newScrollTop;
      // Use RAF to reset flag after browser processes the scroll
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
      // Reset loading state
      isLoadingEarlierRef.current = false;
      prevScrollHeightRef.current = 0;
      prevScrollTopRef.current = 0;
    }
  }, [filteredMessages.length]);

  // Handle new messages arriving (auto-scroll if following)
  useEffect(() => {
    if (!scrollRef.current || !hasInitialScrolledRef.current) return;

    const currentFirstId = filteredMessages[0]?.id ?? null;
    const messageCountIncreased =
      filteredMessages.length > prevMessageCountRef.current;

    // Detect if messages were prepended (earlier messages loaded)
    // vs appended (new messages at end)
    const wasPrepend =
      firstMessageIdRef.current !== null &&
      currentFirstId !== firstMessageIdRef.current;

    // Update first message tracking
    firstMessageIdRef.current = currentFirstId;

    // Only auto-scroll if following and not a prepend operation
    if (messageCountIncreased && isFollowingRef.current && !wasPrepend) {
      scrollToBottom();
      setShowScrollButton(false);
    }

    prevMessageCountRef.current = filteredMessages.length;
  }, [filteredMessages.length, filteredMessages, scrollToBottom]);

  // Handle scroll events to track position and load more
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    // Skip if this was a programmatic scroll
    if (programmaticScrollRef.current) return;

    // Don't trigger infinite scroll until initial scroll to bottom is complete
    if (!hasInitialScrolledRef.current) return;

    const { scrollTop } = scrollRef.current;

    // Load more when near top (infinite scroll)
    // Use a larger threshold (500px) for smoother loading experience
    if (scrollTop < 500 && hasPrevious && !isLoadingPrevious && !isPending) {
      handleStartReached();
    }

    // Update bottom tracking
    const atBottom = checkIfAtBottom();
    setIsAtBottom(atBottom);

    // If user scrolled away from bottom, stop following
    if (!atBottom) {
      isFollowingRef.current = false;
      setShowScrollButton(true);
    } else {
      // If user manually scrolled back to bottom, re-enable following
      isFollowingRef.current = true;
      setShowScrollButton(false);
    }
  }, [
    hasPrevious,
    isLoadingPrevious,
    isPending,
    handleStartReached,
    checkIfAtBottom,
  ]);

  // Scroll to bottom button handler
  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
    isFollowingRef.current = true; // Re-enable auto-scroll
    setIsAtBottom(true);
    setShowScrollButton(false);
  }, [scrollToBottom]);

  return (
    <Box
      className="messages-section"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <HStack
        className="messages-header"
        justify="space-between"
        align="center"
        style={{ flexShrink: 0, marginBottom: '0.5rem' }}
      >
        <HStack gap="sm" align="center">
          <Heading size="sm" as="h3">
            Messages ({data?.messageCount ?? 0})
          </Heading>
          {isLive && (
            <span
              className="live-indicator-dot"
              title="Live - receiving updates"
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#22c55e',
                boxShadow: '0 0 0 2px rgba(34, 197, 94, 0.3)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          )}
        </HStack>
        <Checkbox
          checked={showToolOnly}
          onChange={(checked) => setShowToolOnly(checked)}
        >
          Show tool-only messages
        </Checkbox>
      </HStack>
      <Box
        ref={scrollRef}
        className="messages-list"
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          // Disable browser scroll anchoring - we manage scroll position manually
          overflowAnchor: 'none',
        }}
      >
        {/* Loading indicator for infinite scroll */}
        {(isLoadingPrevious || isPending) && (
          <Center style={{ padding: '1rem' }}>
            <Spinner />
          </Center>
        )}
        {/* Scroll up indicator when more messages available */}
        {hasPrevious && !isLoadingPrevious && !isPending && (
          <Center style={{ padding: '0.5rem' }}>
            <Text size="xs" color="muted">
              ↑ Scroll up for earlier messages
            </Text>
          </Center>
        )}
        {filteredMessages.length === 0 ? (
          <Center className="empty-state">
            <Text color="muted">No messages in this session.</Text>
          </Center>
        ) : (
          filteredMessages.map((message) => (
            <Box key={message.id} style={{ marginBottom: '2px' }}>
              <MessageItem
                message={{
                  id: message.id,
                  type: (['USER', 'ASSISTANT', 'SUMMARY'].includes(
                    message.type ?? ''
                  )
                    ? message.type
                    : 'USER') as 'USER' | 'ASSISTANT' | 'SUMMARY',
                  content: message.content ?? '',
                  timestamp: message.timestamp ?? '',
                  isToolOnly: message.isToolOnly ?? false,
                }}
                sessionId={sessionId}
              />
            </Box>
          ))
        )}
      </Box>
      {/* Scroll to bottom button - floating outside scroll container */}
      {showScrollButton && (
        <Button
          variant="primary"
          size="sm"
          onClick={handleScrollToBottom}
          style={{
            position: 'absolute',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          ↓ Scroll to Bottom
        </Button>
      )}
    </Box>
  );
}
