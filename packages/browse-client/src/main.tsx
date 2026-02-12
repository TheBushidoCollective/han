import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { Center, Text } from "./components/atoms";
import { ConnectionGate } from "./components/organisms/ConnectionGate.tsx";

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
