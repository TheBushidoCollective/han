import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDiagnostics } from "../lib/commands/doctor.ts";

describe("doctor command", () => {
	let testDir: string;
	let originalArgv: string[];
	let originalEnv: NodeJS.ProcessEnv;
	let originalCwd: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `han-doctor-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalArgv = process.argv;
		originalEnv = { ...process.env };
		originalCwd = process.cwd();
		process.chdir(testDir);
	});

	afterEach(() => {
		process.argv = originalArgv;
		process.env = originalEnv;
		process.chdir(originalCwd);
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("runDiagnostics", () => {
		test("returns array of diagnostic results", () => {
			const results = runDiagnostics();

			expect(Array.isArray(results)).toBe(true);
			expect(results.length).toBeGreaterThan(0);
		});

		test("each result has required properties", () => {
			const results = runDiagnostics();

			for (const result of results) {
				expect(result).toHaveProperty("name");
				expect(result).toHaveProperty("status");
				expect(result).toHaveProperty("message");
				expect(["ok", "warning", "error"]).toContain(result.status);
			}
		});

		test("includes Binary check", () => {
			const results = runDiagnostics();
			const binaryCheck = results.find((r) => r.name === "Binary");

			expect(binaryCheck).toBeDefined();
			expect(binaryCheck?.status).toBe("ok");
		});

		test("includes hanBinary Override check", () => {
			const results = runDiagnostics();
			const overrideCheck = results.find(
				(r) => r.name === "hanBinary Override",
			);

			expect(overrideCheck).toBeDefined();
		});

		test("includes Config Files check", () => {
			const results = runDiagnostics();
			const configCheck = results.find((r) => r.name === "Config Files");

			expect(configCheck).toBeDefined();
		});

		test("includes Installed Plugins check", () => {
			const results = runDiagnostics();
			const pluginsCheck = results.find((r) => r.name === "Installed Plugins");

			expect(pluginsCheck).toBeDefined();
		});

		test("includes Native Module check", () => {
			const results = runDiagnostics();
			const nativeCheck = results.find((r) => r.name === "Native Module");

			expect(nativeCheck).toBeDefined();
		});

		test("includes Global Hooks check", () => {
			const results = runDiagnostics();
			const hooksCheck = results.find((r) => r.name === "Global Hooks");

			expect(hooksCheck).toBeDefined();
		});

		test("includes Memory System check", () => {
			const results = runDiagnostics();
			const memoryCheck = results.find((r) => r.name === "Memory System");

			expect(memoryCheck).toBeDefined();
		});
	});

	describe("hanBinary Override check", () => {
		test("reports hanBinary status", () => {
			const results = runDiagnostics();
			const overrideCheck = results.find(
				(r) => r.name === "hanBinary Override",
			);

			// May or may not be configured depending on user's ~/.claude/han.yml
			expect(overrideCheck).toBeDefined();
			expect(overrideCheck?.message).toBeDefined();
		});

		test("reports active when HAN_REEXEC is set and hanBinary configured", () => {
			mkdirSync(join(testDir, ".claude"), { recursive: true });
			writeFileSync(
				join(testDir, ".claude", "han.yml"),
				"hanBinary: bun run /dev/han/lib/main.ts\n",
			);
			process.env.HAN_REEXEC = "1";

			const results = runDiagnostics();
			const overrideCheck = results.find(
				(r) => r.name === "hanBinary Override",
			);

			expect(overrideCheck?.status).toBe("ok");
			expect(overrideCheck?.details).toContain("Override is active");
		});
	});

	describe("Config Files check", () => {
		test("reports found when config file exists in project", () => {
			mkdirSync(join(testDir, ".claude"), { recursive: true });
			writeFileSync(
				join(testDir, ".claude", "han.yml"),
				"hooks:\n  enabled: true\n",
			);

			const results = runDiagnostics();
			const configCheck = results.find((r) => r.name === "Config Files");

			expect(configCheck?.status).toBe("ok");
			expect(
				configCheck?.details?.some((d) => d.includes(".claude/han.yml ✓")),
			).toBe(true);
		});

		test("config check always runs", () => {
			const results = runDiagnostics();
			const configCheck = results.find((r) => r.name === "Config Files");

			// Always defined regardless of config presence
			expect(configCheck).toBeDefined();
		});
	});
});
