/**
 * Metrics Page
 *
 * Displays task metrics and performance data.
 * Uses Relay for data fetching with Suspense for loading states.
 */

import type React from 'react';
import { Suspense, useState } from 'react';
import { Button } from '@/components/atoms/Button.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { theme } from '@/components/atoms/theme.ts';
import { VStack } from '@/components/atoms/VStack.tsx';
import { MetricsContent } from './MetricsContent.tsx';

type Period = 'DAY' | 'WEEK' | 'MONTH';

/**
 * Metrics page component with Suspense boundary
 */
export default function MetricsPage(): React.ReactElement {
  const [period, setPeriod] = useState<Period>('WEEK');

  return (
    <VStack gap="lg" style={{ padding: theme.spacing.xl }}>
      {/* Header */}
      <HStack justify="space-between" align="center">
        <Heading>Metrics</Heading>
        <HStack gap="xs">
          <Button
            size="sm"
            active={period === 'DAY'}
            onClick={() => setPeriod('DAY')}
          >
            Day
          </Button>
          <Button
            size="sm"
            active={period === 'WEEK'}
            onClick={() => setPeriod('WEEK')}
          >
            Week
          </Button>
          <Button
            size="sm"
            active={period === 'MONTH'}
            onClick={() => setPeriod('MONTH')}
          >
            Month
          </Button>
        </HStack>
      </HStack>

      <Suspense
        fallback={
          <VStack
            gap="md"
            align="center"
            justify="center"
            style={{ minHeight: '200px' }}
          >
            <Spinner size="lg" />
            <Text color="secondary">Loading metrics...</Text>
          </VStack>
        }
      >
        <MetricsContent period={period} />
      </Suspense>
    </VStack>
  );
}
