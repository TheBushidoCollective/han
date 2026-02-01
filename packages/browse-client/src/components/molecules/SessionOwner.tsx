/**
 * Session Owner Component
 *
 * Displays the owner of a session with avatar and name.
 * Used in team mode to show who ran each session.
 */

import type React from 'react';
import type { User } from '../../types/auth.ts';
import { Box, HStack, Text, theme } from '../atoms/index.ts';

interface SessionOwnerProps {
  owner: User | null;
  size?: 'sm' | 'md';
}

/**
 * Avatar component for user display
 */
function Avatar({
  user,
  size,
}: {
  user: User;
  size: 'sm' | 'md';
}): React.ReactElement {
  const sizeValue = size === 'sm' ? 20 : 28;

  if (user.avatarUrl) {
    return (
      <Box
        style={{
          width: sizeValue,
          height: sizeValue,
          borderRadius: theme.radii.full,
          overflow: 'hidden',
        }}
      >
        {/* Image component would be used here in a full implementation */}
        <Box
          style={{
            width: sizeValue,
            height: sizeValue,
            backgroundColor: theme.colors.bg.tertiary,
          }}
        />
      </Box>
    );
  }

  // Fallback to initials
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Box
      style={{
        width: sizeValue,
        height: sizeValue,
        borderRadius: theme.radii.full,
        backgroundColor: theme.colors.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        size={size === 'sm' ? 'xs' : 'sm'}
        weight="medium"
        style={{ color: theme.colors.bg.primary }}
      >
        {initials}
      </Text>
    </Box>
  );
}

/**
 * Session Owner display with avatar and name
 */
export function SessionOwner({
  owner,
  size = 'sm',
}: SessionOwnerProps): React.ReactElement | null {
  if (!owner) {
    return null;
  }

  return (
    <HStack gap="sm" align="center">
      <Avatar user={owner} size={size} />
      <Text size={size} color="secondary">
        {owner.name}
      </Text>
    </HStack>
  );
}
