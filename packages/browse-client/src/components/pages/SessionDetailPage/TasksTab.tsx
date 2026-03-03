/**
 * Tasks Tab
 *
 * Full-width view of native tasks, todos, and legacy metrics tasks.
 */

import type React from "react";
import { type ReactElement, Suspense } from "react";
import { graphql, useFragment } from "react-relay";
import { Box } from "@/components/atoms/Box.tsx";
import { HStack } from "@/components/atoms/HStack.tsx";
import { Spinner } from "@/components/atoms/Spinner.tsx";
import { Text } from "@/components/atoms/Text.tsx";
import { VStack } from "@/components/atoms/VStack.tsx";
import { StatCard } from "@/components/organisms/StatCard.tsx";
import { colors, radii, spacing } from "@/theme.ts";
import type { TasksTab_session$key } from "./__generated__/TasksTab_session.graphql.ts";
import { NativeTaskCard, TaskCard } from "./components.ts";
import type { NativeTask } from "./types.ts";

/**
 * Fragment for tasks tab data
 */
const TasksTabFragment = graphql`
  fragment TasksTab_session on Session {
    nativeTasks {
      id
      sessionId
      messageId
      subject
      description
      status
      activeForm
      owner
      blocks
      blockedBy
      createdAt
      updatedAt
      completedAt
    }
    todos {
      totalCount
      edges {
        node {
          id
          content
          status
          activeForm
        }
      }
    }
    todoCounts {
      total
      pending
      inProgress
      completed
    }
    tasks {
      totalCount
      edges {
        node {
          id
          taskId
          description
          type
          status
          outcome
          confidence
          startedAt
          completedAt
          durationSeconds
        }
      }
    }
  }
`;

/**
 * Status color helper for todos
 */
function getTodoStatusColor(status: string | null | undefined): string {
	switch (status) {
		case "completed":
			return colors.success;
		case "in_progress":
			return colors.primary;
		default:
			return colors.text.muted;
	}
}

/**
 * Status label helper for todos
 */
function getTodoStatusLabel(status: string | null | undefined): string {
	switch (status) {
		case "completed":
			return "✓";
		case "in_progress":
			return "●";
		default:
			return "○";
	}
}

interface TasksTabProps {
	fragmentRef: TasksTab_session$key;
}

