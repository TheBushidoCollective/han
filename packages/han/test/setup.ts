// Test setup - runs before all tests
import { beforeAll } from "bun:test";
import { rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Clean up the user's metrics directory before all tests run
// This prevents contamination from previous test runs or development work
beforeAll(() => {
	const home = process.env.HOME || homedir();
	const metricsDir = join(home, ".claude", "han", "metrics");
	try {
		rmSync(metricsDir, { recursive: true, force: true });
	} catch {
		// Ignore if directory doesn't exist
	}
});
