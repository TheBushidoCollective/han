import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDiagnostics } from "../lib/commands/doctor.ts";

// Skip tests that require native module when SKIP_NATIVE is set
// runDiagnostics() calls checkNativeModule() which requires the native module
const SKIP_NATIVE = process.env.SKIP_NATIVE === "true";
const testWithNative = SKIP_NATIVE ? test.skip : test;

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
		testWithNative(
			"returns array of diagnostic results",
			() => {
				const results = runDiagnostics();

				expect(Array.isArray(results)).toBe(true);
				expect(results.length).toBeGreaterThan(0);
			},
			{ timeout: 30000 },
		);

		testWithNative("each result has required properties", () => {
			const results = runDiagnostics();

			for (const result of results) {
				expect(result).toHaveProperty("name");
				expect(result).toHaveProperty("status");
				expect(result).toHaveProperty("message");
				expect(["ok", "warning", "error"]).toContain(result.status);
			}
		});

		testWithNative("includes Binary check", () => {
			const results = runDiagnostics();
			const binaryCheck = results.find((r) => r.name === "Binary");

			expect(binaryCheck).toBeDefined();
			expect(binaryCheck?.status).toBe("ok");
		});

		testWithNative("includes hanBinary Override check", () => {
			const results = runDiagnostics();
			const overrideCheck = results.find(
				(r) => r.name === "hanBinary Override",
			);

			expect(overrideCheck).toBeDefined();
		});

		testWithNative("includes Config Files check", () => {
			const results = runDiagnostics();
			const configCheck = results.find((r) => r.name === "Config Files");

			expect(configCheck).toBeDefined();
		});

		testWithNative("includes Enabled Plugins check", () => {
			const results = runDiagnostics();
			const pluginsCheck = results.find((r) => r.name === "Enabled Plugins");

			expect(pluginsCheck).toBeDefined();
		});

		testWithNative("includes Native Module check", () => {
			const results = runDiagnostics();
			const nativeCheck = results.find((r) => r.name === "Native Module");

			expect(nativeCheck).toBeDefined();
		});

		testWithNative("includes Dispatch Hooks check", () => {
			const results = runDiagnostics();
			const hooksCheck = results.find((r) => r.name === "Dispatch Hooks");

			expect(hooksCheck).toBeDefined();
		});

		testWithNative("includes Memory System check", () => {
			const results = runDiagnostics();
			const memoryCheck = results.find((r) => r.name === "Memory System");

			expect(memoryCheck).toBeDefined();
		});
	});

	describe("hanBinary Override check", () => {
		testWithNative("reports hanBinary status", () => {
			const results = runDiagnostics();
			const overrideCheck = results.find(
				(r) => r.name === "hanBinary Override",
			);

			// May or may not be configured depending on user's ~/.claude/han.yml
			expect(overrideCheck).toBeDefined();
			expect(overrideCheck?.message).toBeDefined();
		});

		testWithNative("reports active when HAN_REEXEC is set and hanBinary configured", () => {
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
		testWithNative("reports found when config file exists in project", () => {
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

		testWithNative("config check always runs", () => {
			const results = runDiagnostics();
			const configCheck = results.find((r) => r.name === "Config Files");

			// Always defined regardless of config presence
			expect(configCheck).toBeDefined();
		});

		testWithNative("detects han.local.yml", () => {
			mkdirSync(join(testDir, ".claude"), { recursive: true });
			writeFileSync(
				join(testDir, ".claude", "han.local.yml"),
				"hooks:\n  enabled: false\n",
			);

			const results = runDiagnostics();
			const configCheck = results.find((r) => r.name === "Config Files");

			expect(configCheck?.status).toBe("ok");
			expect(
				configCheck?.details?.some((d) =>
					d.includes(".claude/han.local.yml ✓"),
				),
			).toBe(true);
		});

		testWithNative("detects root han.yml", () => {
			writeFileSync(join(testDir, "han.yml"), "plugins: {}\n");

			const results = runDiagnostics();
			const configCheck = results.find((r) => r.name === "Config Files");

			expect(configCheck?.status).toBe("ok");
			expect(configCheck?.details?.some((d) => d.includes("han.yml ✓"))).toBe(
				true,
			);
		});
	});

	describe("Enabled Plugins check", () => {
		testWithNative("reports count of installed plugins", () => {
			const results = runDiagnostics();
			const pluginsCheck = results.find((r) => r.name === "Enabled Plugins");

			expect(pluginsCheck).toBeDefined();
			expect(pluginsCheck?.message).toMatch(/\d+ plugins/);
		});

		testWithNative("lists installed plugin types", () => {
			// Create mock plugin structure
			const _pluginsDir = join(
				originalEnv.HOME || "",
				".claude",
				"plugins",
				"marketplaces",
				"han",
			);

			const results = runDiagnostics();
			const pluginsCheck = results.find((r) => r.name === "Enabled Plugins");

			expect(pluginsCheck?.details).toBeDefined();
			expect(Array.isArray(pluginsCheck?.details)).toBe(true);
		});
	});

	describe("Native Module check", () => {
		testWithNative("reports availability status", () => {
			const results = runDiagnostics();
			const nativeCheck = results.find((r) => r.name === "Native Module");

			expect(nativeCheck).toBeDefined();
			expect(["ok", "warning"]).toContain(nativeCheck?.status as string);
			expect(["available", "not available"]).toContain(
				nativeCheck?.message as string,
			);
		});

		testWithNative("provides details when unavailable", () => {
			const results = runDiagnostics();
			const nativeCheck = results.find((r) => r.name === "Native Module");

			if (nativeCheck?.status === "warning") {
				expect(nativeCheck?.details).toBeDefined();
				expect(nativeCheck?.details?.length).toBeGreaterThan(0);
			}
		});
	});

	describe("Dispatch Hooks check", () => {
		testWithNative("checks for SessionStart and UserPromptSubmit hooks", () => {
			const results = runDiagnostics();
			const hooksCheck = results.find((r) => r.name === "Dispatch Hooks");

			expect(hooksCheck).toBeDefined();
			expect(hooksCheck?.details).toBeDefined();
			expect(hooksCheck?.details?.some((d) => d.includes("SessionStart"))).toBe(
				true,
			);
			expect(
				hooksCheck?.details?.some((d) => d.includes("UserPromptSubmit")),
			).toBe(true);
		});

		testWithNative("reports configured count", () => {
			const results = runDiagnostics();
			const hooksCheck = results.find((r) => r.name === "Dispatch Hooks");

			expect(hooksCheck?.message).toMatch(/\d+\/\d+ configured/);
		});
	});

	describe("Memory System check", () => {
		testWithNative("reports initialization status", () => {
			const results = runDiagnostics();
			const memoryCheck = results.find((r) => r.name === "Memory System");

			expect(memoryCheck).toBeDefined();
			expect(["ok", "warning"]).toContain(memoryCheck?.status as string);
			expect(["initialized", "not initialized"]).toContain(
				memoryCheck?.message as string,
			);
		});

		testWithNative("provides memory details", () => {
			const results = runDiagnostics();
			const memoryCheck = results.find((r) => r.name === "Memory System");

			expect(memoryCheck?.details).toBeDefined();
			expect(
				memoryCheck?.details?.some((d) => d.includes("Index database")),
			).toBe(true);
			expect(
				memoryCheck?.details?.some((d) => d.includes("Session files")),
			).toBe(true);
		});
	});

	describe("Binary check", () => {
		testWithNative("reports binary path", () => {
			const results = runDiagnostics();
			const binaryCheck = results.find((r) => r.name === "Binary");

			expect(binaryCheck).toBeDefined();
			expect(binaryCheck?.message).toBeDefined();
			expect(typeof binaryCheck?.message).toBe("string");
		});

		testWithNative("includes re-exec details when HAN_REEXEC is set", () => {
			process.env.HAN_REEXEC = "1";

			const results = runDiagnostics();
			const binaryCheck = results.find((r) => r.name === "Binary");

			expect(binaryCheck?.details).toContain("Running via hanBinary re-exec");

			delete process.env.HAN_REEXEC;
		});
	});

	describe("registerDoctorCommand", () => {
		test("exports registerDoctorCommand function", async () => {
			const { registerDoctorCommand } = await import(
				"../lib/commands/doctor.ts"
			);
			expect(typeof registerDoctorCommand).toBe("function");
		});
	});
});
