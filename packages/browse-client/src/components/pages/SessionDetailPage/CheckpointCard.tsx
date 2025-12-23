/**
 * Checkpoint Card Component
 *
 * Displays checkpoint information with expandable patterns list.
 */

import type React from 'react';
import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import type { Checkpoint } from './types.ts';
import { formatDate } from './utils.ts';

interface CheckpointCardProps {
  checkpoint: Checkpoint;
}

export function CheckpointCard({
  checkpoint,
}: CheckpointCardProps): React.ReactElement {
  const [showPatterns, setShowPatterns] = useState(false);

  return (
    <Box className="checkpoint-card">
      <HStack
        className="checkpoint-header"
        justify="space-between"
        align="center"
      >
        <Badge variant={checkpoint.type === 'SESSION' ? 'info' : 'purple'}>
          {checkpoint.type}
        </Badge>
        <Text className="checkpoint-time" size="sm" color="muted">
          {formatDate(checkpoint.createdAt)}
        </Text>
      </HStack>
      <HStack className="checkpoint-stats" gap="lg">
        <Text className="checkpoint-stat" size="sm" color="muted">
          <strong>{checkpoint.fileCount}</strong> files
        </Text>
        <Text className="checkpoint-stat" size="sm" color="muted">
          <strong>{checkpoint.patternCount}</strong> patterns
        </Text>
      </HStack>
      {checkpoint.patterns.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="patterns-toggle"
            onClick={() => setShowPatterns(!showPatterns)}
          >
            {showPatterns ? 'Hide patterns' : 'Show patterns'}
          </Button>
          {showPatterns && (
            <HStack
              className="checkpoint-patterns"
              gap="xs"
              style={{ flexWrap: 'wrap' }}
            >
              {checkpoint.patterns.map((pattern) => (
                <code key={pattern} className="pattern-item">
                  {pattern}
                </code>
              ))}
            </HStack>
          )}
        </>
      )}
    </Box>
  );
}
