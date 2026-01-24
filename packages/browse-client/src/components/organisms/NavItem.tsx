/**
 * Nav Item Organism
 *
 * Navigation link item for sidebar navigation.
 * Handles active state styling and hover interactions.
 */

import type React from 'react';
import { Box, HStack, Text, theme } from '../atoms/index.ts';

interface NavItemProps {
  item: { id: string; path: string; label: string; icon: string };
  isActive: boolean;
  onClick: (e: React.MouseEvent<HTMLAnchorElement>, path: string) => void;
}

export function NavItem({
  item,
  isActive,
  onClick,
}: NavItemProps): React.ReactElement {
  return (
    <a
      href={item.path}
      onClick={(e) => onClick(e, item.path)}
      style={{
        display: 'block',
        textDecoration: 'none',
        borderRadius: theme.radii.md,
        backgroundColor: isActive ? theme.colors.bg.tertiary : 'transparent',
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = theme.colors.bg.hover;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <Box px="md" py="sm">
        <HStack gap="sm" align="center">
          <Text size="md" style={{ width: '20px', textAlign: 'center' }}>
            {item.icon}
          </Text>
          <Text
            size="md"
            color={isActive ? 'primary' : 'secondary'}
            weight={isActive ? 500 : 400}
          >
            {item.label}
          </Text>
        </HStack>
      </Box>
    </a>
  );
}
