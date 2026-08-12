/**
 * The overlay is the only thing a blocked visitor sees, so what it claims
 * matters. On a public origin it used to spin forever and tell the visitor to
 * start or install a coordinator that was already running.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ConnectionOverlay } from "./ConnectionOverlay.tsx";

function renderAt(hostname: string, host = hostname): string {
	const original = globalThis.window;
	// The component reads location to decide, and prints the host it was served
	// from, so both fields have to be present.
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: { ...(original ?? {}), location: { hostname, host } },
	});
	try {
		return renderToStaticMarkup(<ConnectionOverlay />);
	} finally {
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: original,
		});
	}
}

describe("ConnectionOverlay", () => {
	test("on a public origin it names the real obstacle and the real remedy", () => {
		const html = renderAt("dashboard.local.han.guru");

		expect(html).toContain("Open the dashboard from your machine");
		expect(html).toContain("han browse");
		// The host is quoted back so the visitor can see why this page is affected.
		expect(html).toContain("dashboard.local.han.guru");
	});

	test("on a public origin it does not blame the coordinator", () => {
		const html = renderAt("dashboard.local.han.guru");

		expect(html).not.toContain("han coordinator start");
		expect(html).not.toContain("Connecting to Han Coordinator");
		// Waiting cannot fix a permission, so nothing should suggest it will.
		expect(html).not.toContain("Checking every 3 seconds");
	});

	test("on loopback it keeps the coordinator instructions, which are correct there", () => {
		const html = renderAt("127.0.0.1", "127.0.0.1:41956");

		expect(html).toContain("Connecting to Han Coordinator");
		expect(html).toContain("han coordinator start");
		expect(html).not.toContain("Open the dashboard from your machine");
	});
});
