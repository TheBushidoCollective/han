/**
 * Mock Dashboard
 *
 * Static replica of the real dashboard layout for display when the
 * coordinator is disconnected. Uses real components with sample data
 * but has zero GraphQL dependencies.
 */

import type React from "react";
import {
	Badge,
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

/**
 * Stub chart components - colored shapes that look like real charts when blurred.
 * Static data arrays with string keys to satisfy lint rules.
 */

const barContainerStyle = {
	display: "flex" as const,
	flexDirection: "row" as const,
	alignItems: "flex-end" as const,
	gap: 4,
	height: 180,
};

// Activity heatmap - green cells at varying opacity
const heatmapCells = [
	{ k: "a1", v: 0.1 },
	{ k: "a2", v: 0.4 },
	{ k: "a3", v: 0.2 },
	{ k: "a4", v: 0.8 },
	{ k: "a5", v: 0.3 },
	{ k: "a6", v: 0.6 },
	{ k: "a7", v: 0.9 },
	{ k: "a8", v: 0.2 },
	{ k: "a9", v: 0.5 },
	{ k: "b1", v: 0.7 },
	{ k: "b2", v: 0.1 },
	{ k: "b3", v: 0.4 },
	{ k: "b4", v: 0.6 },
	{ k: "b5", v: 0.3 },
	{ k: "b6", v: 0.8 },
	{ k: "b7", v: 0.5 },
	{ k: "b8", v: 0.2 },
	{ k: "b9", v: 0.7 },
	{ k: "c1", v: 0.4 },
	{ k: "c2", v: 0.9 },
	{ k: "c3", v: 0.3 },
	{ k: "c4", v: 0.6 },
	{ k: "c5", v: 0.1 },
	{ k: "c6", v: 0.5 },
	{ k: "c7", v: 0.8 },
	{ k: "c8", v: 0.2 },
	{ k: "c9", v: 0.4 },
	{ k: "d1", v: 0.7 },
	{ k: "d2", v: 0.5 },
	{ k: "d3", v: 0.3 },
	{ k: "d4", v: 0.9 },
	{ k: "d5", v: 0.6 },
	{ k: "d6", v: 0.2 },
	{ k: "d7", v: 0.8 },
	{ k: "d8", v: 0.4 },
	{ k: "d9", v: 0.7 },
	{ k: "e1", v: 0.3 },
	{ k: "e2", v: 0.5 },
	{ k: "e3", v: 0.1 },
	{ k: "e4", v: 0.6 },
	{ k: "e5", v: 0.8 },
	{ k: "e6", v: 0.4 },
	{ k: "e7", v: 0.2 },
	{ k: "e8", v: 0.7 },
	{ k: "e9", v: 0.9 },
	{ k: "f1", v: 0.3 },
	{ k: "f2", v: 0.5 },
	{ k: "f3", v: 0.6 },
	{ k: "f4", v: 0.7 },
	{ k: "f5", v: 0.1 },
	{ k: "f6", v: 0.5 },
	{ k: "f7", v: 0.3 },
	{ k: "f8", v: 0.8 },
	{ k: "f9", v: 0.6 },
	{ k: "g1", v: 0.2 },
	{ k: "g2", v: 0.4 },
	{ k: "g3", v: 0.7 },
	{ k: "g4", v: 0.9 },
	{ k: "g5", v: 0.3 },
	{ k: "g6", v: 0.5 },
	{ k: "g7", v: 0.4 },
	{ k: "g8", v: 0.6 },
	{ k: "g9", v: 0.8 },
	{ k: "h1", v: 0.2 },
	{ k: "h2", v: 0.5 },
	{ k: "h3", v: 0.7 },
	{ k: "h4", v: 0.1 },
	{ k: "h5", v: 0.3 },
	{ k: "h6", v: 0.6 },
	{ k: "h7", v: 0.4 },
	{ k: "h8", v: 0.8 },
	{ k: "h9", v: 0.5 },
	{ k: "i1", v: 0.2 },
	{ k: "i2", v: 0.9 },
	{ k: "i3", v: 0.3 },
	{ k: "i4", v: 0.7 },
	{ k: "i5", v: 0.5 },
	{ k: "i6", v: 0.4 },
	{ k: "i7", v: 0.6 },
	{ k: "i8", v: 0.1 },
	{ k: "i9", v: 0.8 },
	{ k: "j1", v: 0.3 },
	{ k: "j2", v: 0.5 },
	{ k: "j3", v: 0.7 },
];

function StubHeatmap(): React.ReactElement {
	return (
		<Box
			style={{
				display: "flex",
				flexDirection: "row" as const,
				flexWrap: "wrap" as const,
				gap: 3,
				height: 180,
				alignContent: "flex-start" as const,
			}}
		>
			{heatmapCells.map((cell) => (
				<Box
					key={cell.k}
					style={{
						width: 14,
						height: 14,
						borderRadius: 2,
						backgroundColor: theme.colors.accent.success,
						opacity: cell.v * 0.8 + 0.1,
					}}
				/>
			))}
		</Box>
	);
}

// Code changes - green (added) and red (removed) bars
const lineChangeBars = [
	{ k: "w1", add: 25, del: 10 },
	{ k: "w2", add: 40, del: 16 },
	{ k: "w3", add: 35, del: 14 },
	{ k: "w4", add: 55, del: 22 },
	{ k: "w5", add: 45, del: 18 },
	{ k: "w6", add: 65, del: 26 },
	{ k: "w7", add: 50, del: 20 },
	{ k: "w8", add: 70, del: 28 },
	{ k: "w9", add: 60, del: 24 },
	{ k: "w10", add: 45, del: 18 },
	{ k: "w11", add: 55, del: 22 },
	{ k: "w12", add: 40, del: 16 },
];

function StubLineChanges(): React.ReactElement {
	return (
		<Box style={barContainerStyle}>
			{lineChangeBars.map((bar) => (
				<Box
					key={bar.k}
					style={{
						flex: 1,
						display: "flex" as const,
						flexDirection: "column" as const,
						justifyContent: "flex-end" as const,
						height: "100%",
					}}
				>
					<Box
						style={{
							height: `${bar.add}%`,
							backgroundColor: theme.colors.accent.success,
							borderTopLeftRadius: theme.radii.sm,
							borderTopRightRadius: theme.radii.sm,
							opacity: 0.6,
						}}
					/>
					<Box
						style={{
							height: `${bar.del}%`,
							backgroundColor: theme.colors.danger,
							opacity: 0.5,
						}}
					/>
				</Box>
			))}
		</Box>
	);
}

// Model usage - stacked bars in blue/purple/amber
const modelBars = [
	{ k: "m1", a: 30, b: 20, c: 15 },
	{ k: "m2", a: 45, b: 25, c: 10 },
	{ k: "m3", a: 35, b: 30, c: 20 },
	{ k: "m4", a: 55, b: 15, c: 25 },
	{ k: "m5", a: 40, b: 35, c: 15 },
	{ k: "m6", a: 60, b: 20, c: 10 },
	{ k: "m7", a: 50, b: 25, c: 20 },
	{ k: "m8", a: 35, b: 30, c: 25 },
	{ k: "m9", a: 45, b: 20, c: 15 },
	{ k: "m10", a: 55, b: 25, c: 20 },
];

const modelColors = [
	theme.colors.accent.primary,
	theme.colors.purple,
	theme.colors.accent.warning,
];

function StubModelUsage(): React.ReactElement {
	return (
		<Box style={barContainerStyle}>
			{modelBars.map((bar) => (
				<Box
					key={bar.k}
					style={{
						flex: 1,
						display: "flex" as const,
						flexDirection: "column" as const,
						justifyContent: "flex-end" as const,
						height: "100%",
					}}
				>
					<Box
						style={{
							height: `${bar.c}%`,
							backgroundColor: modelColors[0],
							borderTopLeftRadius: theme.radii.sm,
							borderTopRightRadius: theme.radii.sm,
							opacity: 0.7,
						}}
					/>
					<Box
						style={{
							height: `${bar.b}%`,
							backgroundColor: modelColors[1],
							opacity: 0.7,
						}}
					/>
					<Box
						style={{
							height: `${bar.a}%`,
							backgroundColor: modelColors[2],
							opacity: 0.7,
						}}
					/>
				</Box>
			))}
		</Box>
	);
}

// Time of day - blue bars
const hourlyBars = [
	{ k: "h0", h: 10 },
	{ k: "h1", h: 5 },
	{ k: "h2", h: 3 },
	{ k: "h3", h: 2 },
	{ k: "h4", h: 1 },
	{ k: "h5", h: 5 },
	{ k: "h6", h: 15 },
	{ k: "h7", h: 30 },
	{ k: "h8", h: 55 },
	{ k: "h9", h: 80 },
	{ k: "h10", h: 90 },
	{ k: "h11", h: 70 },
	{ k: "h12", h: 50 },
	{ k: "h13", h: 75 },
	{ k: "h14", h: 85 },
	{ k: "h15", h: 95 },
	{ k: "h16", h: 80 },
	{ k: "h17", h: 65 },
	{ k: "h18", h: 45 },
	{ k: "h19", h: 55 },
	{ k: "h20", h: 70 },
	{ k: "h21", h: 50 },
	{ k: "h22", h: 30 },
	{ k: "h23", h: 15 },
];

function StubTimeOfDay(): React.ReactElement {
	return (
		<Box style={barContainerStyle}>
			{hourlyBars.map((bar) => (
				<Box
					key={bar.k}
					style={{
						flex: 1,
						height: `${bar.h}%`,
						backgroundColor: theme.colors.accent.primary,
						borderTopLeftRadius: theme.radii.sm,
						borderTopRightRadius: theme.radii.sm,
						opacity: 0.7,
					}}
				/>
			))}
		</Box>
	);
}

// Cost donut
function StubDonut(): React.ReactElement {
	return (
		<Box
			style={{
				display: "flex" as const,
				alignItems: "center" as const,
				justifyContent: "center" as const,
				height: 150,
			}}
		>
			<Box
				style={{
					width: 130,
					height: 130,
					borderRadius: theme.radii.full,
					borderWidth: 20,
					borderColor: theme.colors.accent.success,
					borderStyle: "solid" as const,
					borderTopColor: theme.colors.accent.primary,
					borderRightColor: theme.colors.accent.warning,
					opacity: 0.7,
				}}
			/>
		</Box>
	);
}

// Compaction health - horizontal progress bars
function StubProgressBars(): React.ReactElement {
	const bars = [
		{
			k: "p1",
			width: 72,
			color: theme.colors.accent.success,
			label: "Without compactions",
		},
		{
			k: "p2",
			width: 28,
			color: theme.colors.accent.warning,
			label: "With compactions",
		},
		{
			k: "p3",
			width: 85,
			color: theme.colors.accent.primary,
			label: "Auto compactions",
		},
	];
	return (
		<VStack gap="md">
			{bars.map((bar) => (
				<VStack key={bar.k} gap="xs">
					<HStack justify="space-between">
						<Text size="xs" color="muted">
							{bar.label}
						</Text>
						<Text size="xs" color="muted">
							{bar.width}%
						</Text>
					</HStack>
					<Box
						style={{
							height: 8,
							backgroundColor: theme.colors.bg.tertiary,
							borderRadius: theme.radii.full,
							overflow: "hidden" as const,
						}}
					>
						<Box
							style={{
								height: "100%",
								width: `${bar.width}%`,
								backgroundColor: bar.color,
								borderRadius: theme.radii.full,
								opacity: 0.8,
							}}
						/>
					</Box>
				</VStack>
			))}
		</VStack>
	);
}

// Horizontal bar chart for Subagent/Tool usage
function StubHorizontalBars({
	items,
}: {
	items: { k: string; label: string; width: number; color: string }[];
}): React.ReactElement {
	return (
		<VStack gap="md">
			{items.map((item) => (
				<VStack key={item.k} gap="xs">
					<HStack justify="space-between">
						<Text size="xs" color="muted">
							{item.label}
						</Text>
						<Text size="xs" color="muted">
							{item.width}
						</Text>
					</HStack>
					<Box
						style={{
							height: 8,
							backgroundColor: theme.colors.bg.tertiary,
							borderRadius: theme.radii.full,
							overflow: "hidden" as const,
						}}
					>
						<Box
							style={{
								height: "100%",
								width: `${Math.min((item.width / items[0].width) * 100, 100)}%`,
								backgroundColor: item.color,
								borderRadius: theme.radii.full,
								opacity: 0.8,
							}}
						/>
					</Box>
				</VStack>
			))}
		</VStack>
	);
}

// Status row for Agent Health
function StatusItem({
	label,
	value,
}: {
	label: string;
	value: string | number;
}): React.ReactElement {
	return (
		<HStack justify="space-between">
			<Text size="sm" color="muted">
				{label}
			</Text>
			<Text size="sm" weight="medium">
				{value}
			</Text>
		</HStack>
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
								<StubHeatmap />
							</SectionCard>
						</Box>
						<Box style={{ flex: 1 }}>
							<SectionCard title="Code Changes" style={{ height: "100%" }}>
								<StubLineChanges />
							</SectionCard>
						</Box>
					</HStack>

					{/* Model Usage and Time of Day */}
					<HStack gap="lg" style={{ alignItems: "stretch" }}>
						<Box style={{ flex: 1 }}>
							<SectionCard
								title="Model Usage (from Claude Code stats)"
								style={{ height: "100%" }}
							>
								<StubModelUsage />
							</SectionCard>
						</Box>
						<Box style={{ flex: 1 }}>
							<SectionCard title="Time of Day" style={{ height: "100%" }}>
								<StubTimeOfDay />
							</SectionCard>
						</Box>
					</HStack>

					{/* Cost Analysis and Compaction */}
					<HStack gap="lg" style={{ alignItems: "stretch" }}>
						<Box style={{ flex: 3 }}>
							<SectionCard title="Cost Analysis" style={{ height: "100%" }}>
								<StubDonut />
							</SectionCard>
						</Box>
						<Box style={{ flex: 2 }}>
							<SectionCard title="Compaction Health" style={{ height: "100%" }}>
								<StubProgressBars />
							</SectionCard>
						</Box>
					</HStack>

					{/* Session Effectiveness - full width */}
					<SectionCard title="Session Effectiveness (30 days)">
						<HStack gap="lg">
							<VStack gap="sm" style={{ flex: 1 }}>
								<Text size="xs" color="muted" weight="semibold">
									Top Sessions
								</Text>
								<Skeleton width="100%" height={14} />
								<Skeleton width="90%" height={14} />
								<Skeleton width="85%" height={14} />
							</VStack>
							<VStack gap="sm" style={{ flex: 1 }}>
								<Text size="xs" color="muted" weight="semibold">
									Needs Improvement
								</Text>
								<Skeleton width="100%" height={14} />
								<Skeleton width="90%" height={14} />
								<Skeleton width="85%" height={14} />
							</VStack>
						</HStack>
					</SectionCard>

					{/* Subagent Usage and Tool Usage */}
					<HStack gap="lg" style={{ alignItems: "stretch" }}>
						<Box style={{ flex: 1 }}>
							<SectionCard title="Subagent Usage" style={{ height: "100%" }}>
								<StubHorizontalBars
									items={[
										{
											k: "s1",
											label: "general-purpose",
											width: 42,
											color: theme.colors.accent.primary,
										},
										{
											k: "s2",
											label: "Explore",
											width: 28,
											color: theme.colors.purple,
										},
										{
											k: "s3",
											label: "Plan",
											width: 15,
											color: theme.colors.accent.warning,
										},
										{
											k: "s4",
											label: "Bash",
											width: 8,
											color: theme.colors.accent.success,
										},
									]}
								/>
							</SectionCard>
						</Box>
						<Box style={{ flex: 1 }}>
							<SectionCard title="Tool Usage" style={{ height: "100%" }}>
								<StubHorizontalBars
									items={[
										{
											k: "t1",
											label: "Read",
											width: 156,
											color: theme.colors.accent.primary,
										},
										{
											k: "t2",
											label: "Edit",
											width: 89,
											color: theme.colors.purple,
										},
										{
											k: "t3",
											label: "Bash",
											width: 67,
											color: theme.colors.accent.warning,
										},
										{
											k: "t4",
											label: "Grep",
											width: 45,
											color: theme.colors.accent.success,
										},
										{
											k: "t5",
											label: "Glob",
											width: 32,
											color: theme.colors.danger,
										},
									]}
								/>
							</SectionCard>
						</Box>
					</HStack>

					{/* Hook Health and Agent Health */}
					<HStack gap="lg" style={{ alignItems: "stretch" }}>
						<Box style={{ flex: 1 }}>
							<SectionCard title="Hook Health" style={{ height: "100%" }}>
								<StubHorizontalBars
									items={[
										{
											k: "hk1",
											label: "biome/lint",
											width: 95,
											color: theme.colors.accent.success,
										},
										{
											k: "hk2",
											label: "typescript/typecheck",
											width: 92,
											color: theme.colors.accent.success,
										},
										{
											k: "hk3",
											label: "git-storytelling/check",
											width: 78,
											color: theme.colors.accent.warning,
										},
									]}
								/>
							</SectionCard>
						</Box>
						<Box style={{ flex: 1 }}>
							<SectionCard title="Agent Health" style={{ height: "100%" }}>
								<VStack gap="md">
									<VStack gap="xs">
										<Text color="secondary" size="xs">
											Frustration Level
										</Text>
										<Badge variant="success">Low</Badge>
									</VStack>
									<VStack gap="sm">
										<StatusItem label="Total Tasks" value={47} />
										<StatusItem label="Success Rate" value="89%" />
										<StatusItem label="Avg Confidence" value="82%" />
									</VStack>
								</VStack>
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
