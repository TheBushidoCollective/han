import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const website = join(import.meta.dir, "..");
const script = join(
	website,
	"../plugins/tools/playwright-bdd/scripts/generate.sh",
);

describe("playwright-bdd generator hook", () => {
	let root: string;
	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "han-bdd-real-"));
		symlinkSync(
			join(website, "node_modules"),
			join(root, "node_modules"),
			"dir",
		);
	});
	afterEach(() => rmSync(root, { recursive: true, force: true }));

	test("generates from the dedicated config and rejects invalid input without changing sources", () => {
		const config = `import { defineConfig } from '@playwright/test';\nimport { defineBddConfig } from 'playwright-bdd';\nconst testDir = defineBddConfig({ features: 'example.feature', steps: 'steps.ts', outputDir: '.generated' });\nexport default defineConfig({ testDir });\n`;
		const standard = `throw new Error('ordinary configuration must not run');\n`;
		const feature =
			"Feature: Example\n  Scenario: Works\n    Given a working step\n";
		const steps = `import { createBdd } from 'playwright-bdd';\nconst { Given } = createBdd();\nGiven('a working step', async () => {});\n`;
		const files: Record<string, string> = {
			"playwright.bdd.config.ts": config,
			"playwright.config.ts": standard,
			"example.feature": feature,
			"steps.ts": steps,
		};
		for (const [name, contents] of Object.entries(files))
			writeFileSync(join(root, name), contents);
		const run = () =>
			spawnSync("bash", [script], {
				cwd: root,
				encoding: "utf8",
				timeout: 30000,
				env: {
					...process.env,
					PATH: `${join(website, "node_modules/.bin")}:${process.env.PATH}`,
				},
			});
		const success = run();
		expect(success.status).toBe(0);
		expect(
			readFileSync(join(root, ".generated/example.feature.spec.js"), "utf8"),
		).toContain("a working step");
		for (const [name, contents] of Object.entries(files))
			expect(readFileSync(join(root, name), "utf8")).toBe(contents);
		const invalid =
			"Feature: Broken\n  Scenario: Missing step\n    Given a step without a definition\n";
		writeFileSync(join(root, "example.feature"), invalid);
		const failure = run();
		expect(failure.status).not.toBe(0);
		expect(failure.stdout + failure.stderr).toContain(
			"a step without a definition",
		);
		expect(readFileSync(join(root, "example.feature"), "utf8")).toBe(invalid);
		for (const name of [
			"playwright.bdd.config.ts",
			"playwright.config.ts",
			"steps.ts",
		])
			expect(readFileSync(join(root, name), "utf8")).toBe(files[name]);
	}, 60000);
});
