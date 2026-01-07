/**
 * Message Detail Page Component
 *
 * Displays a single message by its UUID.
 * Uses the message query to fetch by UUID directly.
 */

import React, { Component, Suspense } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import { useNavigate, useParams } from 'react-router-dom';
import { Box } from '@/components/atoms/Box.tsx';
import { Center } from '@/components/atoms/Center.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { Pressable } from '@/components/atoms/Pressable.tsx';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { MessageCard } from '@/components/pages/SessionDetailPage/MessageCards';
import { colors, fonts, spacing } from '@/theme';
import type { MessageDetailPageQuery } from './__generated__/MessageDetailPageQuery.graphql.ts';

// Error boundary to catch and display errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('MessageDetailPage error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box style={{ padding: spacing.lg }}>
          <Heading
            size="md"
            style={{ color: colors.danger, marginBottom: spacing.sm }}
          >
            Something went wrong
          </Heading>
          <Box
            style={{
              fontFamily: fonts.mono,
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: colors.danger,
            }}
          >
            <Text>{this.state.error?.message}</Text>
          </Box>
          <Box
            style={{
              fontFamily: fonts.mono,
              fontSize: 10,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginTop: spacing.md,
              color: colors.text.muted,
            }}
          >
            <Text size="xs">{this.state.error?.stack}</Text>
          </Box>
        </Box>
      );
    }
    return this.props.children;
  }
}

const MessageDetailPageQueryDef = graphql`
  query MessageDetailPageQuery($id: String!) {
    message(id: $id) {
      uuid
      timestamp
      ...MessageCards_message
    }
  }
`;

function MessageContent({ messageId }: { messageId: string }) {
  const data = useLazyLoadQuery<MessageDetailPageQuery>(
    MessageDetailPageQueryDef,
    {
      id: messageId,
    }
  );

  if (!data.message) {
    return (
      <Center style={{ padding: spacing.xl }}>
        <VStack gap="md" align="center">
          <Heading size="md">Message Not Found</Heading>
          <Text color="muted">
            The message with ID "{messageId}" could not be found.
          </Text>
        </VStack>
      </Center>
    );
  }

  return <MessageCard fragmentRef={data.message} />;
}

export function MessageDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <Center style={{ padding: spacing.lg }}>
        <Text color="danger">No message ID provided.</Text>
      </Center>
    );
  }

  return (
    <ErrorBoundary>
      <Box style={{ padding: spacing.lg }}>
        <VStack gap="md" align="stretch">
          <Pressable
            onPress={() => navigate('/')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
            }}
          >
            <Text color="accent">Back to Dashboard</Text>
          </Pressable>

          <Heading size="lg">Message Detail</Heading>
          <Text size="sm" color="muted" style={{ fontFamily: fonts.mono }}>
            ID: {id}
          </Text>

          <Suspense
            fallback={
              <Center style={{ minHeight: 200 }}>
                <Spinner />
              </Center>
            }
          >
            <MessageContent messageId={id} />
          </Suspense>
        </VStack>
      </Box>
    </ErrorBoundary>
  );
}

export default MessageDetailPage;
