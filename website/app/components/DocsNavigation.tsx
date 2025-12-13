import Link from "next/link";
import type { NavItem } from "../../lib/docs";

interface DocsNavigationProps {
	prev: NavItem | null;
	next: NavItem | null;
}

export default function DocsNavigation({ prev, next }: DocsNavigationProps) {
	return (
		<nav className="flex items-center justify-between mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
			{prev ? (
				<Link
					href={prev.slug === "" ? "/docs" : `/docs/${prev.slug}`}
					className="group flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
				>
					<svg
						className="w-4 h-4 transition-transform group-hover:-translate-x-1"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M15 19l-7-7 7-7"
						/>
					</svg>
					<span>{prev.title}</span>
				</Link>
			) : (
				<div />
			)}
			{next ? (
				<Link
					href={next.slug === "" ? "/docs" : `/docs/${next.slug}`}
					className="group flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
				>
					<span>{next.title}</span>
					<svg
						className="w-4 h-4 transition-transform group-hover:translate-x-1"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M9 5l7 7-7 7"
						/>
					</svg>
				</Link>
			) : (
				<div />
			)}
		</nav>
	);
}
