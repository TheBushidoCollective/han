import { isLocalDashboard } from "../bootstrap.ts";

declare const __GRAPHQL_URL__: string | undefined;
declare const __GRAPHQL_WS_URL__: string | undefined;

export interface GraphQLEndpoints {
	http: string;
	ws: string;
}

export function getGraphQLEndpoints(): GraphQLEndpoints {
	if (isLocalDashboard) {
		return {
			http: `${window.location.origin}/graphql`,
			ws: `ws://${window.location.host}/graphql`,
		};
	}
	if (
		typeof __GRAPHQL_URL__ === "undefined" ||
		typeof __GRAPHQL_WS_URL__ === "undefined"
	) {
		throw new Error("Team dashboard requires a configured GraphQL endpoint.");
	}
	return { http: __GRAPHQL_URL__, ws: __GRAPHQL_WS_URL__ };
}
