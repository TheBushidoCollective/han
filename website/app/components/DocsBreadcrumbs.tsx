"use client";

import Link from "next/link";
import { Fragment } from "react";

interface BreadcrumbItem {
	title: string;
	href: string;
}

interface DocsBreadcrumbsProps {
	items: BreadcrumbItem[];
}

export default function DocsBreadcrumbs({ items }: DocsBreadcrumbsProps) {
	if (items.length === 0) {
		return null;
	}

	return (
		<nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
			<Link
				href="/docs"
				className="hover:text-gray-900 dark:hover:text-white transition-colors"
			>
				Docs
			</Link>
			{items.map((item, idx) => (
				<Fragment key={item.href}>
					<span className="text-gray-300 dark:text-gray-600">/</span>
					{idx === items.length - 1 ? (
						<span className="text-gray-900 dark:text-white font-medium">
							{item.title}
						</span>
					) : (
						<Link
							href={item.href}
							className="hover:text-gray-900 dark:hover:text-white transition-colors"
						>
							{item.title}
						</Link>
					)}
				</Fragment>
			))}
		</nav>
	);
}
