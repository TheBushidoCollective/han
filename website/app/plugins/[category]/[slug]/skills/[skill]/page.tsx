import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/app/components/Header";
import MarkdownContent from "@/app/components/MarkdownContent";
import Sidebar from "@/app/components/Sidebar";
import {
	getAllPlugins,
	getPluginContent,
	type PluginCategory,
	CATEGORY_ORDER,
	CATEGORY_META,
} from "@/lib/plugins";

export async function generateStaticParams() {
	const params: { category: string; slug: string; skill: string }[] = [];

	for (const category of CATEGORY_ORDER) {
		const plugins = getAllPlugins(category);
		for (const plugin of plugins) {
			const details = getPluginContent(category, plugin.name);
			if (details) {
				for (const skill of details.skills) {
					params.push({
						category,
						slug: plugin.name,
						skill: skill.name,
					});
				}
			}
		}
	}

	return params;
}

// Build plugins by category for sidebar
function getPluginsByCategory() {
	const result: Record<PluginCategory, { name: string; title: string }[]> = {
		core: [],
		languages: [],
		frameworks: [],
		validation: [],
		tools: [],
		services: [],
		disciplines: [],
		patterns: [],
		specialized: [],
	};

	for (const category of CATEGORY_ORDER) {
		result[category] = getAllPlugins(category).map((p) => ({
			name: p.name,
			title: p.title,
		}));
	}

	return result;
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ category: string; slug: string; skill: string }>;
}): Promise<Metadata> {
	const { category, slug, skill: skillName } = await params;

	if (!CATEGORY_ORDER.includes(category as PluginCategory)) {
		return {
			title: "Skill Not Found - Han",
		};
	}

	const plugin = getPluginContent(category as PluginCategory, slug);

	if (!plugin) {
		return {
			title: "Skill Not Found - Han",
		};
	}

	const skill = plugin.skills.find((s) => s.name === skillName);

	if (!skill) {
		return {
			title: "Skill Not Found - Han",
		};
	}

	return {
		title: `${skill.name} - ${plugin.metadata.title} - Han`,
		description: skill.description,
	};
}

export default async function SkillPage({
	params,
}: {
	params: Promise<{ category: string; slug: string; skill: string }>;
}) {
	const { category, slug, skill: skillName } = await params;

	if (!CATEGORY_ORDER.includes(category as PluginCategory)) {
		notFound();
	}

	const plugin = getPluginContent(category as PluginCategory, slug);

	if (!plugin) {
		notFound();
	}

	// Get plugins for sidebar
	const pluginsByCategory = getPluginsByCategory();

	const skill = plugin.skills.find((s) => s.name === skillName);

	if (!skill) {
		notFound();
	}

	return (
		<div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
			<Header />

			{/* Breadcrumbs */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
				<div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
					<Link
						href="/plugins"
						className="hover:text-gray-900 dark:hover:text-white"
					>
						Documentation
					</Link>
					<span>/</span>
					<Link
						href={`/plugins/${category}`}
						className="hover:text-gray-900 dark:hover:text-white"
					>
						{CATEGORY_META[category as PluginCategory]?.title || category}
					</Link>
					<span>/</span>
					<Link
						href={`/plugins/${category}/${slug}`}
						className="hover:text-gray-900 dark:hover:text-white"
					>
						{plugin.metadata.title}
					</Link>
					<span>/ skills /</span>
					<span className="text-gray-900 dark:text-white font-medium">
						{skill.name}
					</span>
				</div>
			</div>

			{/* Main Content with Sidebar */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
				<div className="flex gap-12">
					<Sidebar pluginsByCategory={pluginsByCategory} />
					<main className="flex-1 min-w-0">
						{/* Header */}
						<div className="mb-8">
							<h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
								📖 {skill.name}
							</h1>
							<p className="text-lg text-gray-600 dark:text-gray-400">
								{skill.description}
							</p>
						</div>

						<hr />
						<br />

						{/* Markdown Content */}
						<MarkdownContent
							content={skill.content.replace(/^\s*#\s+.+/, "# Overview")}
						/>
					</main>
				</div>
			</div>
		</div>
	);
}
