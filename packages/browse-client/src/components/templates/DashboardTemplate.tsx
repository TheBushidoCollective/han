/**
 * Dashboard Template
 *
 * Layout structure for dashboard pages. Supports global, repo, and project variants.
 * Pages fill this template with real data from GraphQL queries.
 */

import type React from 'react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { SectionCard } from '@/components/organisms/SectionCard.tsx';
import { spacing } from '@/theme.ts';

export type DashboardVariant = 'global' | 'repo' | 'project';

export interface DashboardHeaderProps {
  /** Dashboard variant determines header style */
  variant: DashboardVariant;
  /** Main title text */
  title: string;
  /** Subtitle text */
  subtitle: string;
  /** Optional breadcrumb element for nested views */
  breadcrumb?: ReactNode;
}

export interface DashboardTemplateProps {
  /** Dashboard variant: global, repo, or project */
  variant: DashboardVariant;
  /** Header configuration */
  header: DashboardHeaderProps;
  /** Whether live updates are active */
  isLive?: boolean;
  /** Last update timestamp */
  lastUpdate?: Date;
  /** Stats section content (StatCards) */
  statsSection?: ReactNode;
  /** Charts section content */
  chartsSection?: ReactNode;
  /** Sessions section content */
  sessionsSection?: ReactNode;
  /** Additional sections */
  children?: ReactNode;
}

/**
 * Dashboard header with variant-specific styling
 */
function DashboardHeader({
  header,
  isLive,
  lastUpdate,
}: {
  header: DashboardHeaderProps;
  isLive?: boolean;
  lastUpdate?: Date;
}): React.ReactElement {
  return (
    <HStack justify="space-between" align="center">
      <VStack gap="xs">
        {header.breadcrumb ? (
          <>
            <HStack gap="sm" align="center">
              {header.breadcrumb}
              <Text color="muted">/</Text>
              <Heading size="lg">{header.title}</Heading>
            </HStack>
            <Text color="secondary" size="sm">
              {header.subtitle}
            </Text>
          </>
        ) : (
          <>
            <Heading size="lg">{header.title}</Heading>
            <Text color="secondary">{header.subtitle}</Text>
          </>
        )}
      </VStack>
      <HStack gap="sm" align="center">
        {isLive && (
          <Badge variant="success">
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                marginRight: '6px',
                animation: 'pulse 2s infinite',
              }}
            />
            Live
          </Badge>
        )}
        {lastUpdate && (
          <Text size="sm" color="muted">
            Updated {lastUpdate.toLocaleTimeString()}
          </Text>
        )}
      </HStack>
    </HStack>
  );
}

/**
 * Dashboard Template
 *
 * Provides the skeletal structure for dashboard pages.
 * Accepts content sections as props to maintain separation of concerns.
 */
export function DashboardTemplate({
  variant,
  header,
  isLive,
  lastUpdate,
  statsSection,
  chartsSection,
  sessionsSection,
  children,
}: DashboardTemplateProps): React.ReactElement {
  return (
    <VStack gap="xl" style={{ padding: spacing.xl }} data-variant={variant}>
      {/* Header section */}
      <DashboardHeader
        header={header}
        isLive={isLive}
        lastUpdate={lastUpdate}
      />

      {/* Stats section - quick metrics overview */}
      {statsSection && (
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: spacing.md,
          }}
        >
          {statsSection}
        </Box>
      )}

      {/* Charts section - data visualizations */}
      {chartsSection && (
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: spacing.lg,
          }}
        >
          {chartsSection}
        </Box>
      )}

      {/* Sessions section - recent activity */}
      {sessionsSection && (
        <SectionCard title="Recent Sessions">{sessionsSection}</SectionCard>
      )}

      {/* Additional content */}
      {children}
    </VStack>
  );
}
