/**
 * Access Denied Component
 *
 * Displays a graceful error message when the user doesn't have
 * permission to access a resource.
 */

import type React from 'react';
import { Box, Heading, Text, theme, VStack } from '../atoms/index.ts';

interface AccessDeniedProps {
  /**
   * The reason why access was denied
   */
  reason?: string;
  /**
   * The type of resource that was being accessed
   */
  resourceType?: 'session' | 'repository' | 'organization' | 'page';
  /**
   * Optional action button to render
   */
  action?: React.ReactNode;
}

/**
 * Access Denied display component
 *
 * Shows a friendly error message when permission checks fail.
 */
export function AccessDenied({
  reason,
  resourceType = 'page',
  action,
}: AccessDeniedProps): React.ReactElement {
  const resourceLabel = {
    session: 'session',
    repository: 'repository',
    organization: 'organization',
    page: 'page',
  }[resourceType];

  return (
    <Box
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 300,
        padding: theme.spacing.xl,
      }}
    >
      <VStack
        align="center"
        gap="md"
        style={{
          maxWidth: 400,
          textAlign: 'center',
        }}
      >
        <Box
          style={{
            width: 64,
            height: 64,
            borderRadius: theme.radii.full,
            backgroundColor: theme.colors.bg.tertiary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 32,
              lineHeight: 1,
            }}
          >
            {/* Lock icon using text */}
            {'\u{1F512}'}
          </Text>
        </Box>

        <Heading size="md">Access Denied</Heading>

        <Text color="secondary" size="sm">
          {reason || `You don't have permission to view this ${resourceLabel}.`}
        </Text>

        {action && (
          <Box style={{ marginTop: theme.spacing.md }}>
            {action}
          </Box>
        )}

        <Text color="muted" size="xs" style={{ marginTop: theme.spacing.lg }}>
          If you believe this is an error, please contact your administrator.
        </Text>
      </VStack>
    </Box>
  );
}
