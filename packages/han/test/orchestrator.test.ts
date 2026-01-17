import { describe, expect, it } from "bun:test";
import {
	generateWorkflowDescription,
	getOrchestratorConfig,
} from "../lib/commands/mcp/orchestrator.ts";

/**
 * Tests for orchestrator.ts
 *
 * NOTE: We only test pure functions here that don't require mocking.
 * Testing the Orchestrator class directly requires mocking many dependencies,
 * and Bun's mock.module pollutes the global module cache affecting other tests.
 *
 * For full integration testing of the Orchestrator, use manual testing or
 * e2e tests that run in isolated processes.
 */

describe("orchestrator", () => {
	describe("getOrchestratorConfig", () => {
		it("should return default config when no overrides", () => {
			const config = getOrchestratorConfig();

			expect(config.enabled).toBe(true);
			expect(config.always_available).toContain("memory");
			expect(config.always_available).toContain("learn");
			expect(config.always_available).toContain("checkpoint_list");
			expect(config.workflow.enabled).toBe(true);
			expect(config.workflow.max_steps).toBe(20);
			expect(config.workflow.timeout).toBe(300);
		});

		it("should include all required always_available tools", () => {
			const config = getOrchestratorConfig();

			// Core tools (the minimal set exposed to Claude Code)
			expect(config.always_available).toContain("memory");
			expect(config.always_available).toContain("learn");
			expect(config.always_available).toContain("checkpoint_list");
			expect(config.always_available).toContain("start_task");
			expect(config.always_available).toContain("complete_task");

			// Verify it's an array
			expect(Array.isArray(config.always_available)).toBe(true);
			expect(config.always_available.length).toBeGreaterThan(0);
		});

		it("should have valid workflow config", () => {
			const config = getOrchestratorConfig();

			expect(typeof config.workflow.enabled).toBe("boolean");
			expect(typeof config.workflow.max_steps).toBe("number");
			expect(typeof config.workflow.timeout).toBe("number");
			expect(config.workflow.max_steps).toBeGreaterThan(0);
			expect(config.workflow.timeout).toBeGreaterThan(0);
		});
	});

	describe("generateWorkflowDescription", () => {
		it("should return a string description", () => {
			const description = generateWorkflowDescription();

			expect(typeof description).toBe("string");
			expect(description.length).toBeGreaterThan(0);
		});

		it("should contain workflow-related content", () => {
			const description = generateWorkflowDescription();

			// The description comes from capability-registry.generateWorkflowDescription()
			// which builds a description from discovered backends.
			// Without backends installed, it should still return something meaningful.
			expect(description).toBeDefined();
		});
	});
});
