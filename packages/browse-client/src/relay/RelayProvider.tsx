/**
 * Relay Environment Provider
 *
 * Wraps the app with Relay's environment provider for data fetching.
 */

import type { ReactNode } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { getRelayEnvironment } from "./environment";

interface RelayProviderProps {
	children: ReactNode;
}

export function RelayProvider({ children }: RelayProviderProps) {
	const environment = getRelayEnvironment();

	return (
		<RelayEnvironmentProvider environment={environment}>
			{children}
		</RelayEnvironmentProvider>
	);
}
