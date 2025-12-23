/**
 * Section Card Component
 *
 * Card with header and optional "View All" link.
 */

import type React from 'react';
import { Card } from '@/components/atoms/Card.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Link } from '@/components/atoms/Link.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  onViewAll?: () => void;
}

export function SectionCard({
  title,
  children,
  onViewAll,
}: SectionCardProps): React.ReactElement {
  return (
    <Card>
      <VStack gap="md">
        <HStack justify="space-between" align="center">
          <Heading size="sm" as="h3">
            {title}
          </Heading>
          {onViewAll && (
            <Link onClick={onViewAll}>
              <Text color="secondary" size="sm">
                View All
              </Text>
            </Link>
          )}
        </HStack>
        {children}
      </VStack>
    </Card>
  );
}
