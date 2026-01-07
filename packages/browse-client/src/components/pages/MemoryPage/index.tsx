/**
 * Memory Page
 *
 * Search memory and browse rules.
 * Uses useParams to get optional projectId/repoId from URL.
 * When in project context, queries for the project path needed for memory search.
 */

import type React from 'react';
import { Suspense, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import { useParams } from 'react-router-dom';
import { theme } from '@/components/atoms';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { MemoryPageRepoQuery as MemoryPageRepoQueryType } from './__generated__/MemoryPageRepoQuery.graphql.ts';
import { RulesTab, SearchTab, type Tab, TabButton } from './components.ts';

/**
 * Query to get repo path for memory search
 */
const MemoryPageRepoQueryDef = graphql`
  query MemoryPageRepoQuery($repoId: String!) {
    repo(id: $repoId) {
      path
    }
  }
`;

/**
 * Memory page content for project/repo scope
 */
function ProjectMemoryContent({
  repoId,
}: {
  repoId: string;
}): React.ReactElement {
  const data = useLazyLoadQuery<MemoryPageRepoQueryType>(
    MemoryPageRepoQueryDef,
    { repoId },
    { fetchPolicy: 'store-and-network' }
  );

  const [activeTab, setActiveTab] = useState<Tab>('search');

  const projectPath = data.repo?.path;

  if (!projectPath) {
    return (
      <VStack gap="md" style={{ padding: theme.spacing.xl }}>
        <Heading size="md">Not Found</Heading>
        <Text color="secondary">Repository not found: {repoId}</Text>
      </VStack>
    );
  }

  return (
    <VStack gap="lg" style={{ padding: theme.spacing.xl }}>
      {/* Header */}
      <HStack justify="space-between" align="center">
        <Heading size="lg">Project Memory</Heading>
        <HStack gap="sm">
          <TabButton
            active={activeTab === 'search'}
            onClick={() => setActiveTab('search')}
          >
            Search
          </TabButton>
          <TabButton
            active={activeTab === 'rules'}
            onClick={() => setActiveTab('rules')}
          >
            Rules
          </TabButton>
        </HStack>
      </HStack>

      {/* Tab content */}
      {activeTab === 'search' ? (
        <SearchTab projectPath={projectPath} />
      ) : (
        <RulesTab scopeFilter="PROJECT" />
      )}
    </VStack>
  );
}

/**
 * Memory page content for global/user scope (no search available)
 */
function GlobalMemoryContent(): React.ReactElement {
  return (
    <VStack gap="lg" style={{ padding: theme.spacing.xl }}>
      {/* Header */}
      <HStack justify="space-between" align="center">
        <Heading size="lg">User Memory</Heading>
        <HStack gap="sm">
          <TabButton active={true} onClick={() => {}}>
            Rules
          </TabButton>
        </HStack>
      </HStack>

      {/* Only rules available without project context */}
      <RulesTab scopeFilter="USER" />
    </VStack>
  );
}

/**
 * Memory page component
 *
 * Uses useParams() to get optional projectId/repoId from URL.
 * - Global memory page (/memory): shows only USER rules (no search - requires project context)
 * - Project memory page (/repos/{id}/memory): shows search + PROJECT rules
 */
export default function MemoryPage(): React.ReactElement {
  const { projectId, repoId } = useParams<{
    projectId?: string;
    repoId?: string;
  }>();

  // Global scope - no search available
  if (!projectId && !repoId) {
    return <GlobalMemoryContent />;
  }

  // Project/repo scope - need to query for path
  const id = repoId || projectId;
  if (!id) {
    return <GlobalMemoryContent />;
  }

  return (
    <Suspense
      fallback={
        <VStack
          gap="md"
          align="center"
          justify="center"
          style={{ minHeight: '200px' }}
        >
          <Spinner size="lg" />
          <Text color="secondary">Loading project memory...</Text>
        </VStack>
      }
    >
      <ProjectMemoryContent repoId={id} />
    </Suspense>
  );
}
