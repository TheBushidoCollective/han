import { describe, expect, test } from "bun:test";
import {
	coordinatorIsLoopback,
	isBlockedByLocalNetworkAccess,
	isLoopbackOrigin,
} from "./localNetworkAccess.ts";

describe("isLoopbackOrigin", () => {
	test("recognises the loopback names a page can be served from", () => {
		expect(isLoopbackOrigin("localhost")).toBe(true);
		expect(isLoopbackOrigin("127.0.0.1")).toBe(true);
		// The whole 127/8 block is loopback, not only .0.1.
		expect(isLoopbackOrigin("127.0.0.53")).toBe(true);
		expect(isLoopbackOrigin("::1")).toBe(true);
	});

	test("treats the hosted dashboard and lookalikes as public", () => {
		expect(isLoopbackOrigin("dashboard.local.han.guru")).toBe(false);
		expect(isLoopbackOrigin("localhost.evil.com")).toBe(false);
		expect(isLoopbackOrigin("127.0.0.1.evil.com")).toBe(false);
		expect(isLoopbackOrigin("192.168.1.10")).toBe(false);
	});
});

describe("coordinatorIsLoopback", () => {
	test("counts the coordinator's public DNS name, which resolves to 127.0.0.1", () => {
		expect(
			coordinatorIsLoopback("https://coordinator.local.han.guru:41957/graphql"),
		).toBe(true);
		expect(coordinatorIsLoopback("http://127.0.0.1:41957/graphql")).toBe(true);
	});

	test("a routable coordinator is not loopback", () => {
		expect(coordinatorIsLoopback("https://coord.example.com/graphql")).toBe(
			false,
		);
		expect(coordinatorIsLoopback("https://10.0.0.5:41957/graphql")).toBe(false);
	});

	test("an unparseable endpoint is not assumed to be loopback", () => {
		expect(coordinatorIsLoopback("not a url")).toBe(false);
	});
});

describe("isBlockedByLocalNetworkAccess", () => {
	const coordinatorEndpoint =
		"https://coordinator.local.han.guru:41957/graphql";

	test("the hosted dashboard reaching a loopback coordinator is blocked", () => {
		// This is the case that showed a spinner and coordinator instructions
		// forever, however healthy the coordinator was.
		expect(
			isBlockedByLocalNetworkAccess({
				pageHostname: "dashboard.local.han.guru",
				coordinatorEndpoint,
			}),
		).toBe(true);
	});

	test("a page already on loopback is not blocked", () => {
		expect(
			isBlockedByLocalNetworkAccess({
				pageHostname: "127.0.0.1",
				coordinatorEndpoint,
			}),
		).toBe(false);
	});

	test("a public page reaching a routable coordinator is not blocked", () => {
		// Nothing about that crosses into local address space, so a failure there
		// really does mean the coordinator is unreachable.
		expect(
			isBlockedByLocalNetworkAccess({
				pageHostname: "dashboard.local.han.guru",
				coordinatorEndpoint: "https://coord.example.com/graphql",
			}),
		).toBe(false);
	});
});
