import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	generateBreadcrumbs,
	getAdjacentPages,
	getAllDocSlugs,
	getDocPage,
} from "../../../lib/docs";
import DocsBreadcrumbs from "../../components/DocsBreadcrumbs";
import DocsNavigation from "../../components/DocsNavigation";

export async function generateStaticParams() {
	const slugs = getAllDocSlugs();

	// Filter out empty slug (handled by /docs/page.tsx) and convert to arrays
	return slugs
		.filter((slug) => slug !== "")
		.map((slug) => ({
			slug: slug.split("/"),
		}));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
	const { slug: slugArray } = await params;
	const slug = slugArray.join("/");
	const page = getDocPage(slug);

	if (!page) {
		return {
			title: "Page Not Found - Han Documentation",
		};
	}

	return {
		title: `${page.title} - Han Documentation`,
		description: page.description,
	};
}

export default async function DocPage({
	params,
}: {
	params: Promise<{ slug: string[] }>;
}) {
	const { slug: slugArray } = await params;
	const slug = slugArray.join("/");
	const page = getDocPage(slug);

	if (!page) {
		notFound();
	}

	const breadcrumbs = generateBreadcrumbs(slug);
	const { prev, next } = getAdjacentPages(slug);

	return (
		<div className="max-w-4xl">
			<DocsBreadcrumbs items={breadcrumbs} />

			<article>
				<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
					{page.title}
				</h1>

				{page.description && (
					<p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
						{page.description}
					</p>
				)}

				<div className="prose prose-lg dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-code:text-sm prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950">
					<ReactMarkdown remarkPlugins={[remarkGfm]}>
						{page.content}
					</ReactMarkdown>
				</div>
			</article>

			<DocsNavigation prev={prev} next={next} />
		</div>
	);
}
