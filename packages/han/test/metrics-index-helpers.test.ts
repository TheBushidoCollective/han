/**
 * Tests for exported helper functions in commands/metrics/index.ts
 * These are pure validation functions that can be tested without side effects
 */
import { describe, expect, test } from "bun:test";

import {
	validatePeriod,
	validateTaskType,
} from "../lib/commands/metrics/index.ts";

describe("commands/metrics/index.ts helper functions", () => {
	describe("validatePeriod", () => {
		test("accepts 'day'", () => {
			const result = validatePeriod("day");
			expect(result).toBe("day");
		});

		test("accepts 'week'", () => {
			const result = validatePeriod("week");
			expect(result).toBe("week");
		});

		test("accepts 'month'", () => {
			const result = validatePeriod("month");
			expect(result).toBe("month");
		});

		test("throws for invalid period 'year'", () => {
			expect(() => validatePeriod("year")).toThrow(
				'Invalid period "year". Must be one of: day, week, month',
			);
		});

		test("throws for invalid period 'hour'", () => {
			expect(() => validatePeriod("hour")).toThrow(
				'Invalid period "hour". Must be one of: day, week, month',
			);
		});

		test("throws for empty string", () => {
			expect(() => validatePeriod("")).toThrow(
				'Invalid period "". Must be one of: day, week, month',
			);
		});

		test("throws for random string", () => {
			expect(() => validatePeriod("invalid")).toThrow(
				'Invalid period "invalid". Must be one of: day, week, month',
			);
		});

		test("is case-sensitive (DAY throws)", () => {
			expect(() => validatePeriod("DAY")).toThrow(
				'Invalid period "DAY". Must be one of: day, week, month',
			);
		});
	});

	describe("validateTaskType", () => {
		test("accepts 'implementation'", () => {
			const result = validateTaskType("implementation");
			expect(result).toBe("implementation");
		});

		test("accepts 'fix'", () => {
			const result = validateTaskType("fix");
			expect(result).toBe("fix");
		});

		test("accepts 'refactor'", () => {
			const result = validateTaskType("refactor");
			expect(result).toBe("refactor");
		});

		test("accepts 'research'", () => {
			const result = validateTaskType("research");
			expect(result).toBe("research");
		});

		test("throws for invalid type 'build'", () => {
			expect(() => validateTaskType("build")).toThrow(
				'Invalid task type "build". Must be one of: implementation, fix, refactor, research',
			);
		});

		test("throws for invalid type 'test'", () => {
			expect(() => validateTaskType("test")).toThrow(
				'Invalid task type "test". Must be one of: implementation, fix, refactor, research',
			);
		});

		test("throws for empty string", () => {
			expect(() => validateTaskType("")).toThrow(
				'Invalid task type "". Must be one of: implementation, fix, refactor, research',
			);
		});

		test("is case-sensitive (FIX throws)", () => {
			expect(() => validateTaskType("FIX")).toThrow(
				'Invalid task type "FIX". Must be one of: implementation, fix, refactor, research',
			);
		});

		test("is case-sensitive (Implementation throws)", () => {
			expect(() => validateTaskType("Implementation")).toThrow(
				'Invalid task type "Implementation". Must be one of: implementation, fix, refactor, research',
			);
		});
	});
});
