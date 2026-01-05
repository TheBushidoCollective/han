/**
 * Message Detail Page Component
 *
 * Displays a single message by its UUID.
 * Uses the message query to fetch by UUID directly.
 */

import type { CSSProperties } from 'react';
import React, { Component, Suspense } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import { useParams } from 'react-router-dom';
import { MessageCard } from '@/components/pages/SessionDetailPage/MessageCards';
import { colors } from '@/theme';
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
        <div style={{ padding: '2rem', color: 'red' }}>
          <h2>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {this.state.error?.message}
          </pre>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '12px',
              marginTop: '1rem',
            }}
          >
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles: Record<string, CSSProperties> = {
  container: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.muted,
  },
  backLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: colors.text.accent,
    textDecoration: 'none',
    marginBottom: 16,
    fontSize: 14,
    cursor: 'pointer',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    color: colors.text.muted,
  },
  error: {
    padding: 24,
    textAlign: 'center' as const,
    color: colors.danger,
  },
  notFound: {
    padding: 48,
    textAlign: 'center' as const,
    color: colors.text.muted,
  },
};

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
      <div style={styles.notFound}>
        <h2>Message Not Found</h2>
        <p>The message with ID "{messageId}" could not be found.</p>
      </div>
    );
  }

  return (
    <div>
      <MessageCard fragmentRef={data.message} />
    </div>
  );
}

export function MessageDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div style={styles.error}>
        <p>No message ID provided.</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div style={styles.container}>
        <div style={styles.header}>
          <a href="/" style={styles.backLink}>
            Back to Dashboard
          </a>
          <h1 style={styles.title}>Message Detail</h1>
          <p style={styles.subtitle}>ID: {id}</p>
        </div>

        <Suspense
          fallback={<div style={styles.loading}>Loading message...</div>}
        >
          <MessageContent messageId={id} />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}

export default MessageDetailPage;
