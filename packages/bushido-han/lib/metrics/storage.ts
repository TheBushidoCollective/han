import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { getClaudeConfigDir } from "../claude-settings.js";
import type {
	CompleteTaskParams,
	FailTaskParams,
	MetricsQuery,
	MetricsResult,
	StartTaskParams,
	Task,
	UpdateTaskParams,
} from "./types.js";

/**
 * Get metrics directory path, respecting CLAUDE_CONFIG_DIR
 */
function getMetricsDir(): string {
	const configDir = getClaudeConfigDir();
	if (!configDir) {
		throw new Error(
			"Could not determine Claude config directory. Set CLAUDE_CONFIG_DIR or HOME environment variable.",
		);
	}
	return join(configDir, "metrics");
}

/**
 * Get metrics database path
 */
export function getMetricsDbPath(): string {
	return join(getMetricsDir(), "metrics.db");
}

/**
 * Initialize the metrics database
 */
export class MetricsStorage {
	private db: Database.Database;

	constructor() {
		const metricsDir = getMetricsDir();

		// Ensure directory exists
		if (!existsSync(metricsDir)) {
			mkdirSync(metricsDir, { recursive: true });
		}

		// Open database
		this.db = new Database(getMetricsDbPath());
		this.db.pragma("journal_mode = WAL");

		// Create schema
		this.initializeSchema();
	}

	private initializeSchema(): void {
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        type TEXT NOT NULL,
        complexity TEXT,
        started_at DATETIME NOT NULL,
        completed_at DATETIME,
        duration_seconds INTEGER,
        status TEXT NOT NULL,
        outcome TEXT,
        confidence REAL,
        notes TEXT,
        files_modified TEXT,
        tests_added INTEGER,
        failure_reason TEXT,
        attempted_solutions TEXT,
        hooks_passed BOOLEAN,
        hook_results TEXT
      );

