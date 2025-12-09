/**
 * Tests for PluginSelector component using ink-testing-library
 */
import { describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { PluginSelector } from "../lib/plugin-selector.tsx";
import type { MarketplacePlugin } from "../lib/shared.ts";

const mockPlugins: MarketplacePlugin[] = [
	{
		name: "jutsu-typescript",
		description: "TypeScript support with type checking",
		keywords: ["typescript", "types"],
		category: "jutsu",
	},
	{
		name: "jutsu-bun",
		description: "Bun runtime support",
		keywords: ["bun", "runtime"],
		category: "jutsu",
	},
	{
		name: "hashi-github",
		description: "GitHub integration",
		keywords: ["github", "git"],
		category: "hashi",
	},
	{
		name: "do-accessibility",
		description: "Accessibility testing",
		keywords: ["a11y", "accessibility"],
		category: "do",
	},
	{
		name: "core",
		description: "Core plugin",
		keywords: ["core"],
		category: "core",
	},
];

describe("PluginSelector component", () => {
	describe("initial rendering", () => {
		test("renders header text", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={["jutsu-typescript"]}
					installedPlugins={[]}
					allPlugins={mockPlugins}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			expect(lastFrame()).toContain("Select plugins to install");
			expect(lastFrame()).toContain("Space to toggle");
			expect(lastFrame()).toContain("Enter to confirm");
		});

		test("shows detected plugins with star indicator", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={["jutsu-typescript", "jutsu-bun"]}
					installedPlugins={[]}
					allPlugins={mockPlugins}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			expect(lastFrame()).toContain("jutsu-typescript");
			// Star emoji is shown for recommended plugins
			const frame = lastFrame();
			expect(frame).toMatch(/jutsu-typescript.*⭐/);
		});

		test("shows installed plugins with indicator", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={[]}
					installedPlugins={["hashi-github"]}
					allPlugins={mockPlugins}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			expect(lastFrame()).toContain("hashi-github (installed)");
		});

		test("shows action options", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={["jutsu-typescript"]}
					installedPlugins={[]}
					allPlugins={mockPlugins}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			expect(lastFrame()).toContain("Search for more plugins");
			expect(lastFrame()).toContain("Done - Install selected plugins");
			expect(lastFrame()).toContain("Cancel");
		});

		test("shows count of selected plugins", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={["jutsu-typescript", "jutsu-bun"]}
					installedPlugins={[]}
					allPlugins={mockPlugins}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			expect(lastFrame()).toContain("2 plugin(s) selected");
		});

		test("excludes bushido from initial selection", () => {
			const pluginsWithBushido: MarketplacePlugin[] = [
				...mockPlugins,
				{ name: "bushido", description: "Bushido principles" },
			];

			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={["jutsu-typescript", "bushido"]}
					installedPlugins={[]}
					allPlugins={pluginsWithBushido}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			// Should only have 1 selected (jutsu-typescript), not bushido
			expect(lastFrame()).toContain("1 plugin(s) selected");
		});

		test("excludes core from display", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={["jutsu-typescript", "core"]}
					installedPlugins={["core"]}
					allPlugins={mockPlugins}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			// Core should not be visible in the list
			// Only jutsu-typescript should be shown as a plugin option
			const frame = lastFrame();
			// Check that core is not displayed as a plugin checkbox option
			expect(frame).not.toMatch(/\[\s*[✓]?\s*\]\s*core/);
		});
	});

	describe("checkbox display", () => {
		test("shows checked checkbox for selected plugins", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={["jutsu-typescript"]}
					installedPlugins={[]}
					allPlugins={mockPlugins}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			// Detected plugins should be pre-selected
			expect(lastFrame()).toContain("[✓]");
		});

		test("shows unchecked checkbox for unselected plugins", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={["jutsu-typescript"]}
					installedPlugins={["hashi-github"]}
					allPlugins={mockPlugins}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			// hashi-github is installed but not detected, so should be unchecked
			expect(lastFrame()).toContain("[ ]");
		});
	});

	describe("empty states", () => {
		test("renders with no detected plugins", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={[]}
					installedPlugins={[]}
					allPlugins={mockPlugins}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			expect(lastFrame()).toContain("0 plugin(s) selected");
			expect(lastFrame()).toContain("Search for more plugins");
		});

		test("renders with no installed plugins", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={["jutsu-typescript"]}
					installedPlugins={[]}
					allPlugins={mockPlugins}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			expect(lastFrame()).toContain("jutsu-typescript");
			expect(lastFrame()).not.toContain("(installed)");
		});

		test("renders with empty allPlugins", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={[]}
					installedPlugins={[]}
					allPlugins={[]}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			// Should still render the header and actions
			expect(lastFrame()).toContain("Select plugins to install");
			expect(lastFrame()).toContain("Search for more plugins");
		});
	});

	describe("mixed states", () => {
		test("handles plugins that are both detected and installed", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={["jutsu-typescript"]}
					installedPlugins={["jutsu-typescript"]}
					allPlugins={mockPlugins}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			// Detected takes precedence - should show star, not (installed)
			expect(lastFrame()).toContain("jutsu-typescript");
			expect(lastFrame()).toMatch(/jutsu-typescript.*⭐/);
		});

		test("shows all unique plugins from detected and installed", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={["jutsu-typescript"]}
					installedPlugins={["hashi-github"]}
					allPlugins={mockPlugins}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			expect(lastFrame()).toContain("jutsu-typescript");
			expect(lastFrame()).toContain("hashi-github");
		});
	});

	describe("cursor display", () => {
		test("shows cursor indicator on first item", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={["jutsu-typescript"]}
					installedPlugins={[]}
					allPlugins={mockPlugins}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			// The selected item should have ">" indicator
			expect(lastFrame()).toContain(">");
		});
	});

	describe("help text", () => {
		test("shows navigation instructions", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={["jutsu-typescript"]}
					installedPlugins={[]}
					allPlugins={mockPlugins}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			expect(lastFrame()).toContain("⭐ = recommended");
			expect(lastFrame()).toContain("↑↓ arrows to navigate");
			expect(lastFrame()).toContain("Space to toggle");
			// Text may wrap across lines in terminal output
			expect(lastFrame()).toMatch(/Enter/);
		});
	});

	describe("plugin sorting", () => {
		test("sorts plugins alphabetically", () => {
			const { lastFrame } = render(
				<PluginSelector
					detectedPlugins={[
						"jutsu-typescript",
						"do-accessibility",
						"jutsu-bun",
					]}
					installedPlugins={[]}
					allPlugins={mockPlugins}
					onComplete={() => {}}
					onCancel={() => {}}
				/>,
			);

			const frame = lastFrame();
			const doIndex = frame.indexOf("do-accessibility");
			const bunIndex = frame.indexOf("jutsu-bun");
			const tsIndex = frame.indexOf("jutsu-typescript");

			// do-accessibility should come before jutsu-bun which comes before jutsu-typescript
			expect(doIndex).toBeLessThan(bunIndex);
			expect(bunIndex).toBeLessThan(tsIndex);
		});
	});
});
