/**
 * Sidebar Template
 *
 * Main navigation sidebar with app branding and nav items.
 */

import type React from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getActiveEnvironment } from '../../config/environments.ts';
import { colors, createStyles } from '../../theme.ts';
import {
  Box,
  Heading,
  HStack,
  Pressable,
  Text,
  VStack,
} from '../atoms/index.ts';
import { EnvironmentSwitcher, NavItem } from '../organisms/index.ts';

/**
 * Determine if a nav item is active based on the current pathname
 */
function isNavItemActive(pathname: string, itemPath: string): boolean {
  // Exact match for root dashboard
  if (itemPath === '/' && pathname === '/') return true;
  if (itemPath === '/' && pathname === '/dashboard') return true;

  // For other routes, check if pathname starts with the item path
  if (itemPath !== '/' && pathname.startsWith(itemPath)) return true;

  // Map /repos/* paths to /repos nav item
  if (itemPath === '/repos' && pathname.startsWith('/repos')) return true;

  // Map /projects/* paths to /projects nav item
  if (itemPath === '/projects' && pathname.startsWith('/projects')) return true;

  return false;
}

const navItems: { id: string; path: string; label: string; icon: string }[] = [
  { id: 'dashboard', path: '/', label: 'Dashboard', icon: '🏠' },
  { id: 'projects', path: '/projects', label: 'Projects', icon: '📁' },
  { id: 'repos', path: '/repos', label: 'Repos', icon: '🗂️' },
  { id: 'sessions', path: '/sessions', label: 'Sessions', icon: '📋' },
  { id: 'metrics', path: '/metrics', label: 'Metrics', icon: '📊' },
  { id: 'memory', path: '/memory', label: 'Memory', icon: '🧠' },
];

const styles = createStyles({
  sidebar: {
    width: 220,
    height: '100vh',
    backgroundColor: colors.bg.secondary,
    borderRight: `1px solid ${colors.border.default}`,
    position: 'fixed' as const,
    left: 0,
    top: 0,
    zIndex: 10,
  },
  header: {
    borderBottom: `1px solid ${colors.border.default}`,
  },
  navContainer: {
    flex: 1,
    overflowY: 'auto' as const,
  },
  footer: {
    borderTop: `1px solid ${colors.border.default}`,
    padding: 12,
  },
  envButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: colors.bg.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  modal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: colors.bg.primary,
    borderRadius: 12,
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
  },
});

export function Sidebar(): React.ReactElement {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [showEnvSwitcher, setShowEnvSwitcher] = useState(false);
  const activeEnv = getActiveEnvironment();

  const handleClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    path: string
  ) => {
    e.preventDefault();
    navigate(path);
  };

  return (
    <>
      <Box style={styles.sidebar}>
        <VStack style={{ height: '100%' }}>
          {/* Header with logo */}
          <Box px="lg" py="lg" style={styles.header}>
            <HStack gap="sm" align="center">
              <Text size="xl">⛩️</Text>
              <Heading as="h1" size="md">
                Han
              </Heading>
            </HStack>
          </Box>

          {/* Navigation list */}
          <Box px="sm" py="md" style={styles.navContainer}>
            <VStack gap="xs">
              {navItems.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  isActive={isNavItemActive(pathname, item.path)}
                  onClick={handleClick}
                />
              ))}
            </VStack>
          </Box>

          {/* Environment Switcher */}
          <Box style={styles.footer}>
            <Pressable onPress={() => setShowEnvSwitcher(true)}>
              <Box style={styles.envButton}>
                <VStack gap="xs">
                  <Text size="xs" style={{ color: colors.text.secondary }}>
                    Environment
                  </Text>
                  <Text size="sm" weight="medium">
                    {activeEnv?.name ?? 'Default Local'}
                  </Text>
                  {activeEnv && (
                    <Text size="xs" style={{ color: colors.text.secondary }}>
                      {new URL(activeEnv.coordinatorUrl).host}
                    </Text>
                  )}
                </VStack>
              </Box>
            </Pressable>
          </Box>
        </VStack>
      </Box>

      {/* Environment Switcher Modal */}
      {showEnvSwitcher && (
        <Pressable
          style={styles.modal}
          onPress={() => setShowEnvSwitcher(false)}
        >
          <Box style={styles.modalContent}>
            <EnvironmentSwitcher />
          </Box>
        </Pressable>
      )}
    </>
  );
}