      CREATE TABLE IF NOT EXISTS task_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT REFERENCES tasks(id),
        timestamp DATETIME NOT NULL,
        status TEXT,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_outcome ON tasks(outcome);
      CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
    `);
	}

	/**
	 * Generate a unique task ID
	 */
	private generateTaskId(): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2, 9);
		return `task-${timestamp}-${random}`;
	}

	/**
	 * Start a new task
	 */
	startTask(params: StartTaskParams): { task_id: string } {
		const task_id = this.generateTaskId();
		const started_at = new Date().toISOString();

		const stmt = this.db.prepare(`
      INSERT INTO tasks (id, description, type, complexity, started_at, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `);

		stmt.run(
			task_id,
			params.description,
			params.type,
			params.estimated_complexity,
			started_at,
		);

		return { task_id };
	}

	/**
	 * Update a task's status
	 */
	updateTask(params: UpdateTaskParams): { success: boolean } {
		const timestamp = new Date().toISOString();

		// Add update record
		const updateStmt = this.db.prepare(`
      INSERT INTO task_updates (task_id, timestamp, status, notes)
      VALUES (?, ?, ?, ?)
    `);

		updateStmt.run(params.task_id, timestamp, params.status, params.notes);

		// Update main task record if status provided
		if (params.status) {
			const taskStmt = this.db.prepare(`
        UPDATE tasks SET status = ? WHERE id = ?
      `);
			taskStmt.run(params.status, params.task_id);
		}

		return { success: true };
	}

	/**
	 * Complete a task successfully
	 */
	completeTask(params: CompleteTaskParams): { success: boolean } {
		const completed_at = new Date().toISOString();

		// Get task start time to calculate duration
		const task = this.db
			.prepare("SELECT started_at FROM tasks WHERE id = ?")
			.get(params.task_id) as { started_at: string } | undefined;

		if (!task) {
			throw new Error(`Task ${params.task_id} not found`);
		}

		const duration_seconds = Math.floor(
			(new Date(completed_at).getTime() - new Date(task.started_at).getTime()) /
				1000,
		);

		const stmt = this.db.prepare(`
      UPDATE tasks
      SET status = 'completed',
          completed_at = ?,
          duration_seconds = ?,
          outcome = ?,
          confidence = ?,
          files_modified = ?,
          tests_added = ?,
          notes = ?
      WHERE id = ?
    `);

		stmt.run(
			completed_at,
			duration_seconds,
			params.outcome,
			params.confidence,
			params.files_modified ? JSON.stringify(params.files_modified) : null,
			params.tests_added,
			params.notes,
			params.task_id,
		);

		return { success: true };
	}

	/**
	 * Mark a task as failed
	 */
	failTask(params: FailTaskParams): { success: boolean } {
		const completed_at = new Date().toISOString();

		// Get task start time to calculate duration
		const task = this.db
			.prepare("SELECT started_at FROM tasks WHERE id = ?")
			.get(params.task_id) as { started_at: string } | undefined;

		if (!task) {
			throw new Error(`Task ${params.task_id} not found`);
		}

		const duration_seconds = Math.floor(
			(new Date(completed_at).getTime() - new Date(task.started_at).getTime()) /
				1000,
		);

		const stmt = this.db.prepare(`
      UPDATE tasks
      SET status = 'failed',
          completed_at = ?,
          duration_seconds = ?,
          outcome = 'failure',
          confidence = ?,
          failure_reason = ?,
          attempted_solutions = ?,
          notes = ?
      WHERE id = ?
    `);

		stmt.run(
			completed_at,
			duration_seconds,
			params.confidence ?? 0,
			params.reason,
			params.attempted_solutions
				? JSON.stringify(params.attempted_solutions)
				: null,
			params.notes,
			params.task_id,
		);

		return { success: true };
	}

	/**
	 * Query metrics based on filters
	 */
	queryMetrics(params: MetricsQuery): MetricsResult {
		let whereClause = "WHERE 1=1";
		const whereParams: unknown[] = [];

		// Add time period filter
		if (params.period) {
			const now = new Date();
			let startDate: Date;

			switch (params.period) {
				case "day":
					startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
					break;
				case "week":
					startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
					break;
				case "month":
					startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
					break;
			}

			whereClause += " AND started_at >= ?";
			whereParams.push(startDate.toISOString());
		}

		// Add task type filter
		if (params.task_type) {
			whereClause += " AND type = ?";
			whereParams.push(params.task_type);
		}

		// Add outcome filter
		if (params.outcome) {
			whereClause += " AND outcome = ?";
			whereParams.push(params.outcome);
		}

		// Get all tasks
		const tasks = this.db
			.prepare(`SELECT * FROM tasks ${whereClause} ORDER BY started_at DESC`)
			.all(...whereParams) as Task[];

		// Calculate metrics
		const total_tasks = tasks.length;
		const completed_tasks = tasks.filter(
			(t) => t.status === "completed",
		).length;
		const success_rate =
			completed_tasks > 0
				? tasks.filter((t) => t.outcome === "success").length / completed_tasks
				: 0;

		const tasksWithConfidence = tasks.filter(
			(t) => t.confidence !== null && t.confidence !== undefined,
		);
		const average_confidence =
			tasksWithConfidence.length > 0
				? tasksWithConfidence.reduce((sum, t) => sum + (t.confidence ?? 0), 0) /
					tasksWithConfidence.length
				: 0;

		const tasksWithDuration = tasks.filter((t) => t.duration_seconds !== null);
		const average_duration_seconds =
			tasksWithDuration.length > 0
				? tasksWithDuration.reduce(
						(sum, t) => sum + (t.duration_seconds ?? 0),
						0,
					) / tasksWithDuration.length
				: 0;

		// Group by type
		const by_type: Record<string, number> = {};
		tasks.forEach((task) => {
			by_type[task.type] = (by_type[task.type] || 0) + 1;
		});

		// Group by outcome
		const by_outcome: Record<string, number> = {};
		tasks.forEach((task) => {
			if (task.outcome) {
				by_outcome[task.outcome] = (by_outcome[task.outcome] || 0) + 1;
			}
		});

		// Calculate calibration score (how well confidence matches actual success)
		// This is a simplified metric - higher is better
		const calibration_score = this.calculateCalibrationScore(tasks);

		return {
			total_tasks,
			completed_tasks,
			success_rate,
			average_confidence,
			average_duration_seconds,
			by_type,
			by_outcome,
			calibration_score,
			tasks,
		};
	}

	/**
	 * Calculate calibration score
	 * Returns a score from 0-1 indicating how well confidence matches actual outcomes
	 */
	private calculateCalibrationScore(tasks: Task[]): number {
		const completedWithConfidence = tasks.filter(
			(t) => t.outcome && t.confidence !== null && t.confidence !== undefined,
		);

		if (completedWithConfidence.length === 0) {
			return 0;
		}

		// Calculate average absolute difference between confidence and actual success
		let totalError = 0;
		completedWithConfidence.forEach((task) => {
			const actualSuccess = task.outcome === "success" ? 1 : 0;
			const confidence = task.confidence ?? 0;
			totalError += Math.abs(confidence - actualSuccess);
		});

		const averageError = totalError / completedWithConfidence.length;
		// Convert error to score (1 - error)
		return Math.max(0, 1 - averageError);
	}

	/**
	 * Close the database connection
	 */
	close(): void {
		this.db.close();
	}
}
