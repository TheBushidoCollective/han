declare const __HAN_BUILD_TARGET__: string | undefined;

export const isLocalDashboard =
	typeof __HAN_BUILD_TARGET__ === "undefined" ||
	__HAN_BUILD_TARGET__ === "local-dashboard";

const SESSION_KEY = "han.dashboard.accessToken";

export function dashboardAuthorization(): Record<string, string> {
	if (!isLocalDashboard) return {};
	const token = sessionStorage.getItem(SESSION_KEY);
	if (!token)
		throw new Error("Dashboard session missing. Run han browse again.");
	return { Authorization: `Bearer ${token}` };
}

export async function bootstrapDashboard(): Promise<void> {
	const fragment = new URLSearchParams(window.location.hash.slice(1));
	const launchToken = fragment.get("launchToken");
	// Scrub even malformed fragments before loading application code or telemetry.
	if (window.location.hash) {
		history.replaceState(null, "", `${location.pathname}${location.search}`);
	}
	if (!isLocalDashboard) {
		if (launchToken)
			throw new Error("A team dashboard cannot accept a local launch.");
		return;
	}
	if (
		location.protocol !== "http:" ||
		location.hostname !== "127.0.0.1" ||
		!location.port
	) {
		throw new Error("Open the local dashboard using han browse.");
	}
	if (launchToken) {
		sessionStorage.removeItem(SESSION_KEY);
		const response = await fetch("/_han/session", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ transportVersion: 1, launchToken }),
		});
		if (!response.ok)
			throw new Error(
				"Dashboard launch expired or was rejected. Run han browse again.",
			);
		const result: unknown = await response.json();
		if (
			!result ||
			typeof result !== "object" ||
			!("accessToken" in result) ||
			typeof result.accessToken !== "string" ||
			!result.accessToken
		) {
			throw new Error("Invalid dashboard session response.");
		}
		sessionStorage.setItem(SESSION_KEY, result.accessToken);
	}
	if (!sessionStorage.getItem(SESSION_KEY))
		throw new Error("Open the local dashboard using han browse.");
}
