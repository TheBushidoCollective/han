/**
 * Task types and complexity levels
 */
export type TaskType = "implementation" | "fix" | "refactor" | "research";
export type TaskComplexity = "simple" | "moderate" | "complex";
export type TaskStatus = "active" | "completed" | "failed";
export type TaskOutcome = "success" | "partial" | "failure";
export type FrustrationLevel = "low" | "moderate" | "high";

/**
 * Represents a tracked task
 */
export interface Task {
	id: string;
	description: string;
	type: TaskType;
	complexity?: TaskComplexity;
	started_at: string;
	completed_at?: string;
	duration_seconds?: number;
	status: TaskStatus;
	outcome?: TaskOutcome;
	confidence?: number;
	notes?: string;
	files_modified?: string;
	tests_added?: number;
	failure_reason?: string;
	attempted_solutions?: string;
	hooks_passed?: boolean;
	hook_results?: string;
}

/**
 * Represents a task status update
 */
export interface TaskUpdate {
	id: number;
	task_id: string;
	timestamp: string;
	status?: string;
	notes?: string;
}

/**
 * Represents a frustration event
 */
export interface FrustrationEvent {
	id: number;
	task_id?: string;
	timestamp: string;
	frustration_level: FrustrationLevel;
	frustration_score: number;
	user_message: string;
	detected_signals: string;
	context?: string;
}

/**
 * Metrics query parameters
 */
export interface MetricsQuery {
	period?: "day" | "week" | "month";
	task_type?: TaskType;
	outcome?: TaskOutcome;
}

/**
 * Metrics query results
 */
export interface MetricsResult {
	total_tasks: number;
	completed_tasks: number;
	success_rate: number;
	average_confidence: number;
	average_duration_seconds: number;
	by_type: Record<string, number>;
	by_outcome: Record<string, number>;
	calibration_score: number;
	tasks: Task[];
	frustration_events: FrustrationEvent[];
	total_frustrations: number;
	frustration_rate: number;
}

/**
 * Tool parameter types
 */
export interface StartTaskParams {
	description: string;
	type: TaskType;
	estimated_complexity?: TaskComplexity;
}

export interface UpdateTaskParams {
	task_id: string;
	status?: string;
	notes?: string;
}

export interface CompleteTaskParams {
	task_id: string;
	outcome: TaskOutcome;
	confidence: number;
	files_modified?: string[];
	tests_added?: number;
	notes?: string;
}

export interface FailTaskParams {
	task_id: string;
	reason: string;
	confidence?: number;
	attempted_solutions?: string[];
	notes?: string;
}

export interface QueryMetricsParams {
	period?: "day" | "week" | "month";
	task_type?: TaskType;
	outcome?: TaskOutcome;
}

export interface RecordFrustrationParams {
	task_id?: string;
	frustration_level: FrustrationLevel;
	frustration_score: number;
	user_message: string;
	detected_signals: string[];
	context?: string;
}