function TasksTabContent({ fragmentRef }: TasksTabProps): ReactElement {
	const data = useFragment(TasksTabFragment, fragmentRef);

	// Native tasks
	const nativeTasks: NativeTask[] = (data.nativeTasks ?? [])
		.filter(
			(t): t is NonNullable<typeof t> & { id: string; status: string } =>
				t != null && !!t.id && !!t.status,
		)
		.map((t) => ({
			id: t.id,
			sessionId: t.sessionId ?? "",
			messageId: t.messageId ?? "",
			subject: t.subject ?? "",
			description: t.description ?? null,
			status: (["pending", "in_progress", "completed"].includes(t.status)
				? t.status
				: "pending") as "pending" | "in_progress" | "completed",
			activeForm: t.activeForm ?? null,
			owner: t.owner ?? null,
			blocks: t.blocks ?? [],
			blockedBy: t.blockedBy ?? [],
			createdAt: t.createdAt ?? "",
			updatedAt: t.updatedAt ?? "",
			completedAt: t.completedAt ?? null,
		}));

	// Todos
	const todos = (data.todos?.edges ?? [])
		.map((edge) => edge?.node)
		.filter(
			(node): node is NonNullable<typeof node> & { id: string } =>
				node != null && !!node.id,
		);
	const todoCounts = data.todoCounts;

	// Legacy tasks
	const tasks = (data.tasks?.edges ?? [])
		.map((edge) => edge?.node)
		.filter(
			(node): node is NonNullable<typeof node> & { id: string } =>
				node != null && !!node.id,
		);

	const hasNoData =
		nativeTasks.length === 0 && todos.length === 0 && tasks.length === 0;

	if (hasNoData) {
		return (
			<VStack align="center" gap="sm" style={{ padding: spacing.lg }}>
				<Text color="muted">No tasks in this session.</Text>
			</VStack>
		);
	}

	return (
		<Box
			style={{
				flex: 1,
				overflowY: "auto",
				padding: spacing.lg,
			}}
		>
			<VStack gap="lg">
				{/* Native Tasks Section */}
				{nativeTasks.length > 0 && (
					<VStack gap="md">
						<Text size="sm" weight="medium">
							Tasks ({nativeTasks.length})
						</Text>

						{/* Summary stats */}
						<HStack gap="sm" style={{ flexWrap: "wrap" }}>
							<StatCard
								value={
									nativeTasks.filter((t) => t.status === "completed").length
								}
								label="Done"
								valueColor={colors.success}
								compact
							/>
							<StatCard
								value={
									nativeTasks.filter((t) => t.status === "in_progress").length
								}
								label="Active"
								valueColor={colors.primary}
								compact
							/>
							<StatCard
								value={nativeTasks.filter((t) => t.status === "pending").length}
								label="Pending"
								valueColor={colors.text.muted}
								compact
							/>
						</HStack>

						{/* Task list */}
						<VStack gap="sm">
							{nativeTasks.map((task) => (
								<NativeTaskCard key={task.id} task={task} />
							))}
						</VStack>
					</VStack>
				)}

				{/* Todos Section */}
				{todos.length > 0 && (
					<VStack gap="md">
						<Text size="sm" weight="medium">
							Todos ({todoCounts?.total ?? todos.length})
						</Text>

						<HStack gap="sm" style={{ flexWrap: "wrap" }}>
							<StatCard
								value={todoCounts?.completed ?? 0}
								label="Done"
								valueColor={colors.success}
								compact
							/>
							<StatCard
								value={todoCounts?.inProgress ?? 0}
								label="Active"
								valueColor={colors.primary}
								compact
							/>
							<StatCard
								value={todoCounts?.pending ?? 0}
								label="Pending"
								valueColor={colors.text.muted}
								compact
							/>
						</HStack>

						<VStack gap="xs">
							{todos.map((todo) => (
								<Box
									key={todo.id}
									style={{
										padding: `${spacing.sm}px ${spacing.md}px`,
										backgroundColor: colors.bg.tertiary,
										borderRadius: radii.sm,
										opacity: todo.status === "completed" ? 0.6 : 1,
									}}
								>
									<HStack gap="sm" align="flex-start">
										<Text
											size="sm"
											style={{
												color: getTodoStatusColor(todo.status ?? "pending"),
												flexShrink: 0,
											}}
										>
											{getTodoStatusLabel(todo.status ?? "pending")}
										</Text>
										<VStack gap="xs" style={{ flex: 1 }}>
											<Text
												size="sm"
												style={{
													color:
														todo.status === "completed"
															? colors.text.muted
															: colors.text.primary,
													textDecoration:
														todo.status === "completed"
															? "line-through"
															: "none",
												}}
											>
												{todo.content}
											</Text>
											{todo.status === "in_progress" && todo.activeForm && (
												<Text size="xs" color="muted">
													{todo.activeForm}...
												</Text>
											)}
										</VStack>
									</HStack>
								</Box>
							))}
						</VStack>
					</VStack>
				)}

				{/* Legacy Metrics Tasks Section */}
				{tasks.length > 0 && (
					<VStack gap="md">
						<Text size="sm" weight="medium">
							Metrics Tasks ({data.tasks?.totalCount ?? tasks.length})
						</Text>

						<HStack gap="sm" style={{ flexWrap: "wrap" }}>
							<StatCard
								value={tasks.filter((t) => t.status === "COMPLETED").length}
								label="Completed"
								valueColor={colors.success}
								compact
							/>
							<StatCard
								value={tasks.filter((t) => t.status === "ACTIVE").length}
								label="Active"
								valueColor={colors.primary}
								compact
							/>
							<StatCard
								value={tasks.filter((t) => t.status === "FAILED").length}
								label="Failed"
								valueColor={colors.danger}
								compact
							/>
						</HStack>

						<VStack gap="sm">
							{tasks.map((task) => (
								<TaskCard
									key={task.id}
									task={{
										id: task.id,
										taskId: task.taskId ?? "",
										description: task.description ?? "",
										type: ([
											"IMPLEMENTATION",
											"FIX",
											"REFACTOR",
											"RESEARCH",
										].includes(task.type ?? "")
											? task.type
											: "IMPLEMENTATION") as
											| "IMPLEMENTATION"
											| "FIX"
											| "REFACTOR"
											| "RESEARCH",
										status: (["ACTIVE", "COMPLETED", "FAILED"].includes(
											task.status ?? "",
										)
											? task.status
											: "ACTIVE") as "ACTIVE" | "COMPLETED" | "FAILED",
										outcome: (["SUCCESS", "PARTIAL", "FAILURE"].includes(
											task.outcome ?? "",
										)
											? task.outcome
											: null) as "SUCCESS" | "PARTIAL" | "FAILURE" | null,
										confidence: task.confidence ?? null,
										startedAt: task.startedAt ?? "",
										completedAt: task.completedAt ?? null,
										durationSeconds: task.durationSeconds ?? null,
									}}
								/>
							))}
						</VStack>
					</VStack>
				)}
			</VStack>
		</Box>
	);
}

export function TasksTab(props: TasksTabProps): React.ReactElement {
	return (
		<Suspense
			fallback={
				<VStack align="center" gap="sm" style={{ padding: spacing.lg }}>
					<Spinner size="sm" />
					<Text color="muted" size="sm">
						Loading tasks...
					</Text>
				</VStack>
			}
		>
			<TasksTabContent {...props} />
		</Suspense>
	);
}
