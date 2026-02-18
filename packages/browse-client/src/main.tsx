import * as Sentry from "@sentry/react";
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { Center, Text } from "./components/atoms";
import { ConnectionGate } from "./components/organisms/ConnectionGate.tsx";

Sentry.init({
	dsn: "https://e7b6f89f9beb6cfa75305f7e8ddd5e3e@o4509221255077888.ingest.us.sentry.io/4509221258158080",
	environment: import.meta.env.MODE,
	enabled: import.meta.env.PROD,
});

// No CSS imports - all styles are inline via React Native Web

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
	<StrictMode>
		<BrowserRouter>
			<ConnectionGate>
				<Suspense
					fallback={
						<Center>
							<Text>Loading...</Text>
						</Center>
					}
				>
					<App />
				</Suspense>
			</ConnectionGate>
		</BrowserRouter>
	</StrictMode>,
);
