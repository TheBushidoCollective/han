/**
 * Search Tab Component
 *
 * Memory search interface with results display.
 * Uses Relay's fetchQuery for imperative search operations.
 */

import { marked } from 'marked';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { graphql } from 'react-relay';
import { fetchQuery } from 'relay-runtime';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Card } from '@/components/atoms/Card.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Input } from '@/components/atoms/Input.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { theme } from '@/components/atoms/theme.ts';
import { VStack } from '@/components/atoms/VStack.tsx';
import { getRelayEnvironment } from '../../../relay/environment.ts';
import type { SearchTabQuery as SearchTabQueryType } from './__generated__/SearchTabQuery.graphql.ts';
import { ConfidenceBadge } from './ConfidenceBadge.tsx';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

const SearchTabQueryDef = graphql`
  query SearchTabQuery($query: String!) {
    memory {
      search(query: $query) {
        answer
        source
        confidence
        caveats
        layersSearched
        citations {
          source
          excerpt
          author
          timestamp
          layer
          projectName
          projectPath
        }
      }
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
  source: string;
  confidence: string;
  caveats: readonly string[];
  layersSearched: readonly string[];
  citations: readonly Citation[];
}

export function SearchTab(): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse markdown answer - memoize to avoid re-parsing on each render
  const renderedAnswer = useMemo(() => {
    if (!result?.answer) return '';
    return marked.parse(result.answer) as string;
  }, [result?.answer]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const environment = getRelayEnvironment();
      const data = await fetchQuery<SearchTabQueryType>(
        environment,
        SearchTabQueryDef,
        { query: searchQuery }
      ).toPromise();

      if (data?.memory?.search) {
        const searchData = data.memory.search;
        setResult({
          answer: searchData.answer ?? '',
          source: searchData.source ?? '',
          confidence: searchData.confidence ?? 'LOW',
          caveats: searchData.caveats ?? [],
          layersSearched: searchData.layersSearched ?? [],
          citations: (searchData.citations ?? []).map((c) => ({
            source: c.source ?? '',
            excerpt: c.excerpt ?? '',
            author: c.author ?? null,
            timestamp: c.timestamp ?? null,
            layer: c.layer ?? null,
            projectName: c.projectName ?? null,
            projectPath: c.projectPath ?? null,
          })),
        });
      } else {
        setResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <VStack gap="lg">
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

      {/* Search result */}
      {result && (
        <Card>
          <VStack gap="lg">
            {/* Result header */}
            <HStack gap="md" align="center" wrap>
              <ConfidenceBadge confidence={result.confidence} />
              <Text size="sm" color="secondary">
                Source: {result.source}
              </Text>
              <Text size="sm" color="muted">
                Searched: {result.layersSearched.join(', ')}
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

            {/* Caveats */}
            {result.caveats.length > 0 && (
              <VStack gap="sm">
                <Heading size="sm" as="h4">
                  Caveats
                </Heading>
                <VStack gap="xs">
                  {result.caveats.map((caveat) => (
                    <HStack key={caveat} gap="sm" align="flex-start">
                      <Text color="muted">-</Text>
                      <Text size="sm" color="secondary">
                        {caveat}
                      </Text>
                    </HStack>
                  ))}
                </VStack>
              </VStack>
            )}

            {/* Citations */}
            {result.citations.length > 0 && (
              <VStack gap="md">
                <Heading size="sm" as="h4">
                  Citations
                </Heading>
                {result.citations.map((citation) => {
                  const excerptKey = citation.excerpt.slice(0, 50);
                  return (
                    <Card
                      key={`${citation.source}:${excerptKey}`}
                      style={{
                        backgroundColor: theme.colors.background.tertiary,
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
              Search your project memory to find information from rules, session
              summaries, observations, and team knowledge.
            </Text>
          </VStack>
        </Card>
      )}
    </VStack>
  );
}
