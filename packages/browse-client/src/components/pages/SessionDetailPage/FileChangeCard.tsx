/**
 * File Change Card Component
 *
 * Displays details of a single file change with action type and tool info.
 */

import type React from 'react';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { colors, fonts, spacing } from '@/theme.ts';

export interface FileValidation {
  pluginName: string | null | undefined;
  hookName: string | null | undefined;
  validatedAt: string | null | undefined;
}

export interface FileChange {
  id: string;
  filePath: string;
  action: 'CREATED' | 'MODIFIED' | 'DELETED';
  toolName: string | null;
  recordedAt: string | null;
  isValidated?: boolean;
  validations?: readonly FileValidation[];
}

interface FileChangeCardProps {
  fileChange: FileChange;
}

const actionColors: Record<string, { bg: string; text: string; icon: string }> =
  {
    CREATED: { bg: '#22c55e20', text: '#22c55e', icon: '+' },
    MODIFIED: { bg: '#f59e0b20', text: '#f59e0b', icon: '~' },
    DELETED: { bg: '#ef444420', text: '#ef4444', icon: '-' },
  };

export function FileChangeCard({
  fileChange,
}: FileChangeCardProps): React.ReactElement {
  const actionStyle = actionColors[fileChange.action] ?? actionColors.MODIFIED;

  // Extract filename from path for display
  const fileName = fileChange.filePath.split('/').pop() ?? fileChange.filePath;
  const dirPath =
    fileChange.filePath.slice(0, fileChange.filePath.lastIndexOf('/')) || '.';

  return (
    <Box
      className="file-change-card"
      style={{
        padding: spacing.sm,
        borderRadius: 6,
        backgroundColor: colors.bg.secondary,
        border: `1px solid ${colors.border.subtle}`,
      }}
    >
      <HStack gap="sm" align="center" style={{ flexWrap: 'wrap' }}>
        <Text
          style={{
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
            backgroundColor: actionStyle.bg,
            color: actionStyle.text,
            fontWeight: 600,
            fontSize: 14,
            fontFamily: fonts.mono,
          }}
        >
          {actionStyle.icon}
        </Text>
        <Text
          size="sm"
          style={{ fontFamily: fonts.mono, fontWeight: 500 }}
          title={fileChange.filePath}
        >
          {fileName}
        </Text>
        <Text size="xs" color="muted" style={{ fontFamily: fonts.mono }}>
          {dirPath.length > 40 ? `...${dirPath.slice(-37)}` : dirPath}
        </Text>
        {fileChange.toolName && (
          <Badge variant="info">{fileChange.toolName}</Badge>
        )}
        {fileChange.isValidated &&
          fileChange.validations &&
          fileChange.validations.length > 0 && (
            <span
              title={fileChange.validations
                .map((v) => `${v.pluginName ?? ''}:${v.hookName ?? ''}`)
                .join(', ')}
            >
              <Badge variant="success">
                ✓{' '}
                {fileChange.validations.length > 1
                  ? `${fileChange.validations.length} hooks`
                  : (fileChange.validations[0]?.hookName ?? 'validated')}
              </Badge>
            </span>
          )}
        {fileChange.isValidated === false && (
          <Badge variant="warning">unvalidated</Badge>
        )}
      </HStack>
    </Box>
  );
}
