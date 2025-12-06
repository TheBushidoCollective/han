/**
 * Type declarations for bun:sqlite
 * Based on Bun's built-in SQLite implementation
 * See: https://bun.sh/docs/api/sqlite
 */
declare module "bun:sqlite" {
	export class Database {
		constructor(filename: string, options?: { readonly?: boolean });

		query<T = unknown>(sql: string): Statement<T>;
		prepare<T = unknown>(sql: string): Statement<T>;
		exec(sql: string): void;
		close(): void;
		run(sql: string, ...params: unknown[]): void;

		readonly filename: string;
		readonly inTransaction: boolean;
	}

	export interface Statement<T = unknown> {
		run(...params: unknown[]): void;
		get(...params: unknown[]): T | undefined;
		all(...params: unknown[]): T[];
		values(...params: unknown[]): unknown[][];

		readonly columnNames: string[];
		readonly paramsCount: number;

		finalize(): void;
	}
}
