import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAdjacentPages, getDocPage } from "../../lib/docs";
import DocsNavigation from "../components/DocsNavigation";

export const metadata: Metadata = {
	title: "Documentation - Han",
	description:
		"Complete documentation for Han - automatic quality gates for AI coding agents with linting, formatting, type-checking, and testing.",
};

export default function DocsPage() {
	const page = getDocPage("");

	if (!page) {
		notFound();
	}

	const { prev, next } = getAdjacentPages("");

	return (
		<div className="max-w-4xl">
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
