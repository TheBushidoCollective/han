import { describe, expect, it } from "bun:test";
import { Glob } from "bun";

describe("Zero Native/DB Import Verification", () => {
	const libDir = import.meta.dir + "/../lib";

	async function findImports(pattern: RegExp): Promise<string[]> {
		const glob = new Glob("**/*.ts");
		const matches: string[] = [];

		for await (const file of glob.scan({ cwd: libDir, onlyFiles: true })) {
			// Skip db/index.ts (the old file itself)
			if (file === "db/index.ts") continue;
			// Skip generated code
			if (file.includes("grpc/generated/")) continue;

			const content = await Bun.file(`${libDir}/${file}`).text();
			for (const line of content.split("\n")) {
				if (pattern.test(line) && line.trimStart().startsWith("import")) {
					matches.push(`${file}: ${line.trim()}`);
				}
			}
		}
		return matches;
	}

	it("has zero imports from native.ts", async () => {
		const imports = await findImports(
			/from\s+['"].*\/native\.ts['"]/,
		);
		expect(imports).toEqual([]);
	});

	it("has zero imports from native (no extension)", async () => {
		const imports = await findImports(
			/from\s+['"]\.\.?\/.*\/native['"]/,
		);
		// Filter out files that reference "native-task" (different file)
		const filtered = imports.filter(
			(i) => !i.includes("native-task") && !i.includes("native_task"),
		);
		expect(filtered).toEqual([]);
	});

	it("has zero imports from db/index.ts", async () => {
		const imports = await findImports(
			/from\s+['"].*db\/index\.ts['"]/,
		);
		expect(imports).toEqual([]);
	});

	it("has zero imports from db/index (no extension)", async () => {
		const imports = await findImports(
			/from\s+['"].*db\/index['"]/,
		);
		expect(imports).toEqual([]);
	});

	it("has zero imports from han-native", async () => {
		const imports = await findImports(
			/from\s+['"].*han-native['"]/,
		);
		expect(imports).toEqual([]);
	});
});
