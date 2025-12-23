/**
 * Rules Tab Component
 *
 * Browse and view project/user rules.
 * Uses Relay for data fetching with Suspense for loading states.
 */

import type React from 'react';
import { Suspense } from 'react';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { theme } from '@/components/atoms/theme.ts';
import { VStack } from '@/components/atoms/VStack.tsx';
import { RulesContent } from './RulesContent.tsx';

/**
 * Rules tab with Suspense boundary
 */
export function RulesTab(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <VStack
          gap="md"
          align="center"
          justify="center"
          style={{ padding: theme.spacing.xl, minHeight: '200px' }}
        >
          <Spinner size="lg" />
          <Text color="secondary">Loading rules...</Text>
        </VStack>
      }
    >
      <RulesContent />
    </Suspense>
  );
}
