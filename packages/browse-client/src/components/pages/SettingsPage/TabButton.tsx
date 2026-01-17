/**
 * Tab Button Component
 *
 * Styled tab button for switching between views.
 */

import type React from 'react';
import { theme } from '@/components/atoms';
import { Box } from '@/components/atoms/Box.tsx';
import { Text } from '@/components/atoms/Text.tsx';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function TabButton({
  active,
  onClick,
  children,
}: TabButtonProps): React.ReactElement {
  return (
    <Box
      onClick={onClick}
      px="md"
      py="sm"
      borderRadius="md"
      bg={active ? 'tertiary' : undefined}
      style={{
        cursor: 'pointer',
        color: active ? theme.colors.text.primary : theme.colors.text.secondary,
        fontWeight: active ? 500 : 400,
        transition: 'background-color 0.2s, color 0.2s',
      }}
    >
      <Text size="sm" color={active ? 'primary' : 'secondary'}>
        {children}
      </Text>
    </Box>
  );
}
