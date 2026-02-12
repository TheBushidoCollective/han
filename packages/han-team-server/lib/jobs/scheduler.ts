/**
 * Job Scheduler
 *
 * Simple cron-like scheduler for background jobs using Bun's setInterval.
 *
 * @description For MVP, we use a simple interval-based scheduler.
 * In production, consider using:
 * - Redis-based distributed locking for multi-instance deployments
 * - A dedicated job queue (Bull, Agenda, etc.)
 */

import { getRetentionService } from "./retention-service.ts";

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  /** Whether to enable the scheduler */
  enabled: boolean;
  /** Hour to run retention job (0-23, UTC) */
  retentionHour: number;
  /** Minute to run retention job (0-59) */
  retentionMinute: number;
}

/**
 * Default configuration: 3am UTC daily
 */
export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  enabled: true,
  retentionHour: 3,
  retentionMinute: 0,
};

/**
 * Parse scheduler config from environment
 */
export function parseSchedulerConfig(): SchedulerConfig {
  const enabled = process.env.RETENTION_SCHEDULER_ENABLED !== "false";
  const cronTime = process.env.RETENTION_CRON_TIME || "03:00";

  const [hourStr, minuteStr] = cronTime.split(":");
  const retentionHour = parseInt(hourStr || "3", 10);
  const retentionMinute = parseInt(minuteStr || "0", 10);

  return {
    enabled,
    retentionHour: Math.max(0, Math.min(23, retentionHour)),
    retentionMinute: Math.max(0, Math.min(59, retentionMinute)),
  };
}

/**
 * Calculate milliseconds until next scheduled time
 */
export function msUntilNextRun(hour: number, minute: number): number {
  const now = new Date();
  const target = new Date(now);

  target.setUTCHours(hour, minute, 0, 0);

  // If target is in the past, move to tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  return target.getTime() - now.getTime();
}

/**
 * Get next scheduled run date
 */
export function getNextRunDate(hour: number, minute: number): Date {
  const now = new Date();
  const target = new Date(now);

  target.setUTCHours(hour, minute, 0, 0);

  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  return target;
}

/**
 * Retention Job Scheduler
 *
 * Schedules and manages the retention cleanup job.
 */
export class RetentionScheduler {
  private config: SchedulerConfig;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;

  constructor(config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG) {
    this.config = config;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (!this.config.enabled) {
      console.log("[Scheduler] Retention scheduler disabled by configuration");
      return;
    }

    if (this.isRunning) {
      console.log("[Scheduler] Scheduler already running");
      return;
    }

    this.isRunning = true;
    this.scheduleNextRun();

    console.log(
      `[Scheduler] Retention scheduler started. Next run at ${this.config.retentionHour.toString().padStart(2, "0")}:${this.config.retentionMinute.toString().padStart(2, "0")} UTC`
    );
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.isRunning = false;

    try {
      const retentionService = getRetentionService();
      retentionService.setNextScheduledRun(null);
    } catch {
      // Service may not be initialized
    }

    console.log("[Scheduler] Retention scheduler stopped");
  }

  /**
   * Schedule the next run
   */
  private scheduleNextRun(): void {
    const ms = msUntilNextRun(
      this.config.retentionHour,
      this.config.retentionMinute
    );
    const nextRun = getNextRunDate(
      this.config.retentionHour,
      this.config.retentionMinute
    );

    // Update retention service with next run time
    try {
      const retentionService = getRetentionService();
      retentionService.setNextScheduledRun(nextRun);
    } catch {
      // Service may not be initialized yet
    }

    console.log(
      `[Scheduler] Next retention job scheduled for ${nextRun.toISOString()} (in ${Math.round(ms / 1000 / 60)} minutes)`
    );

    this.timeoutId = setTimeout(() => {
      this.runRetentionJob();
    }, ms);
  }

  /**
   * Run the retention job
   */
  private async runRetentionJob(): Promise<void> {
    console.log("[Scheduler] Starting scheduled retention job...");

    try {
      const retentionService = getRetentionService();
      const result = await retentionService.cleanupExpiredSessions(false);

      console.log(
        `[Scheduler] Retention job completed. Deleted ${result.deletedCount} sessions ` +
          `(FREE: ${result.byTier.free}, PRO: ${result.byTier.pro}) ` +
          `in ${result.durationMs}ms`
      );

      if (result.errors.length > 0) {
        console.warn(
          `[Scheduler] ${result.errors.length} sessions failed to delete`
        );
      }
    } catch (error) {
      console.error("[Scheduler] Retention job failed:", error);
    }

    // Schedule next run
    if (this.isRunning) {
      this.scheduleNextRun();
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    enabled: boolean;
    isRunning: boolean;
    config: SchedulerConfig;
    nextRunIn: number | null;
  } {
    return {
      enabled: this.config.enabled,
      isRunning: this.isRunning,
      config: this.config,
      nextRunIn: this.timeoutId
        ? msUntilNextRun(
            this.config.retentionHour,
            this.config.retentionMinute
          )
        : null,
    };
  }
}

/**
 * Singleton scheduler instance
 */
let schedulerInstance: RetentionScheduler | null = null;

/**
 * Get scheduler singleton
 */
export function getScheduler(): RetentionScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new RetentionScheduler(parseSchedulerConfig());
  }
  return schedulerInstance;
}

/**
 * Start the global scheduler
 */
export function startScheduler(): void {
  getScheduler().start();
}

/**
 * Stop the global scheduler
 */
export function stopScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
  }
}

/**
 * Reset scheduler singleton (for testing)
 */
export function resetScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
  }
  schedulerInstance = null;
}
