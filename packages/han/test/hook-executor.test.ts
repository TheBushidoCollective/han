import { describe, expect, it } from "bun:test";

describe("Hook Executor", () => {
	it("module exports expected functions", async () => {
		const mod = await import("../lib/grpc/hook-executor.ts");
		expect(typeof mod.executeHooksViaGrpc).toBe("function");
		expect(typeof mod.executeHooksAndExit).toBe("function");
	});
});
