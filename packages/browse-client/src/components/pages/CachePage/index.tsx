/**
 * Cache Page
 *
 * Displays cached hook runs and their status.
 * Uses Relay for data fetching with Suspense for loading states.
 */

import type React from 'react';
import { Suspense } from 'react';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { theme } from '@/components/atoms/theme.ts';
import { VStack } from '@/components/atoms/VStack.tsx';
import { CacheContent } from './CacheContent.tsx';

/**
 * Cache page with Suspense boundary
 */
export default function CachePage(): React.ReactElement {
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
          <Text color="secondary">Loading cache data...</Text>
        </VStack>
      }
    >
      <CacheContent />
    </Suspense>
  );
}
