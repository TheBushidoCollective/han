import { bootstrapDashboard } from "./bootstrap.ts";

bootstrapDashboard()
	.then(() => import("./application.tsx"))
	.catch((error: unknown) => {
		const root = document.getElementById("root");
		if (root)
			root.textContent =
				error instanceof Error ? error.message : "Unable to start dashboard.";
	});
