/**
 * Sidebar Template
 *
 * Main navigation sidebar with app branding and nav items.
 * Shows org selector in hosted mode.
 */

import type React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { colors, createStyles } from "../../theme.ts";
import { Box, Heading, HStack, Text, VStack } from "../atoms/index.ts";
import { NavItem } from "../organisms/index.ts";

/**
 * Determine if a nav item is active based on the current pathname
 */
function isNavItemActive(pathname: string, itemPath: string): boolean {
	// Exact match for root dashboard
	if (itemPath === "/" && pathname === "/") return true;
	if (itemPath === "/" && pathname === "/dashboard") return true;

	// For other routes, check if pathname starts with the item path
	if (itemPath !== "/" && pathname.startsWith(itemPath)) return true;

	// Map /repos/* paths to /repos nav item
	if (itemPath === "/repos" && pathname.startsWith("/repos")) return true;

	// Map /projects/* paths to /projects nav item
	if (itemPath === "/projects" && pathname.startsWith("/projects")) return true;

	return false;
}

const navItems: { id: string; path: string; label: string; icon: string }[] = [
	{ id: "dashboard", path: "/", label: "Dashboard", icon: "🏠" },
	{ id: "projects", path: "/projects", label: "Projects", icon: "📁" },
	{ id: "repos", path: "/repos", label: "Repos", icon: "🗂️" },
	{ id: "sessions", path: "/sessions", label: "Sessions", icon: "📋" },
	{ id: "metrics", path: "/metrics", label: "Metrics", icon: "📊" },
	{ id: "memory", path: "/memory", label: "Memory", icon: "🧠" },
];

const styles = createStyles({
	sidebar: {
		width: 220,
		height: "100vh",
		backgroundColor: colors.bg.secondary,
		borderRightWidth: 1,
		borderRightColor: colors.border.default,
		borderRightStyle: "solid" as const,
		position: "fixed" as const,
		left: 0,
		top: 0,
		zIndex: 10,
	},
	header: {
		borderBottomWidth: 1,
		borderBottomColor: colors.border.default,
		borderBottomStyle: "solid" as const,
	},
	navContainer: {
		flex: 1,
		overflowY: "auto" as const,
	},
});

export function Sidebar(): React.ReactElement {
	const { pathname } = useLocation();
	const navigate = useNavigate();

	const handleClick = (
		e: React.MouseEvent<HTMLAnchorElement>,
		path: string,
	) => {
		e.preventDefault();
		navigate(path);
	};

	return (
		<Box style={styles.sidebar}>
			<VStack style={{ height: "100%" }}>
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
			</VStack>
		</Box>
	);
}
