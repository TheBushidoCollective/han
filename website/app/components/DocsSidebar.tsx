"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "../../lib/docs";
import SidebarScrollContainer from "./SidebarScrollContainer";

interface DocsSidebarProps {
	navigation: NavSection[];
}

export default function DocsSidebar({ navigation }: DocsSidebarProps) {
	const pathname = usePathname();

	const isActive = (slug: string) => {
		const href = slug === "" ? "/docs" : `/docs/${slug}`;
		// Normalize paths by removing trailing slashes for comparison
		const normalizedPathname = pathname?.replace(/\/$/, "") || "";
		const normalizedHref = href.replace(/\/$/, "");
		return normalizedPathname === normalizedHref;
	};

	const getLinkClass = (slug: string) => {
		return isActive(slug)
			? "block text-sm text-blue-600 dark:text-blue-400 font-medium"
			: "block text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white";
	};

	return (
		<aside className="hidden lg:block w-64 shrink-0">
			<SidebarScrollContainer>
				<nav className="space-y-8">
					{navigation.map((section) => (
						<div key={section.title}>
							<p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
								{section.title}
							</p>
							<ul className="space-y-2">
								{section.items.map((item) => (
									<li key={item.slug}>
										<Link
											href={item.slug === "" ? "/docs" : `/docs/${item.slug}`}
											className={getLinkClass(item.slug)}
										>
											{item.title}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</nav>
			</SidebarScrollContainer>
		</aside>
	);
}
