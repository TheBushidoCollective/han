/**
 * Unit tests for config-validator.ts
 * Tests validation logic for han-config.json and han-config.yml files.
 */
import { describe, expect, test } from "bun:test";
import {
	formatValidationErrors,
	validatePluginConfig,
	validateUserConfig,
} from "../lib/config-validator.ts";

describe("Config Validator", () => {
	describe("validatePluginConfig", () => {
		describe("valid configs", () => {
			test("validates minimal config", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: { command: "npm run lint" },
					},
				});
				expect(result.valid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});

			test("validates config with all hook properties", () => {
				const result = validatePluginConfig({
					hooks: {
						test: {
							command: "npm test",
							dirsWith: ["package.json"],
							dirTest: "test -f jest.config.ts",
							description: "Run tests",
							ifChanged: ["**/*.ts", "**/*.tsx"],
							idleTimeout: 30000,
						},
					},
				});
				expect(result.valid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});

			test("validates config with multiple hooks", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: { command: "npm run lint" },
						test: { command: "npm test" },
						typecheck: { command: "tsc --noEmit" },
					},
				});
				expect(result.valid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});

			test("validates empty hooks object", () => {
				const result = validatePluginConfig({ hooks: {} });
				expect(result.valid).toBe(true);
			});
		});

		describe("invalid configs - top level", () => {
			test("rejects non-object config", () => {
				const result = validatePluginConfig(null);
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe("Config must be an object");
			});

			test("rejects string config", () => {
				const result = validatePluginConfig("invalid");
				expect(result.valid).toBe(false);
			});

			test("rejects config without hooks", () => {
				const result = validatePluginConfig({});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe(
					"Missing required property 'hooks'",
				);
			});

			test("rejects hooks as non-object", () => {
				const result = validatePluginConfig({ hooks: "invalid" });
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe("'hooks' must be an object");
			});

			test("rejects hooks as null", () => {
				const result = validatePluginConfig({ hooks: null });
				expect(result.valid).toBe(false);
			});

			test("rejects unknown top-level properties", () => {
				const result = validatePluginConfig({
					hooks: { lint: { command: "lint" } },
					unknown: "value",
				});
				expect(result.valid).toBe(false);
				expect(result.errors.some((e) => e.message.includes("Unknown"))).toBe(
					true,
				);
			});
		});

		describe("invalid configs - hook level", () => {
			test("rejects hook without command", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: {},
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toContain("'command' is required");
			});

			test("rejects hook with non-string command", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: { command: 123 },
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toContain("'command'");
			});

			test("rejects hook as non-object", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: "npm run lint",
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe(
					"Hook definition must be an object",
				);
			});

			test("rejects dirsWith as non-array", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: { command: "lint", dirsWith: "package.json" },
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe("'dirsWith' must be an array");
			});

			test("rejects dirsWith with non-strings", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: { command: "lint", dirsWith: ["package.json", 123] },
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe(
					"'dirsWith' must contain only strings",
				);
			});

			test("rejects dirTest as non-string", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: { command: "lint", dirTest: 123 },
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe("'dirTest' must be a string");
			});

			test("rejects description as non-string", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: { command: "lint", description: 123 },
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe("'description' must be a string");
			});

			test("rejects ifChanged as non-array", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: { command: "lint", ifChanged: "**/*.ts" },
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe("'ifChanged' must be an array");
			});

			test("rejects ifChanged with non-strings", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: { command: "lint", ifChanged: ["**/*.ts", 123] },
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe(
					"'ifChanged' must contain only strings",
				);
			});

			test("rejects idleTimeout as non-number", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: { command: "lint", idleTimeout: "30000" },
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toContain("'idleTimeout'");
			});

			test("rejects idleTimeout as float", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: { command: "lint", idleTimeout: 30.5 },
					},
				});
				expect(result.valid).toBe(false);
			});

			test("rejects negative idleTimeout", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: { command: "lint", idleTimeout: -1000 },
					},
				});
				expect(result.valid).toBe(false);
			});

			test("rejects unknown hook properties", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: { command: "lint", unknownProp: "value" },
					},
				});
				expect(result.valid).toBe(false);
				expect(
					result.errors.some((e) => e.message.includes("Unknown property")),
				).toBe(true);
			});
		});

		describe("multiple errors", () => {
			test("collects multiple errors", () => {
				const result = validatePluginConfig({
					hooks: {
						lint: { command: 123, dirsWith: "invalid" },
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors.length).toBeGreaterThan(1);
			});
		});
	});

	describe("validateUserConfig", () => {
		describe("valid configs", () => {
			test("validates minimal override", () => {
				const result = validateUserConfig({
					"jutsu-typescript": {
						typecheck: { enabled: false },
					},
				});
				expect(result.valid).toBe(true);
			});

			test("validates command override", () => {
				const result = validateUserConfig({
					"jutsu-biome": {
						lint: { command: "biome check --fix" },
					},
				});
				expect(result.valid).toBe(true);
			});

			test("validates if_changed override", () => {
				const result = validateUserConfig({
					"jutsu-typescript": {
						typecheck: { if_changed: ["**/*.tsx", "tsconfig.json"] },
					},
				});
				expect(result.valid).toBe(true);
			});

			test("validates idle_timeout as number", () => {
				const result = validateUserConfig({
					"jutsu-test": {
						test: { idle_timeout: 60000 },
					},
				});
				expect(result.valid).toBe(true);
			});

			test("validates idle_timeout as false", () => {
				const result = validateUserConfig({
					"jutsu-test": {
						test: { idle_timeout: false },
					},
				});
				expect(result.valid).toBe(true);
			});

			test("validates idle_timeout as 0", () => {
				const result = validateUserConfig({
					"jutsu-test": {
						test: { idle_timeout: 0 },
					},
				});
				expect(result.valid).toBe(true);
			});

			test("validates empty config", () => {
				const result = validateUserConfig({});
				expect(result.valid).toBe(true);
			});

			test("validates multiple plugins", () => {
				const result = validateUserConfig({
					"jutsu-typescript": {
						typecheck: { enabled: false },
					},
					"jutsu-biome": {
						lint: { command: "biome check --fix" },
					},
				});
				expect(result.valid).toBe(true);
			});
		});

		describe("invalid configs - top level", () => {
			test("rejects non-object config", () => {
				const result = validateUserConfig(null);
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe("Config must be an object");
			});

			test("rejects string config", () => {
				const result = validateUserConfig("invalid");
				expect(result.valid).toBe(false);
			});
		});

		describe("invalid configs - plugin level", () => {
			test("rejects plugin overrides as non-object", () => {
				const result = validateUserConfig({
					"jutsu-typescript": "invalid",
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe(
					"Plugin overrides must be an object",
				);
			});

			test("rejects plugin overrides as null", () => {
				const result = validateUserConfig({
					"jutsu-typescript": null,
				});
				expect(result.valid).toBe(false);
			});
		});

		describe("invalid configs - hook override level", () => {
			test("rejects hook override as non-object", () => {
				const result = validateUserConfig({
					"jutsu-typescript": {
						typecheck: "disabled",
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe(
					"Hook override must be an object",
				);
			});

			test("rejects enabled as non-boolean", () => {
				const result = validateUserConfig({
					"jutsu-typescript": {
						typecheck: { enabled: "false" },
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe("'enabled' must be a boolean");
			});

			test("rejects command as non-string", () => {
				const result = validateUserConfig({
					"jutsu-biome": {
						lint: { command: 123 },
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe("'command' must be a string");
			});

			test("rejects if_changed as non-array", () => {
				const result = validateUserConfig({
					"jutsu-typescript": {
						typecheck: { if_changed: "**/*.ts" },
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe("'if_changed' must be an array");
			});

			test("rejects if_changed with non-strings", () => {
				const result = validateUserConfig({
					"jutsu-typescript": {
						typecheck: { if_changed: ["**/*.ts", 123] },
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toBe(
					"'if_changed' must contain only strings",
				);
			});

			test("rejects idle_timeout as invalid string", () => {
				const result = validateUserConfig({
					"jutsu-test": {
						test: { idle_timeout: "30000" },
					},
				});
				expect(result.valid).toBe(false);
				expect(result.errors[0].message).toContain("'idle_timeout'");
			});

			test("rejects negative idle_timeout", () => {
				const result = validateUserConfig({
					"jutsu-test": {
						test: { idle_timeout: -1000 },
					},
				});
				expect(result.valid).toBe(false);
			});

			test("rejects unknown override properties", () => {
				const result = validateUserConfig({
					"jutsu-typescript": {
						typecheck: { unknownProp: "value" },
					},
				});
				expect(result.valid).toBe(false);
				expect(
					result.errors.some((e) => e.message.includes("Unknown property")),
				).toBe(true);
			});
		});
	});

	describe("formatValidationErrors", () => {
		test("formats valid result", () => {
			const result = formatValidationErrors("test.json", {
				valid: true,
				errors: [],
			});
			expect(result).toBe("test.json: Valid");
		});

		test("formats single error", () => {
			const result = formatValidationErrors("test.json", {
				valid: false,
				errors: [{ path: "hooks", message: "Invalid hooks" }],
			});
			expect(result).toContain("test.json: Invalid configuration");
			expect(result).toContain("Invalid hooks");
			expect(result).toContain("'hooks'");
		});

		test("formats multiple errors", () => {
			const result = formatValidationErrors("test.json", {
				valid: false,
				errors: [
					{ path: "hooks.lint", message: "Missing command" },
					{ path: "hooks.test", message: "Invalid dirsWith" },
				],
			});
			expect(result).toContain("Missing command");
			expect(result).toContain("Invalid dirsWith");
		});

		test("formats error without path", () => {
			const result = formatValidationErrors("test.json", {
				valid: false,
				errors: [{ path: "", message: "Config must be an object" }],
			});
			expect(result).toContain("Config must be an object");
			expect(result).not.toContain(" at ''");
		});
	});
});
