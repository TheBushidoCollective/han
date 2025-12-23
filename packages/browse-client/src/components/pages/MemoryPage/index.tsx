/**
 * Memory Page
 *
 * Search memory and browse rules.
 * Uses useParams to get optional projectId from URL.
 */

import type React from 'react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { theme } from '@/components/atoms/theme.ts';
import { VStack } from '@/components/atoms/VStack.tsx';
import { RulesTab, SearchTab, type Tab, TabButton } from './components.ts';

/**
 * Memory page component
 *
 * Uses useParams() to get optional projectId from URL.
 */
export default function MemoryPage(): React.ReactElement {
  const { projectId } = useParams<{ projectId?: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('search');

  // TODO: Use projectId to filter rules/memory to project-specific content
  // For now, the projectId is available but not yet used for filtering
  void projectId;

  return (
    <VStack gap="lg" style={{ padding: theme.spacing.xl }}>
      {/* Header */}
      <HStack justify="space-between" align="center">
        <Heading size="lg">Memory</Heading>
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
      {activeTab === 'search' ? <SearchTab /> : <RulesTab />}
    </VStack>
  );
}
