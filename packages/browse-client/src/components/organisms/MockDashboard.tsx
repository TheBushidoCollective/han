/**
 * Mock Dashboard
 *
 * Static replica of the real dashboard layout for display when the
 * coordinator is disconnected. Uses real components with sample data
 * but has zero GraphQL dependencies.
 */

import type React from "react";
import {
	Box,
	Heading,
	HStack,
	Skeleton,
	Text,
	theme,
	VStack,
} from "../atoms/index.ts";
import { SectionCard } from "./SectionCard.tsx";
import { StatCard } from "./StatCard.tsx";

const sidebarStyle = {
	width: 220,
	height: "100vh",
	backgroundColor: theme.colors.bg.secondary,
	borderRightWidth: 1,
	borderRightColor: theme.colors.border.default,
	borderRightStyle: "solid" as const,
	position: "fixed" as const,
	left: 0,
	top: 0,
	zIndex: 10,
};

const mainContentStyle = {
	flex: 1,
	marginLeft: 220,
	height: "100vh",
	overflowY: "auto" as const,
	overflowX: "hidden" as const,
	display: "flex" as const,
	flexDirection: "column" as const,
};

const appStyle = {
	display: "flex" as const,
	flexDirection: "row" as const,
	minHeight: "100vh",
	backgroundColor: theme.colors.bg.primary,
	color: theme.colors.text.primary,
	fontFamily: theme.fonts.body,
};

function MockSidebar(): React.ReactElement {
	const navItems = [
		{ label: "Dashboard", icon: "🏠", active: true },
		{ label: "Projects", icon: "📁", active: false },
		{ label: "Repos", icon: "🗂️", active: false },
		{ label: "Sessions", icon: "📋", active: false },
		{ label: "Metrics", icon: "📊", active: false },
		{ label: "Memory", icon: "🧠", active: false },
	];

	return (
		<Box style={sidebarStyle}>
			<VStack style={{ height: "100%" }}>
				<Box
					px="lg"
					py="lg"
					style={{
						borderBottomWidth: 1,
						borderBottomColor: theme.colors.border.default,
						borderBottomStyle: "solid" as const,
					}}
				>
					<HStack gap="sm" align="center">
						<Text size="xl">⛩️</Text>
						<Heading as="h1" size="md">
							Han
						</Heading>
					</HStack>
				</Box>
				<Box px="sm" py="md" style={{ flex: 1 }}>
					<VStack gap="xs">
						{navItems.map((item) => (
							<Box
								key={item.label}
								px="md"
								py="sm"
								style={{
									borderRadius: theme.radii.md,
									backgroundColor: item.active
										? theme.colors.bg.tertiary
										: "transparent",
								}}
							>
								<HStack gap="sm" align="center">
									<Text size="sm">{item.icon}</Text>
									<Text
										size="sm"
										weight={item.active ? "semibold" : "normal"}
										color={item.active ? "primary" : "muted"}
									>
										{item.label}
									</Text>
								</HStack>
							</Box>
						))}
					</VStack>
				</Box>
			</VStack>
		</Box>
	);
}

function SkeletonChart({
	height = 200,
}: {
	height?: number;
}): React.ReactElement {
	return (
		<Box
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				minHeight: height,
			}}
		>
			<Skeleton width="100%" height={height} />
		</Box>
	);
}

function MockSessionRow(): React.ReactElement {
	return (
		<Box
			py="sm"
			px="md"
			style={{
				borderBottomWidth: 1,
				borderBottomColor: theme.colors.border.subtle,
				borderBottomStyle: "solid" as const,
			}}
		>
			<HStack gap="md" align="center">
				<Box style={{ flex: 1 }}>
					<VStack gap="xs">
						<Skeleton width={180} height={14} />
						<Skeleton width={260} height={12} />
					</VStack>
				</Box>
				<Skeleton width={60} height={12} />
			</HStack>
		</Box>
	);
}

export function MockDashboard(): React.ReactElement {
	return (
		<Box style={appStyle}>
			<MockSidebar />
			<Box style={mainContentStyle}>
				<VStack gap="xl" style={{ padding: theme.spacing.xl }}>
					{/* Header */}
					<HStack justify="space-between" align="center">
						<VStack gap="xs">
							<Heading size="lg">Dashboard</Heading>
							<Text color="secondary">Han Development Environment</Text>
						</VStack>
					</HStack>

					{/* Stats grid */}
					<Box
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(5, 1fr)",
							gap: theme.spacing.lg,
						}}
					>
						<StatCard label="Projects" value={3} />
						<StatCard label="Total Tasks" value={47} subValue="38 completed" />
						<StatCard
							label="Success Rate"
							value="89%"
							subValue="82% confidence"
						/>
						<StatCard
							label="Calibration"
							value="84%"
							subValue="Prediction accuracy"
						/>
						<StatCard label="User Plugins" value={12} subValue="10 enabled" />
					</Box>

					{/* Activity and Code Changes */}
					<HStack gap="lg" style={{ alignItems: "stretch" }}>
						<Box style={{ flex: 1 }}>
							<SectionCard title="Activity" style={{ height: "100%" }}>
								<SkeletonChart height={200} />
							</SectionCard>
						</Box>
						<Box style={{ flex: 1 }}>
							<SectionCard title="Code Changes" style={{ height: "100%" }}>
								<SkeletonChart height={200} />
							</SectionCard>
						</Box>
					</HStack>

					{/* Model Usage and Time of Day */}
					<HStack gap="lg" style={{ alignItems: "stretch" }}>
						<Box style={{ flex: 1 }}>
							<SectionCard title="Model Usage" style={{ height: "100%" }}>
								<SkeletonChart height={200} />
							</SectionCard>
						</Box>
						<Box style={{ flex: 1 }}>
							<SectionCard title="Time of Day" style={{ height: "100%" }}>
								<SkeletonChart height={200} />
							</SectionCard>
						</Box>
					</HStack>

					{/* Cost Analysis and Compaction */}
					<HStack gap="lg" style={{ alignItems: "stretch" }}>
						<Box style={{ flex: 3 }}>
							<SectionCard title="Cost Analysis" style={{ height: "100%" }}>
								<SkeletonChart height={180} />
							</SectionCard>
						</Box>
						<Box style={{ flex: 2 }}>
							<SectionCard title="Compaction Health" style={{ height: "100%" }}>
								<SkeletonChart height={120} />
							</SectionCard>
						</Box>
					</HStack>

					{/* Recent Sessions */}
					<SectionCard title="Recent Sessions">
						<VStack style={{ gap: 0 }}>
							<MockSessionRow />
							<MockSessionRow />
							<MockSessionRow />
						</VStack>
					</SectionCard>
				</VStack>
			</Box>
		</Box>
	);
}
