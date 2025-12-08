import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getClaudeConfigDir } from "../claude-settings.js";
import type {
	CompleteTaskParams,
	FailTaskParams,
	FrustrationEvent,
	MetricsQuery,
	MetricsResult,
	RecordFrustrationParams,
	StartTaskParams,
	Task,
	UpdateTaskParams,
} from "./types.js";

/**
 * Get han metrics directory path
 * Stored in CLAUDE_CONFIG_DIR/han/metrics (e.g., ~/.claude/han/metrics)
 */
function getMetricsDir(): string {
	const configDir = getClaudeConfigDir();
	if (!configDir) {
		throw new Error(
			"Could not determine Claude config directory. Set CLAUDE_CONFIG_DIR or HOME environment variable.",
		);
	}
	return join(configDir, "han", "metrics");
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
	private db: Database;

	constructor() {
		const metricsDir = getMetricsDir();

		// Ensure directory exists
		if (!existsSync(metricsDir)) {
			mkdirSync(metricsDir, { recursive: true });
		}

		// Open database (creates if doesn't exist)
		this.db = new Database(getMetricsDbPath());

		// Configure SQLite for multi-process concurrent access
		// WAL mode allows multiple readers + one writer concurrently
		this.db.exec("PRAGMA journal_mode = WAL");
		// Wait up to 10 seconds for locks (increased for high concurrency)
		this.db.exec("PRAGMA busy_timeout = 10000");
		// NORMAL is safe with WAL mode and faster than FULL
		this.db.exec("PRAGMA synchronous = NORMAL");
		// Optimize WAL checkpointing for concurrent access
		this.db.exec("PRAGMA wal_autocheckpoint = 1000");
		// Enable shared cache for better multi-process performance
		this.db.exec("PRAGMA cache_size = -64000"); // 64MB cache
		// Optimize locking mode for concurrent access
		this.db.exec("PRAGMA locking_mode = NORMAL"); // Allow other processes to access

		// Create schema
		this.initializeSchema();

		// Clean up any stale locks from crashed processes
		this.cleanupStaleLocks();
	}

	private initializeSchema(): void {
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at DATETIME NOT NULL,
        ended_at DATETIME,
        last_resumed_at DATETIME,
        duration_minutes INTEGER,
        task_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        hooks_passed_count INTEGER DEFAULT 0,
        hooks_failed_count INTEGER DEFAULT 0,
        average_calibration REAL,
        status TEXT NOT NULL DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        session_id TEXT REFERENCES sessions(id),
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

      CREATE TABLE IF NOT EXISTS hook_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT REFERENCES sessions(id),
        task_id TEXT REFERENCES tasks(id),
        hook_type TEXT NOT NULL,
        hook_name TEXT NOT NULL,
        hook_source TEXT,
        started_at DATETIME NOT NULL,
        completed_at DATETIME,
        duration_ms INTEGER,
        exit_code INTEGER,
        passed BOOLEAN,
        status TEXT NOT NULL,
        output TEXT,
        error TEXT
      );

      CREATE TABLE IF NOT EXISTS frustration_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT REFERENCES tasks(id),
        timestamp DATETIME NOT NULL,
        frustration_level TEXT NOT NULL,
        frustration_score INTEGER NOT NULL,
        user_message TEXT NOT NULL,
        detected_signals TEXT NOT NULL,
        context TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_outcome ON tasks(outcome);
      CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
      CREATE INDEX IF NOT EXISTS idx_hook_exec_session ON hook_executions(session_id);
      CREATE INDEX IF NOT EXISTS idx_hook_exec_task ON hook_executions(task_id);
      CREATE INDEX IF NOT EXISTS idx_hook_exec_type ON hook_executions(hook_type);
      CREATE INDEX IF NOT EXISTS idx_hook_exec_name ON hook_executions(hook_name);
      CREATE INDEX IF NOT EXISTS idx_hook_exec_status ON hook_executions(status);
      CREATE INDEX IF NOT EXISTS idx_frustration_timestamp ON frustration_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_frustration_task ON frustration_events(task_id);
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
	 * Generate a unique session ID
	 */
	private generateSessionId(): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2, 9);
		return `session-${timestamp}-${random}`;
	}

	/**
	 * Start a new session or resume existing one
	 */
	startSession(sessionId?: string): { session_id: string; resumed: boolean } {
		// Use explicit transaction to reduce lock contention in multi-process scenarios
		try {
			this.db.exec("BEGIN IMMEDIATE");

			if (sessionId) {
				// Resume existing session
				const session = this.db
					.prepare("SELECT id, status FROM sessions WHERE id = ?")
					.get(sessionId) as { id: string; status: string } | undefined;

				if (session) {
					// Update last_resumed_at timestamp
					this.db
						.prepare(
							"UPDATE sessions SET last_resumed_at = ?, status = 'active' WHERE id = ?",
						)
						.run(new Date().toISOString(), sessionId);
					this.db.exec("COMMIT");
					return { session_id: sessionId, resumed: true };
				}
				// Session not found, create new one with the provided ID
			}

			// Create new session
			const newSessionId = sessionId || this.generateSessionId();
			const started_at = new Date().toISOString();

			this.db
				.prepare(
					"INSERT INTO sessions (id, started_at, last_resumed_at, status) VALUES (?, ?, ?, 'active')",
				)
				.run(newSessionId, started_at, started_at);

			this.db.exec("COMMIT");
			return { session_id: newSessionId, resumed: false };
		} catch (error) {
			// Rollback on error
			if (this.db.inTransaction) {
				this.db.exec("ROLLBACK");
			}
			throw error;
		}
	}

	/**
	 * End a session and calculate summary metrics
	 */
	endSession(sessionId: string): { success: boolean } {
		const session = this.db
			.prepare("SELECT started_at FROM sessions WHERE id = ?")
			.get(sessionId) as { started_at: string } | undefined;

		if (!session) {
			throw new Error(`Session ${sessionId} not found`);
		}

		const ended_at = new Date().toISOString();
		const duration_minutes = Math.floor(
			(new Date(ended_at).getTime() - new Date(session.started_at).getTime()) /
				(1000 * 60),
		);

		// Calculate session metrics from tasks
		const tasks = this.db
			.prepare("SELECT * FROM tasks WHERE session_id = ?")
			.all(sessionId) as Task[];

		const task_count = tasks.length;
		const success_count = tasks.filter((t) => t.outcome === "success").length;
		const failure_count = tasks.filter((t) => t.outcome === "failure").length;

		// Calculate average calibration for session
		const tasksWithConfidence = tasks.filter(
			(t) => t.outcome && t.confidence !== null && t.confidence !== undefined,
		);
		const average_calibration =
			tasksWithConfidence.length > 0
				? this.calculateCalibrationScore(tasksWithConfidence)
				: null;

		// Count hook pass/fail
		const hookStats = this.db
			.prepare(
				"SELECT COUNT(*) as total, SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed FROM hook_executions WHERE session_id = ?",
			)
			.get(sessionId) as { total: number; passed: number } | undefined;

		const hooks_passed_count = hookStats?.passed ?? 0;
		const hooks_failed_count = (hookStats?.total ?? 0) - hooks_passed_count;

		// Update session
		this.db
			.prepare(`
        UPDATE sessions
        SET ended_at = ?,
            duration_minutes = ?,
            task_count = ?,
            success_count = ?,
            failure_count = ?,
            hooks_passed_count = ?,
            hooks_failed_count = ?,
            average_calibration = ?,
            status = 'completed'
        WHERE id = ?
      `)
			.run(
				ended_at,
				duration_minutes,
				task_count,
				success_count,
				failure_count,
				hooks_passed_count,
				hooks_failed_count,
				average_calibration,
				sessionId,
			);

		// Auto-fail any orphaned tasks in this session
		this.db
			.prepare(`
        UPDATE tasks
        SET status = 'failed',
            outcome = 'failure',
            failure_reason = 'Session ended without task completion',
            completed_at = ?
        WHERE session_id = ? AND status = 'active'
      `)
			.run(ended_at, sessionId);

		return { success: true };
	}

	/**
	 * Get current active session ID (if any)
	 */
	getCurrentSession(): { session_id: string } | null {
		const session = this.db
			.prepare(
				"SELECT id FROM sessions WHERE status = 'active' ORDER BY last_resumed_at DESC LIMIT 1",
			)
			.get() as { id: string } | undefined;

		return session ? { session_id: session.id } : null;
	}

	/**
	 * Record a hook execution
	 */
	recordHookExecution(params: {
		sessionId?: string;
		taskId?: string;
		hookType: string;
		hookName: string;
		hookSource?: string;
		durationMs: number;
		exitCode: number;
		passed: boolean;
		output?: string;
		error?: string;
	}): { success: boolean } {
		const started_at = new Date().toISOString();
		const completed_at = new Date(Date.now() + params.durationMs).toISOString();
		const status = params.exitCode === 0 ? "success" : "failure";

		this.db
			.prepare(`
        INSERT INTO hook_executions (
          session_id, task_id, hook_type, hook_name, hook_source,
          started_at, completed_at, duration_ms, exit_code, passed, status, output, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
			.run(
				params.sessionId || null,
				params.taskId || null,
				params.hookType,
				params.hookName,
				params.hookSource || null,
				started_at,
				completed_at,
				params.durationMs,
				params.exitCode,
				params.passed ? 1 : 0,
				status,
				params.output || null,
				params.error || null,
			);

		return { success: true };
	}

	/**
	 * Start a new task
	 */
	startTask(params: StartTaskParams): { task_id: string } {
		const task_id = this.generateTaskId();
		const started_at = new Date().toISOString();

		// Get current session if available
		const currentSession = this.getCurrentSession();
		const session_id = currentSession?.session_id || null;

		const stmt = this.db.prepare(`
      INSERT INTO tasks (id, session_id, description, type, complexity, started_at, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `);

		stmt.run(
			task_id,
			session_id,
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
	 * Record a frustration event
	 */
	recordFrustration(params: RecordFrustrationParams): { success: boolean } {
		const timestamp = new Date().toISOString();

		const stmt = this.db.prepare(`
      INSERT INTO frustration_events (
        task_id, timestamp, frustration_level, frustration_score,
        user_message, detected_signals, context
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

		stmt.run(
			params.task_id || null,
			timestamp,
			params.frustration_level,
			params.frustration_score,
			params.user_message,
			JSON.stringify(params.detected_signals),
			params.context || null,
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

		// Get frustration events for the same period
		// Only use the time period filter from whereClause, not task-specific filters
		let frustrationWhereClause = "WHERE 1=1";
		const frustrationParams: unknown[] = [];
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
			frustrationWhereClause += " AND timestamp >= ?";
			frustrationParams.push(startDate.toISOString());
		}

		const frustrationEvents = this.db
			.prepare(
				`SELECT * FROM frustration_events ${frustrationWhereClause} ORDER BY timestamp DESC`,
			)
			.all(...frustrationParams) as FrustrationEvent[];

		// Calculate frustration metrics
		const total_frustrations = frustrationEvents.length;
		const frustration_rate =
			total_tasks > 0 ? total_frustrations / total_tasks : 0;

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
			frustration_events: frustrationEvents,
			total_frustrations,
			frustration_rate,
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
	 * Query hook failure statistics
	 */
	getHookFailureStats(period: "day" | "week" | "month" = "week"): Array<{
		name: string;
		source: string;
		total: number;
		failures: number;
		failureRate: number;
	}> {
		let timeFilter = "";
		switch (period) {
			case "day":
				timeFilter = "-1 days";
				break;
			case "week":
				timeFilter = "-7 days";
				break;
			case "month":
				timeFilter = "-30 days";
				break;
		}

		return this.db
			.prepare(
				`
      SELECT
        hook_name as name,
        hook_source as source,
        COUNT(*) as total,
        SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as failures,
        ROUND(100.0 * SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as failureRate
      FROM hook_executions
      WHERE started_at > datetime('now', ?)
      GROUP BY hook_name, hook_source
      HAVING failureRate > 20
      ORDER BY failureRate DESC
      LIMIT 5
    `,
			)
			.all(timeFilter) as Array<{
			name: string;
			source: string;
			total: number;
			failures: number;
			failureRate: number;
		}>;
	}

	/**
	 * Query session metrics
	 */
	querySessionMetrics(
		period: "day" | "week" | "month" = "week",
		limit = 10,
	): {
		sessions: Array<{
			session_id: string;
			started_at: string;
			ended_at: string | null;
			duration_minutes: number | null;
			task_count: number;
			success_count: number;
			hooks_passed_count: number;
			hooks_failed_count: number;
			average_calibration: number | null;
		}>;
		trends: {
			calibration_trend: "improving" | "declining" | "stable";
			success_rate_trend: "improving" | "declining" | "stable";
		};
	} {
		let timeFilter = "";
		switch (period) {
			case "day":
				timeFilter = "-1 days";
				break;
			case "week":
				timeFilter = "-7 days";
				break;
			case "month":
				timeFilter = "-30 days";
				break;
		}

		const sessions = this.db
			.prepare(
				`
      SELECT
        id as session_id,
        started_at,
        ended_at,
        duration_minutes,
        task_count,
        success_count,
        hooks_passed_count,
        hooks_failed_count,
        average_calibration
      FROM sessions
      WHERE started_at > datetime('now', ?)
      ORDER BY started_at DESC
      LIMIT ?
    `,
			)
			.all(timeFilter, limit) as Array<{
			session_id: string;
			started_at: string;
			ended_at: string | null;
			duration_minutes: number | null;
			task_count: number;
			success_count: number;
			hooks_passed_count: number;
			hooks_failed_count: number;
			average_calibration: number | null;
		}>;

		// Calculate trends
		const trends = this.calculateSessionTrends(sessions);

		return {
			sessions,
			trends,
		};
	}

	/**
	 * Calculate session trends
	 */
	private calculateSessionTrends(
		sessions: Array<{
			success_count: number;
			task_count: number;
			average_calibration: number | null;
		}>,
	): {
		calibration_trend: "improving" | "declining" | "stable";
		success_rate_trend: "improving" | "declining" | "stable";
	} {
		if (sessions.length < 2) {
			return {
				calibration_trend: "stable",
				success_rate_trend: "stable",
			};
		}

		// Get first half and second half
		const midpoint = Math.floor(sessions.length / 2);
		const recentSessions = sessions.slice(0, midpoint);
		const olderSessions = sessions.slice(midpoint);

		// Calculate average calibration for each half
		const recentCalibration =
			recentSessions
				.filter((s) => s.average_calibration !== null)
				.reduce((sum, s) => sum + (s.average_calibration || 0), 0) /
			recentSessions.filter((s) => s.average_calibration !== null).length;

		const olderCalibration =
			olderSessions
				.filter((s) => s.average_calibration !== null)
				.reduce((sum, s) => sum + (s.average_calibration || 0), 0) /
			olderSessions.filter((s) => s.average_calibration !== null).length;

		const calibration_trend =
			recentCalibration > olderCalibration + 0.05
				? "improving"
				: recentCalibration < olderCalibration - 0.05
					? "declining"
					: "stable";

		// Calculate success rates
		const recentSuccessRate =
			recentSessions.reduce((sum, s) => sum + s.success_count, 0) /
			recentSessions.reduce((sum, s) => sum + s.task_count, 0);

		const olderSuccessRate =
			olderSessions.reduce((sum, s) => sum + s.success_count, 0) /
			olderSessions.reduce((sum, s) => sum + s.task_count, 0);

		const success_rate_trend =
			recentSuccessRate > olderSuccessRate + 0.1
				? "improving"
				: recentSuccessRate < olderSuccessRate - 0.1
					? "declining"
					: "stable";

		return {
			calibration_trend,
			success_rate_trend,
		};
	}

	/**
	 * Clean up stale locks from crashed processes
	 * This runs on startup to ensure we don't have lingering locks
	 */
	private cleanupStaleLocks(): void {
		try {
			// Roll back any uncommitted transactions (from crashed processes)
			if (this.db.inTransaction) {
				this.db.exec("ROLLBACK");
			}

			// Run WAL checkpoint to merge WAL into main database
			// This also releases any old locks from the WAL file
			this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
		} catch (_error) {
			// Ignore errors during cleanup - database might be fine
			// The busy_timeout will handle any remaining lock issues
		}
	}

	/**
	 * Close the database connection
	 */
	close(): void {
		// Ensure clean shutdown
		try {
			if (this.db.inTransaction) {
				this.db.exec("ROLLBACK");
			}
			// Checkpoint WAL before closing
			this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
		} catch (_error) {
			// Ignore errors during cleanup
		}
		this.db.close();
	}
}
