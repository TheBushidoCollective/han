/**
 * Hook Execution Card Component
 *
 * Displays details of a single hook execution with expandable output/error.
 */

import type React from 'react';
import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import type { HookExecution } from './types.ts';
import { formatDate } from './utils.ts';

interface HookExecutionCardProps {
  hook: HookExecution;
}

export function HookExecutionCard({
  hook,
}: HookExecutionCardProps): React.ReactElement {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Box className={`hook-card ${hook.passed ? 'hook-passed' : 'hook-failed'}`}>
      <HStack className="hook-header" justify="space-between" align="center">
        <HStack className="hook-name" gap="sm" align="center">
          <Text
            className={`hook-status ${hook.passed ? 'status-passed' : 'status-failed'}`}
          >
            {hook.passed ? '✓' : '✗'}
          </Text>
          <Text>{hook.hookName}</Text>
        </HStack>
        <Badge>{hook.hookType}</Badge>
      </HStack>
      <HStack className="hook-meta" gap="md">
        {hook.hookSource && (
          <Text className="hook-source">from {hook.hookSource}</Text>
        )}
        <Text className="hook-duration">{hook.durationMs}ms</Text>
        <Text className="hook-time">{formatDate(hook.timestamp)}</Text>
      </HStack>
      {(hook.output || hook.error) && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="hook-toggle"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide output' : 'Show output'}
          </Button>
          {showDetails && (
            <Box className="hook-details">
              {hook.error && (
                <Box className="hook-error">
                  <Text weight={600}>Error:</Text>
                  <pre>{hook.error}</pre>
                </Box>
              )}
              {hook.output && (
                <Box className="hook-output">
                  <Text weight={600}>Output:</Text>
                  <pre>{hook.output}</pre>
                </Box>
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
