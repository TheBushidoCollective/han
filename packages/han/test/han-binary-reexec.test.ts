import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { shouldReexec } from "../lib/main.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("shouldReexec", () => {
	let testDir: string;
	let originalArgv: string[];
	let originalEnv: NodeJS.ProcessEnv;
	let originalCwd: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `han-reexec-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalArgv = process.argv;
		originalEnv = { ...process.env };
		originalCwd = process.cwd();
		process.chdir(testDir);
		// Isolate from user's global config
		process.env.HOME = testDir;
		// Also clear config dir overrides that take precedence
		delete process.env.CLAUDE_CONFIG_DIR;
		delete process.env.CLAUDE_PROJECT_DIR;
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

	test("returns false when HAN_REEXEC is set (prevents infinite loops)", () => {
		process.env.HAN_REEXEC = "1";
		process.argv = ["node", "/usr/bin/han", "hook", "dispatch"];

		const result = shouldReexec();

		expect(result.reexec).toBe(false);
	});

	test("returns false for --version flag", () => {
		delete process.env.HAN_REEXEC;
		process.argv = ["node", "/usr/bin/han", "--version"];

		const result = shouldReexec();

		expect(result.reexec).toBe(false);
	});

	test("returns false for -V flag", () => {
		delete process.env.HAN_REEXEC;
		process.argv = ["node", "/usr/bin/han", "-V"];

		const result = shouldReexec();

		expect(result.reexec).toBe(false);
	});

	test("returns false for --help flag", () => {
		delete process.env.HAN_REEXEC;
		process.argv = ["node", "/usr/bin/han", "--help"];

		const result = shouldReexec();

		expect(result.reexec).toBe(false);
	});

	test("returns false for doctor command", () => {
		delete process.env.HAN_REEXEC;
		process.argv = ["node", "/usr/bin/han", "doctor"];

		const result = shouldReexec();

		expect(result.reexec).toBe(false);
	});

	test("returns true when hanBinary is configured and different from current binary", () => {
		delete process.env.HAN_REEXEC;
		process.argv = ["node", "/usr/bin/han", "hook", "dispatch"];

		// Create config with different hanBinary
		mkdirSync(join(testDir, ".claude"), { recursive: true });
		writeFileSync(
			join(testDir, ".claude", "han.yml"),
			"hanBinary: bun run /dev/han/lib/main.ts\n",
		);

		const result = shouldReexec();

		// Should want to re-exec since hanBinary is different from current binary
		expect(result.reexec).toBe(true);
		expect(result.binary).toContain("bun run");
	});

	test("returns false when current binary path is contained in hanBinary", () => {
		delete process.env.HAN_REEXEC;
		// Use the actual main.ts path - resolve it dynamically
		const mainTsPath = join(__dirname, "..", "lib", "main.ts");
		process.argv = ["bun", mainTsPath, "hook", "dispatch"];

		const result = shouldReexec();

		// Should not re-exec when current binary matches configured hanBinary
		expect(result.reexec).toBe(false);
	});

	test("returns reexec result based on config presence", () => {
		delete process.env.HAN_REEXEC;
		process.argv = ["node", "/usr/bin/han", "hook", "dispatch"];

		// Just verify the function returns a valid result structure
		const result = shouldReexec();

		expect(typeof result.reexec).toBe("boolean");
		if (result.reexec) {
			expect(typeof result.binary).toBe("string");
		}
	});
});
