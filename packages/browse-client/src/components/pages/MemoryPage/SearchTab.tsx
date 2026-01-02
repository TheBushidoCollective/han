/**
 * Search Tab Component
 *
 * Memory search interface with live streaming from Memory Agent.
 * Uses GraphQL mutations to start queries and subscriptions for live progress.
 */

import { marked } from 'marked';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { graphql, useMutation, useSubscription } from 'react-relay';
import { theme } from '@/components/atoms';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Card } from '@/components/atoms/Card.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Input } from '@/components/atoms/Input.tsx';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { SearchTabProgressSubscription } from './__generated__/SearchTabProgressSubscription.graphql.ts';
import type { SearchTabResultSubscription } from './__generated__/SearchTabResultSubscription.graphql.ts';
import type { SearchTabStartMutation } from './__generated__/SearchTabStartMutation.graphql.ts';
import { ConfidenceBadge } from './ConfidenceBadge.tsx';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Mutation to start a memory query - returns session ID for subscriptions
const StartMemoryQueryMutation = graphql`
  mutation SearchTabStartMutation($question: String!, $projectPath: String!, $model: String) {
    startMemoryQuery(question: $question, projectPath: $projectPath, model: $model) {
      sessionId
      success
      message
    }
  }
`;

// Subscription for progress updates during memory search
const MemoryProgressSubscription = graphql`
  subscription SearchTabProgressSubscription($sessionId: String!) {
    memoryAgentProgress(sessionId: $sessionId) {
      sessionId
      type
      layer
      content
      resultCount
      timestamp
    }
  }
`;

// Subscription for final result from Memory Agent
const MemoryResultSubscription = graphql`
  subscription SearchTabResultSubscription($sessionId: String!) {
    memoryAgentResult(sessionId: $sessionId) {
      sessionId
      answer
      confidence
      citations {
        source
        excerpt
        author
        timestamp
        layer
        projectName
        projectPath
      }
      searchedLayers
      success
      error
    }
  }
`;

interface Citation {
  source: string;
  excerpt: string;
  author: string | null;
  timestamp: string | null;
  layer: string | null;
  projectName: string | null;
  projectPath: string | null;
}

interface SearchResult {
  answer: string;
  confidence: string;
  searchedLayers: readonly string[];
  citations: readonly Citation[];
}

interface ProgressUpdate {
  type: string;
  content: string;
  layer?: string;
  resultCount?: number;
  timestamp?: string;
}

/**
 * Progress subscription component - only mounted when we have a sessionId
 * This ensures the subscription is only active when we have a valid session.
 */
function MemoryProgressSubscriber({
  sessionId,
  onProgress,
}: {
  sessionId: string;
  onProgress: (update: ProgressUpdate) => void;
}): null {
  useSubscription<SearchTabProgressSubscription>({
    subscription: MemoryProgressSubscription,
    variables: { sessionId },
    onNext: (response) => {
      if (response?.memoryAgentProgress) {
        const progress = response.memoryAgentProgress;
        onProgress({
          type: progress.type ?? 'UNKNOWN',
          content: progress.content ?? '',
          layer: progress.layer ?? undefined,
          resultCount: progress.resultCount ?? undefined,
          timestamp: progress.timestamp ?? undefined,
        });
      }
    },
    onError: (err) => {
      console.error('Progress subscription error:', err);
    },
  });
  return null;
}

/**
 * Result subscription component - only mounted when we have a sessionId
 * This ensures the subscription is only active when we have a valid session.
 */
function MemoryResultSubscriber({
  sessionId,
  onResult,
  onError,
}: {
  sessionId: string;
  onResult: (result: SearchResult) => void;
  onError: (error: string) => void;
}): null {
  useSubscription<SearchTabResultSubscription>({
    subscription: MemoryResultSubscription,
    variables: { sessionId },
    onNext: (response) => {
      if (response?.memoryAgentResult) {
        const agentResult = response.memoryAgentResult;

        if (agentResult.success) {
          onResult({
            answer: agentResult.answer ?? '',
            confidence: agentResult.confidence ?? 'LOW',
            searchedLayers: agentResult.searchedLayers ?? [],
            citations: (agentResult.citations ?? []).map((c) => ({
              source: c?.source ?? '',
              excerpt: c?.excerpt ?? '',
              author: c?.author ?? null,
              timestamp: c?.timestamp ?? null,
              layer: c?.layer ?? null,
              projectName: c?.projectName ?? null,
              projectPath: c?.projectPath ?? null,
            })),
          });
        } else {
          onError(agentResult.error ?? 'Search failed');
        }
      }
    },
    onError: (err) => {
      console.error('Result subscription error:', err);
      onError('Failed to get results');
    },
  });
  return null;
}

