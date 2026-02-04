/**
 * Rules Content Component
 *
 * Displays rules list with detail view using Relay.
 */

import type React from "react";
import { useMemo, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { theme } from "@/components/atoms";
import { Box } from "@/components/atoms/Box.tsx";
import { Card } from "@/components/atoms/Card.tsx";
import { Heading } from "@/components/atoms/Heading.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Input } from "@/components/atoms/Input.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import type { RulesContentQuery as RulesContentQueryType } from "./__generated__/RulesContentQuery.graphql.ts";

const RulesContentQueryDef = graphql`
  query RulesContentQuery {
    memory {
      rules {
        id
        domain
        scope
        path
        content
        size
        projectPath
        projectName
      }
    }
  }
`;

interface Rule {
	id: string;
	domain: string;
	scope: string;
	path: string;
	content: string;
	size: number;
	projectPath: string | null;
	projectName: string | null;
}

export interface RulesContentProps {
	/** Filter to only show rules of this scope ('USER' or 'PROJECT'). If not set, shows all. */
	scopeFilter?: "USER" | "PROJECT";
}

export function RulesContent({
	scopeFilter,
}: RulesContentProps): React.ReactElement {
	const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
	const [filter, setFilter] = useState("");

	const data = useLazyLoadQuery<RulesContentQueryType>(
		RulesContentQueryDef,
		{},
		{ fetchPolicy: "store-and-network" },
	);

	const rules: Rule[] = useMemo(() => {
		return (data.memory?.rules ?? [])
			.filter((r): r is typeof r & { id: string } => !!r.id)
			.map((r) => ({
				id: r.id,
				domain: r.domain ?? "",
				scope: r.scope ?? "",
				path: r.path ?? "",
				content: r.content ?? "",
				size: r.size ?? 0,
				projectPath: r.projectPath ?? null,
				projectName: r.projectName ?? null,
			}));
	}, [data.memory?.rules]);

	const filteredRules = useMemo(() => {
		let result = rules;

		// Apply scope filter if provided
		if (scopeFilter) {
			result = result.filter((r) => r.scope === scopeFilter);
		}

		// Apply text search filter
		if (filter) {
			const searchLower = filter.toLowerCase();
			result = result.filter(
				(r) =>
					r.domain.toLowerCase().includes(searchLower) ||
					r.content.toLowerCase().includes(searchLower),
			);
		}

		return result;
	}, [rules, filter, scopeFilter]);

	// Only split into project/user if no scopeFilter is set (showing all)
	const projectRules = scopeFilter
		? scopeFilter === "PROJECT"
			? filteredRules
			: []
		: filteredRules.filter((r) => r.scope === "PROJECT");
	const userRules = scopeFilter
		? scopeFilter === "USER"
			? filteredRules
			: []
		: filteredRules.filter((r) => r.scope === "USER");

	// Group project rules by project name
	const projectRulesGrouped = useMemo(() => {
		const groups: Record<string, Rule[]> = {};
		for (const rule of projectRules) {
			const key = rule.projectName || "Unknown Project";
			if (!groups[key]) {
				groups[key] = [];
			}
			groups[key].push(rule);
		}
		return groups;
	}, [projectRules]);

	return (
		<VStack gap="lg">
			{/* Filter input */}
			<Input
				placeholder="Filter rules..."
				value={filter}
				onChange={setFilter}
				style={{ width: "100%" }}
			/>

			{/* Rules layout */}
			<HStack gap="lg" align="flex-start" style={{ minHeight: "400px" }}>
				{/* Rules list */}
				<VStack
					gap="md"
					style={{
						width: "300px",
						flexShrink: 0,
					}}
				>
					{Object.keys(projectRulesGrouped).length > 0 &&
						Object.entries(projectRulesGrouped).map(
							([projectName, projectGroupRules]) => (
								<VStack gap="sm" key={projectName}>
									<Heading size="sm" as="h4">
										{projectName}
									</Heading>
									{projectGroupRules.map((rule) => (
										<Card
											key={rule.id}
											hoverable
											onClick={() => setSelectedRule(rule)}
											style={{
												...(selectedRule?.id === rule.id && {
													borderColor: theme.colors.accent.primary,
												}),
											}}
										>
											<HStack justify="space-between" align="center">
												<Text size="sm" weight="medium">
													{rule.domain}
												</Text>
												<Text size="xs" color="muted">
													{Math.round(rule.size / 1024)}KB
												</Text>
											</HStack>
										</Card>
									))}
								</VStack>
							),
						)}

					{userRules.length > 0 && (
						<VStack gap="sm">
							<Heading size="sm" as="h4">
								User Rules
							</Heading>
							{userRules.map((rule) => (
								<Card
									key={rule.id}
									hoverable
									onClick={() => setSelectedRule(rule)}
									style={{
										...(selectedRule?.id === rule.id && {
											borderColor: theme.colors.accent.primary,
										}),
									}}
								>
									<HStack justify="space-between" align="center">
										<Text size="sm" weight="medium">
											{rule.domain}
										</Text>
										<Text size="xs" color="muted">
											{Math.round(rule.size / 1024)}KB
										</Text>
									</HStack>
								</Card>
							))}
						</VStack>
					)}

					{filteredRules.length === 0 && (
						<VStack
							gap="sm"
							align="center"
							style={{ padding: theme.spacing.lg }}
						>
							<Text color="secondary">No rules found.</Text>
						</VStack>
					)}
				</VStack>

				{/* Rule content */}
				<Card style={{ flex: 1, minHeight: "400px" }}>
					{selectedRule ? (
						<VStack gap="md">
							<VStack gap="xs">
								<HStack gap="sm" align="center">
									<Heading size="sm" as="h3">
										{selectedRule.domain}
									</Heading>
									{selectedRule.projectName && (
										<Text size="xs" color="muted">
											({selectedRule.projectName})
										</Text>
									)}
								</HStack>
								<Text size="xs" color="muted">
									{selectedRule.path}
								</Text>
							</VStack>
							<Box
								bg="tertiary"
								p="md"
								borderRadius="md"
								style={{
									fontFamily: "monospace",
									fontSize: theme.fontSize.sm,
									whiteSpace: "pre-wrap",
									overflow: "auto",
									maxHeight: "500px",
								}}
							>
								<Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
									{selectedRule.content}
								</Text>
							</Box>
						</VStack>
					) : (
						<VStack
							gap="sm"
							align="center"
							justify="center"
							style={{ minHeight: "300px" }}
						>
							<Text color="secondary">Select a rule to view its content</Text>
						</VStack>
					)}
				</Card>
			</HStack>
		</VStack>
	);
}
