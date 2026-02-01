/**
 * Scheduler Tests
 *
 * Tests for the retention job scheduler.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  mock,
} from "bun:test";
import type { Pool, QueryResult } from "pg";

// Mock retention service
const mockCleanupExpiredSessions = mock(() =>
  Promise.resolve({
    deletedCount: 5,
    batchesProcessed: 1,
    byTier: { free: 3, pro: 2 },
    timestamp: new Date(),
    durationMs: 100,
    dryRun: false,
    errors: [],
  })
);

const mockGetJobStatus = mock(() => ({
  lastRun: null,
  lastResult: null,
  isRunning: false,
  nextScheduledRun: null,
}));

const mockSetNextScheduledRun = mock(() => {});

mock.module("../lib/jobs/retention-service.ts", () => ({
  getRetentionService: () => ({
    cleanupExpiredSessions: mockCleanupExpiredSessions,
    getJobStatus: mockGetJobStatus,
    setNextScheduledRun: mockSetNextScheduledRun,
  }),
  initRetentionService: () => ({
    cleanupExpiredSessions: mockCleanupExpiredSessions,
    getJobStatus: mockGetJobStatus,
    setNextScheduledRun: mockSetNextScheduledRun,
  }),
  resetRetentionService: () => {},
  RETENTION_DAYS: { free: 30, pro: 365 },
  BATCH_SIZE: 100,
}));

import {
  RetentionScheduler,
  msUntilNextRun,
  getNextRunDate,
  parseSchedulerConfig,
  DEFAULT_SCHEDULER_CONFIG,
  getScheduler,
  resetScheduler,
} from "../lib/jobs/scheduler.ts";

describe("Scheduler utilities", () => {
  describe("msUntilNextRun", () => {
    it("calculates time until next run today", () => {
      const now = new Date();
      const targetHour = now.getUTCHours() + 1;
      const targetMinute = 0;

      if (targetHour < 24) {
        const ms = msUntilNextRun(targetHour, targetMinute);

        // Should be roughly 1 hour (within tolerance for test execution time)
        expect(ms).toBeGreaterThan(0);
        expect(ms).toBeLessThanOrEqual(60 * 60 * 1000 + 1000); // 1 hour + 1 sec tolerance
      }
    });

    it("calculates time until next run tomorrow if past target time", () => {
      const now = new Date();
      const targetHour = now.getUTCHours(); // Current hour
      const targetMinute = 0;

      // If we're past the target minute, it should schedule for tomorrow
      if (now.getUTCMinutes() > 0) {
        const ms = msUntilNextRun(targetHour, targetMinute);

        // Should be roughly 23-24 hours
        expect(ms).toBeGreaterThan(22 * 60 * 60 * 1000);
        expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
      }
    });
  });

  describe("getNextRunDate", () => {
    it("returns correct date for future time today", () => {
      const now = new Date();
      const targetHour = (now.getUTCHours() + 2) % 24; // 2 hours from now
      const targetMinute = 30;

      const nextRun = getNextRunDate(targetHour, targetMinute);

      expect(nextRun.getUTCHours()).toBe(targetHour);
      expect(nextRun.getUTCMinutes()).toBe(targetMinute);
      expect(nextRun.getTime()).toBeGreaterThan(now.getTime());
    });

    it("returns next day for past time", () => {
      const now = new Date();
      const targetHour = now.getUTCHours();
      const targetMinute = 0;

      // If current minute > 0, should be tomorrow
      if (now.getUTCMinutes() > 0) {
        const nextRun = getNextRunDate(targetHour, targetMinute);
        const tomorrow = new Date(now);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

        expect(nextRun.getUTCDate()).toBe(tomorrow.getUTCDate());
      }
    });
  });

  describe("parseSchedulerConfig", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("returns default config when no env vars set", () => {
      delete process.env.RETENTION_SCHEDULER_ENABLED;
      delete process.env.RETENTION_CRON_TIME;

      const config = parseSchedulerConfig();

      expect(config.enabled).toBe(true);
      expect(config.retentionHour).toBe(3);
      expect(config.retentionMinute).toBe(0);
    });

    it("respects RETENTION_SCHEDULER_ENABLED=false", () => {
      process.env.RETENTION_SCHEDULER_ENABLED = "false";

      const config = parseSchedulerConfig();

      expect(config.enabled).toBe(false);
    });

    it("parses RETENTION_CRON_TIME", () => {
      process.env.RETENTION_CRON_TIME = "15:30";

      const config = parseSchedulerConfig();

      expect(config.retentionHour).toBe(15);
      expect(config.retentionMinute).toBe(30);
    });

    it("clamps invalid hour values", () => {
      process.env.RETENTION_CRON_TIME = "25:00";

      const config = parseSchedulerConfig();

      expect(config.retentionHour).toBe(23); // Clamped to max
    });

    it("clamps invalid minute values", () => {
      process.env.RETENTION_CRON_TIME = "12:90";

      const config = parseSchedulerConfig();

      expect(config.retentionMinute).toBe(59); // Clamped to max
    });
  });
});

describe("RetentionScheduler", () => {
  let scheduler: RetentionScheduler;

  beforeEach(() => {
    mockCleanupExpiredSessions.mockClear();
    mockSetNextScheduledRun.mockClear();
    resetScheduler();
  });

  afterEach(() => {
    if (scheduler) {
      scheduler.stop();
    }
  });

  describe("constructor", () => {
    it("uses default config", () => {
      scheduler = new RetentionScheduler();
      const status = scheduler.getStatus();

      expect(status.config).toEqual(DEFAULT_SCHEDULER_CONFIG);
    });

    it("accepts custom config", () => {
      scheduler = new RetentionScheduler({
        enabled: false,
        retentionHour: 12,
        retentionMinute: 30,
      });

      const status = scheduler.getStatus();

      expect(status.config.enabled).toBe(false);
      expect(status.config.retentionHour).toBe(12);
      expect(status.config.retentionMinute).toBe(30);
    });
  });

  describe("start", () => {
    it("does not start when disabled", () => {
      scheduler = new RetentionScheduler({
        ...DEFAULT_SCHEDULER_CONFIG,
        enabled: false,
      });

      scheduler.start();

      const status = scheduler.getStatus();
      expect(status.isRunning).toBe(false);
    });

    it("starts and schedules next run", () => {
      scheduler = new RetentionScheduler({
        ...DEFAULT_SCHEDULER_CONFIG,
        enabled: true,
      });

      scheduler.start();

      const status = scheduler.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.nextRunIn).not.toBeNull();
    });

    it("ignores duplicate start calls", () => {
      scheduler = new RetentionScheduler({
        ...DEFAULT_SCHEDULER_CONFIG,
        enabled: true,
      });

      scheduler.start();
      scheduler.start(); // Should not throw or create duplicate timers

      const status = scheduler.getStatus();
      expect(status.isRunning).toBe(true);
    });
  });

  describe("stop", () => {
    it("stops the scheduler", () => {
      scheduler = new RetentionScheduler({
        ...DEFAULT_SCHEDULER_CONFIG,
        enabled: true,
      });

      scheduler.start();
      scheduler.stop();

      const status = scheduler.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.nextRunIn).toBeNull();
    });

    it("clears next scheduled run", () => {
      scheduler = new RetentionScheduler({
        ...DEFAULT_SCHEDULER_CONFIG,
        enabled: true,
      });

      scheduler.start();
      scheduler.stop();

      expect(mockSetNextScheduledRun).toHaveBeenCalledWith(null);
    });
  });

  describe("getStatus", () => {
    it("returns complete status information", () => {
      scheduler = new RetentionScheduler({
        enabled: true,
        retentionHour: 5,
        retentionMinute: 15,
      });

      scheduler.start();
      const status = scheduler.getStatus();

      expect(status).toHaveProperty("enabled", true);
      expect(status).toHaveProperty("isRunning", true);
      expect(status).toHaveProperty("config");
      expect(status).toHaveProperty("nextRunIn");
      expect(status.config.retentionHour).toBe(5);
      expect(status.config.retentionMinute).toBe(15);
    });
  });
});

describe("Scheduler singleton", () => {
  beforeEach(() => {
    resetScheduler();
  });

  afterEach(() => {
    resetScheduler();
  });

  it("getScheduler returns consistent instance", () => {
    const s1 = getScheduler();
    const s2 = getScheduler();

    expect(s1).toBe(s2);
  });

  it("resetScheduler creates new instance", () => {
    const s1 = getScheduler();
    resetScheduler();
    const s2 = getScheduler();

    expect(s1).not.toBe(s2);
  });
});
