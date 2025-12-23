/**
 * Stat Card Component
 *
 * Displays a statistic with value and label.
 */

import type React from 'react';
import { Card } from '@/components/atoms/Card.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { theme } from '@/components/atoms/theme.ts';
import { VStack } from '@/components/atoms/VStack.tsx';

interface StatCardProps {
  value: string | number;
  label: string;
}

export function StatCard({ value, label }: StatCardProps): React.ReactElement {
  return (
    <Card style={{ padding: theme.spacing.md, textAlign: 'center' }}>
      <VStack gap="xs" align="center">
        <Heading size="xl">{value}</Heading>
        <Text color="muted" size="sm">
          {label}
        </Text>
      </VStack>
    </Card>
  );
}