interface SearchTabProps {
  projectPath: string;
}

export function SearchTab({ projectPath }: SearchTabProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mutation hook to start memory query
  const [commitMutation] = useMutation<SearchTabStartMutation>(
    StartMemoryQueryMutation
  );

  // Track when first progress was received for minimum display time
  const firstProgressTime = useRef<number | null>(null);
  const pendingResult = useRef<SearchResult | null>(null);

  // Callbacks for subscription components
  const handleProgress = useCallback((update: ProgressUpdate) => {
    console.log('[SearchTab] Progress received:', update.type, update.content);

    // Track when first progress arrives
    if (firstProgressTime.current === null) {
      firstProgressTime.current = Date.now();
    }

    setProgressUpdates((prev) => [...prev, update]);

    // If we receive a 'complete' or 'error' progress type, treat it as a fallback signal
    // that the search is done (in case result subscription doesn't fire)
    if (update.type === 'error') {
      setError(update.content || 'Search failed');
      setLoading(false);
    }
  }, []);

  const handleResult = useCallback((searchResult: SearchResult) => {
    console.log(
      '[SearchTab] Result received:',
      searchResult.answer?.slice(0, 50),
      'confidence:',
      searchResult.confidence
    );

    // Ensure progress is visible for at least 1 second before showing result
    const minDisplayTime = 1000;
    const elapsed = firstProgressTime.current
      ? Date.now() - firstProgressTime.current
      : 0;
    const remaining = Math.max(0, minDisplayTime - elapsed);

    if (remaining > 0) {
      console.log(
        `[SearchTab] Delaying result by ${remaining}ms for progress visibility`
      );
      pendingResult.current = searchResult;
      setTimeout(() => {
        setResult(pendingResult.current);
        setLoading(false);
        firstProgressTime.current = null;
        pendingResult.current = null;
      }, remaining);
    } else {
      setResult(searchResult);
      setLoading(false);
      firstProgressTime.current = null;
    }
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setLoading(false);
  }, []);

  // Parse markdown answer - memoize to avoid re-parsing on each render
  const renderedAnswer = useMemo(() => {
    if (!result?.answer) return '';
    return marked.parse(result.answer) as string;
  }, [result?.answer]);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;

    console.log('[SearchTab] Starting search for:', searchQuery);

    // Reset state for new search
    setLoading(true);
    setError(null);
    setResult(null);
    firstProgressTime.current = null;
    pendingResult.current = null;
    setProgressUpdates([]);
    setSessionId(null);

    // Start the memory query via mutation
    commitMutation({
      variables: {
        question: searchQuery,
        projectPath,
        model: 'haiku', // Fast model for responsiveness
      },
      onCompleted: (response) => {
        console.log(
          '[SearchTab] Mutation completed:',
          response.startMemoryQuery
        );
        if (
          response.startMemoryQuery?.success &&
          response.startMemoryQuery.sessionId
        ) {
          // Set session ID to activate subscriptions
          console.log(
            '[SearchTab] Setting sessionId:',
            response.startMemoryQuery.sessionId
          );
          setSessionId(response.startMemoryQuery.sessionId);

          // Set a timeout to prevent infinite loading state
          // If no result comes within 30 seconds, show an error
          setTimeout(() => {
            setLoading((isLoading) => {
              if (isLoading) {
                setError('Search timed out. Please try again.');
                return false;
              }
              return isLoading;
            });
          }, 30000);
        } else {
          setError(
            response.startMemoryQuery?.message ?? 'Failed to start search'
          );
          setLoading(false);
        }
      },
      onError: (err) => {
        setError(err.message);
        setLoading(false);
      },
    });
  }, [searchQuery, projectPath, commitMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Get badge variant for progress type
  const getProgressBadgeVariant = (
    type: string
  ): 'info' | 'success' | 'warning' | 'purple' | 'default' => {
    switch (type) {
      case 'SEARCHING':
        return 'info';
      case 'FOUND':
        return 'success';
      case 'SYNTHESIZING':
        return 'purple';
      case 'COMPLETE':
        return 'success';
      case 'ERROR':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <VStack gap="lg">
      {/* Subscription components - only render when we have a sessionId */}
      {sessionId && (
        <>
          <MemoryProgressSubscriber
            sessionId={sessionId}
            onProgress={handleProgress}
          />
          <MemoryResultSubscriber
            sessionId={sessionId}
            onResult={handleResult}
            onError={handleError}
          />
        </>
      )}

      {/* Search bar */}
      <HStack gap="md">
        <Box style={{ flex: 1 }}>
          <Input
            placeholder="Ask a question about your projects..."
            value={searchQuery}
            onChange={setSearchQuery}
            onKeyDown={handleKeyDown}
            style={{ width: '100%' }}
          />
        </Box>
        <Button
          variant="primary"
          onClick={handleSearch}
          disabled={loading || !searchQuery.trim()}
        >
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </HStack>

      {/* Error state */}
      {error && (
        <Card>
          <Text color="secondary">{error}</Text>
        </Card>
      )}

      {/* Live progress updates */}
      {loading && progressUpdates.length > 0 && (
        <Card>
          <VStack gap="sm">
            <HStack gap="sm" align="center">
              <Spinner size="sm" />
              <Heading size="sm" as="h4">
                Memory Agent Progress
              </Heading>
            </HStack>
            {progressUpdates.map((update, index) => (
              <HStack
                key={`${update.type}-${index}`}
                gap="sm"
                align="center"
                wrap
              >
                <Badge variant={getProgressBadgeVariant(update.type)}>
                  {update.type}
                </Badge>
                <Text size="sm" color="secondary">
                  {update.content}
                </Text>
                {update.layer && (
                  <Badge variant="default">{update.layer}</Badge>
                )}
                {update.resultCount !== undefined && (
                  <Text size="xs" color="muted">
                    ({update.resultCount} results)
                  </Text>
                )}
              </HStack>
            ))}
          </VStack>
        </Card>
      )}

      {/* Loading state without progress */}
      {loading && progressUpdates.length === 0 && (
        <Card>
          <VStack gap="md" align="center" style={{ padding: theme.spacing.lg }}>
            <Spinner size="lg" />
            <Text color="secondary">Starting Memory Agent...</Text>
            <Text size="xs" color="muted">
              Searching rules, transcripts, and team memory...
            </Text>
          </VStack>
        </Card>
      )}

      {/* Search result */}
      {result && (
        <Card>
          <VStack gap="lg">
            {/* Result header */}
            <HStack gap="md" align="center" wrap>
              <ConfidenceBadge confidence={result.confidence} />
              <Text size="sm" color="muted">
                Searched: {result.searchedLayers.join(', ')}
              </Text>
            </HStack>

            {/* Answer */}
            <VStack gap="sm">
              <Heading size="sm" as="h3">
                Answer
              </Heading>
              <div
                className="markdown-content"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendering
                dangerouslySetInnerHTML={{ __html: renderedAnswer }}
              />
            </VStack>

            {/* Citations */}
            {result.citations.length > 0 && (
              <VStack gap="md">
                <Heading size="sm" as="h4">
                  Citations
                </Heading>
                {result.citations.map((citation, index) => {
                  const excerptKey = citation.excerpt.slice(0, 50);
                  return (
                    <Card
                      key={`${citation.source}:${excerptKey}:${index}`}
                      style={{
                        backgroundColor: theme.colors.bg.tertiary,
                      }}
                    >
                      <VStack gap="sm">
                        <HStack gap="sm" align="center" wrap>
                          {citation.projectName && (
                            <span title={citation.projectPath ?? undefined}>
                              <Badge variant="info">
                                {citation.projectName}
                              </Badge>
                            </span>
                          )}
                          <Badge variant="purple">{citation.source}</Badge>
                          {citation.layer && (
                            <Badge variant="default">{citation.layer}</Badge>
                          )}
                          {citation.author && (
                            <Text size="xs" color="muted">
                              by {citation.author}
                            </Text>
                          )}
                        </HStack>
                        <div
                          className="markdown-content"
                          style={{
                            borderLeft: `2px solid ${theme.colors.border.default}`,
                            paddingLeft: theme.spacing.md,
                            fontSize: theme.fontSize.sm,
                            color: theme.colors.text.secondary,
                          }}
                          // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendering
                          dangerouslySetInnerHTML={{
                            __html: marked.parse(citation.excerpt) as string,
                          }}
                        />
                      </VStack>
                    </Card>
                  );
                })}
              </VStack>
            )}
          </VStack>
        </Card>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <Card>
          <VStack gap="sm" align="center" style={{ padding: theme.spacing.lg }}>
            <Text color="secondary">
              Search your project memory using the Memory Agent. It searches
              rules, session transcripts, and team knowledge to synthesize
              answers with citations.
            </Text>
          </VStack>
        </Card>
      )}
    </VStack>
  );
}
