import { defineConfig, devices } from "@playwright/test";

// This suite starts its own real CLI and coordinator. Never reuse a server or
// record browser storage, network headers, WebSocket frames, or launcher URLs.
export default defineConfig({
	testDir: "./tests",
	testMatch: "secure-local-transport.spec.ts",
	workers: 1,
	fullyParallel: false,
	retries: 0,
	timeout: 240_000,
	expect: { timeout: 30_000 },
	reporter: [["list"]],
	use: {
		...devices["Desktop Chrome"],
		headless: true,
		trace: "off",
		video: "off",
		screenshot: "off",
	},
});
