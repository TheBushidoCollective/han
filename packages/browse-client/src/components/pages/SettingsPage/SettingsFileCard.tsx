/**
 * Settings File Card Component
 *
 * Displays a settings file with path and status.
 */

import type React from 'react';
import { theme } from '@/components/atoms';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Card } from '@/components/atoms/Card.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { StatusIndicator } from './StatusIndicator.tsx';
import type { SettingsFile } from './types.ts';
import { formatDate } from './utils.ts';

interface SettingsFileCardProps {
  file: SettingsFile;
}

export function SettingsFileCard({
  file,
}: SettingsFileCardProps): React.ReactElement {
  return (
    <Card>
      <VStack gap="sm">
        <HStack justify="space-between" align="center">
          <Heading size="sm" as="h3">
            {file.type === 'claude' ? 'Claude Settings' : 'Han Config'}
          </Heading>
          <HStack gap="sm" align="center">
            <Badge variant={file.exists ? 'success' : 'default'}>
              {file.sourceLabel}
            </Badge>
            <StatusIndicator active={file.exists} />
          </HStack>
        </HStack>
        <Box
          bg="tertiary"
          p="sm"
          borderRadius="md"
          style={{ fontFamily: 'monospace', fontSize: theme.fontSize.sm }}
        >
          <Text size="sm">{file.path}</Text>
        </Box>
        {file.exists && file.lastModified && (
          <Text size="sm" color="secondary">
            Last modified: {formatDate(file.lastModified)}
          </Text>
        )}
      </VStack>
    </Card>
  );
}
