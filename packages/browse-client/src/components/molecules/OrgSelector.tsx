/**
 * Organization Selector Component
 *
 * Dropdown to switch between user's organizations.
 * Only renders in hosted mode when user has multiple orgs.
 */

import type React from 'react';
import { useState } from 'react';
import type { Org } from '../../types/auth.ts';
import { Box, HStack, Pressable, Text, theme, VStack } from '../atoms/index.ts';

interface OrgSelectorProps {
  orgs: Org[];
  currentOrg: Org | null;
  onOrgChange: (org: Org) => void;
}

/**
 * Organization logo or fallback initial
 */
function OrgLogo({ org, size = 24 }: { org: Org; size?: number }): React.ReactElement {
  if (org.logoUrl) {
    return (
      <Box
        style={{
          width: size,
          height: size,
          borderRadius: theme.radii.sm,
          overflow: 'hidden',
          backgroundColor: theme.colors.bg.tertiary,
        }}
      />
    );
  }

  // Fallback to initial
  const initial = org.name[0].toUpperCase();

  return (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.purple,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text size="sm" weight="medium" style={{ color: theme.colors.text.heading }}>
        {initial}
      </Text>
    </Box>
  );
}

/**
 * Organization selector dropdown
 */
export function OrgSelector({
  orgs,
  currentOrg,
  onOrgChange,
}: OrgSelectorProps): React.ReactElement | null {
  const [isOpen, setIsOpen] = useState(false);

  // Don't render if no orgs or only one org
  if (orgs.length <= 1) {
    // Still show current org name if there's one
    if (currentOrg) {
      return (
        <HStack gap="sm" align="center" style={{ padding: theme.spacing.sm }}>
          <OrgLogo org={currentOrg} />
          <VStack gap="xs">
            <Text size="xs" color="muted">
              Organization
            </Text>
            <Text size="sm" weight="medium">
              {currentOrg.name}
            </Text>
          </VStack>
        </HStack>
      );
    }
    return null;
  }

  return (
    <Box style={{ position: 'relative' }}>
      <Pressable onPress={() => setIsOpen(!isOpen)}>
        <Box
          style={{
            padding: theme.spacing.sm,
            borderRadius: theme.radii.md,
            backgroundColor: isOpen ? theme.colors.bg.hover : 'transparent',
          }}
        >
          <HStack gap="sm" align="center">
            {currentOrg && <OrgLogo org={currentOrg} />}
            <VStack gap="xs" style={{ flex: 1 }}>
              <Text size="xs" color="muted">
                Organization
              </Text>
              <HStack justify="space-between" align="center">
                <Text size="sm" weight="medium">
                  {currentOrg?.name ?? 'Select Org'}
                </Text>
                <Text size="xs" color="muted">
                  {isOpen ? '\u25B2' : '\u25BC'}
                </Text>
              </HStack>
            </VStack>
          </HStack>
        </Box>
      </Pressable>

      {isOpen && (
        <Box
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: theme.spacing.xs,
            backgroundColor: theme.colors.bg.secondary,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.border.default,
            zIndex: 100,
            boxShadow: theme.shadows.lg,
          }}
        >
          {orgs.map((org) => (
            <Pressable
              key={org.id}
              onPress={() => {
                onOrgChange(org);
                setIsOpen(false);
              }}
            >
              <Box
                style={{
                  padding: theme.spacing.sm,
                  backgroundColor:
                    currentOrg?.id === org.id
                      ? theme.colors.bg.hover
                      : 'transparent',
                }}
              >
                <HStack gap="sm" align="center">
                  <OrgLogo org={org} size={20} />
                  <Text size="sm">{org.name}</Text>
                </HStack>
              </Box>
            </Pressable>
          ))}
        </Box>
      )}
    </Box>
  );
}
