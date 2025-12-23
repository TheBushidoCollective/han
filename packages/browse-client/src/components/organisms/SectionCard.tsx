/**
 * Section Card Organism
 *
 * Card container with header title and optional "View All" action.
 * Used for grouping related content into titled sections.
 */

import type React from 'react';
import { Card, Heading, HStack, Link, Text, VStack } from '../atoms/index.ts';

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
