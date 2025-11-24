import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAllPlugins, getPluginContent } from "../../../../../../lib/plugins";
import Header from "../../../../../components/Header";
import Sidebar from "../../../../../components/Sidebar";

export async function generateStaticParams() {
	const categories = ["bushido", "buki", "do", "sensei"] as const;
	const params: { category: string; slug: string; skill: string }[] = [];

	for (const category of categories) {
		const plugins = getAllPlugins(category);
		for (const plugin of plugins) {
			const details = getPluginContent(category, plugin.name);
			if (details) {
				for (const skill of details.skills) {
					params.push({
						category,
						slug: category === "bushido" ? "core" : plugin.name,
						skill: skill.name,
					});
				}
			}
		}
	}

	return params;
}

const categoryLabels = {
	bushido: "Bushido",
	buki: "Buki",
	do: "Dō",
	sensei: "Sensei",
} as const;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ category: string; slug: string; skill: string }>;
}): Promise<Metadata> {
	const { category, slug, skill: skillName } = await params;

	if (!["bushido", "buki", "do", "sensei"].includes(category)) {
		return {
			title: "Skill Not Found - Han",
		};
	}

	const pluginSlug =
		category === "bushido" && slug === "core" ? "bushido" : slug;
	const plugin = getPluginContent(
		category as "bushido" | "buki" | "do" | "sensei",
		pluginSlug,
	);

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

	if (!["bushido", "buki", "do", "sensei"].includes(category)) {
		notFound();
	}

	const pluginSlug =
		category === "bushido" && slug === "core" ? "bushido" : slug;
	const plugin = getPluginContent(
		category as "bushido" | "buki" | "do" | "sensei",
		pluginSlug,
	);

	if (!plugin) {
		notFound();
	}

	// Get plugins for sidebar
	const bukiPlugins = getAllPlugins("buki").map((p) => ({
		name: p.name,
		title: p.title,
	}));
	const doPlugins = getAllPlugins("do").map((p) => ({
		name: p.name,
		title: p.title,
	}));
	const senseiPlugins = getAllPlugins("sensei").map((p) => ({
		name: p.name,
		title: p.title,
	}));

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
						{categoryLabels[category as keyof typeof categoryLabels]}
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
					<Sidebar
						bukiPlugins={bukiPlugins}
						doPlugins={doPlugins}
						senseiPlugins={senseiPlugins}
					/>
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
						<div className="prose dark:prose-invert max-w-none prose-p:my-3 prose-headings:mb-3 prose-headings:mt-6">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>
								{skill.content.replace(/^\s*#\s+.+/, "# Overview")}
							</ReactMarkdown>
						</div>
					</main>
				</div>
			</div>
		</div>
	);
}
