import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
	getAllPlugins,
	getAllPluginsAcrossCategories,
	getPluginContent,
} from "../../../../../../lib/plugins";
import Header from "../../../../../components/Header";
import Sidebar from "../../../../../components/Sidebar";

export async function generateStaticParams() {
	const allPlugins = getAllPluginsAcrossCategories();
	const params: { category: string; slug: string; hookfile: string }[] = [];

	for (const plugin of allPlugins) {
		const pluginPath = path.join(process.cwd(), "..", plugin.source);
		const hooksDir = path.join(pluginPath, "hooks");

		if (fs.existsSync(hooksDir)) {
			const files = fs
				.readdirSync(hooksDir)
				.filter((file) => !file.startsWith(".") && file !== "hooks.json");

			for (const file of files) {
				params.push({
					category: plugin.category,
					slug: plugin.name,
					hookfile: path.parse(file).name,
				});
			}
		}
	}

	return params;
}

const categoryLabels = {
	core: "Core",
	jutsu: "Jutsu",
	do: "Dō",
	hashi: "Hashi",
} as const;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ category: string; slug: string; hookfile: string }>;
}): Promise<Metadata> {
	const { category, slug, hookfile } = await params;

	if (!["core", "jutsu", "do", "hashi"].includes(category)) {
		return {
			title: "Hook File Not Found - Han",
		};
	}

	const plugin = getPluginContent(
		category as "core" | "jutsu" | "do" | "hashi",
		slug,
	);

	if (!plugin) {
		return {
			title: "Hook File Not Found - Han",
		};
	}

	return {
		title: `${hookfile} - ${plugin.metadata.title} - Han`,
		description: `Hook file for ${plugin.metadata.title}`,
	};
}

export default async function HookFilePage({
	params,
}: {
	params: Promise<{ category: string; slug: string; hookfile: string }>;
}) {
	const { category, slug, hookfile } = await params;

	// Validate category
	if (!["core", "jutsu", "do", "hashi"].includes(category)) {
		notFound();
	}

	const plugin = getPluginContent(
		category as "core" | "jutsu" | "do" | "hashi",
		slug,
	);

	if (!plugin) {
		notFound();
	}

	// Get plugins for sidebar
	const jutsuPlugins = getAllPlugins("jutsu").map((p) => ({
		name: p.name,
		title: p.title,
	}));
	const doPlugins = getAllPlugins("do").map((p) => ({
		name: p.name,
		title: p.title,
	}));
	const hashiPlugins = getAllPlugins("hashi").map((p) => ({
		name: p.name,
		title: p.title,
	}));

	// Find the hook file across all hook sections
	let hookFile: { name: string; path: string; content: string } | null = null;

	for (const hookSection of plugin.hooks) {
		const found = hookSection.files.find((f) => f.name === hookfile);
		if (found) {
			hookFile = found;
			break;
		}
	}

	// If not found in referenced files, try to load directly
	if (!hookFile) {
		const pluginPath = path.join(
			process.cwd(),
			"..",
			plugin.source.replace("./", ""),
		);
		const hooksDir = path.join(pluginPath, "hooks");

		// Find the actual file with any extension
		if (fs.existsSync(hooksDir)) {
			const files = fs.readdirSync(hooksDir);
			const matchingFile = files.find(
				(file) =>
					path.parse(file).name === hookfile &&
					!file.startsWith(".") &&
					file !== "hooks.json",
			);

			if (matchingFile) {
				const filePath = path.join(hooksDir, matchingFile);
				const content = fs.readFileSync(filePath, "utf-8");
				hookFile = {
					name: hookfile,
					path: matchingFile,
					content,
				};
			}
		}

		if (!hookFile) {
			notFound();
		}
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
					<span>/</span>
					<span className="text-gray-900 dark:text-white font-medium">
						{hookFile.name}
					</span>
				</div>
			</div>

			{/* Main Content with Sidebar */}
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
				<div className="flex gap-12">
					<Sidebar
						jutsuPlugins={jutsuPlugins}
						doPlugins={doPlugins}
						hashiPlugins={hashiPlugins}
					/>
					<main className="flex-1 min-w-0">
						{/* Header */}
						<div className="mb-8">
							<div className="flex items-center space-x-4 mb-4">
								<div className="text-6xl">📄</div>
								<div>
									<h1 className="text-5xl font-bold text-gray-900 dark:text-white">
										{hookFile.path}
									</h1>
									<p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
										Hook File
									</p>
								</div>
							</div>
						</div>

						{/* Content */}
						{hookFile.path.endsWith(".md") ? (
							<article className="prose prose-lg dark:prose-invert max-w-none">
								<ReactMarkdown>{hookFile.content}</ReactMarkdown>
							</article>
						) : (
							<div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-6 overflow-x-auto">
								<pre className="text-sm text-gray-100">
									<code>{hookFile.content}</code>
								</pre>
							</div>
						)}

						{/* Back Link */}
						<div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
							<Link
								href={`/plugins/${category}/${slug}`}
								className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
							>
								<svg
									className="w-5 h-5 mr-2"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M10 19l-7-7m0 0l7-7m-7 7h18"
									/>
								</svg>
								Back to {plugin.metadata.title}
							</Link>
						</div>
					</main>
				</div>
			</div>
		</div>
	);
}
