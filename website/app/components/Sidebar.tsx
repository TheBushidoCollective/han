"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { getCategoryIcon } from "../../lib/constants";
import SidebarScrollContainer from "./SidebarScrollContainer";

interface SidebarProps {
	jutsuPlugins: Array<{ name: string; title: string }>;
	doPlugins: Array<{ name: string; title: string }>;
	hashiPlugins: Array<{ name: string; title: string }>;
}

const Sidebar: React.FC<SidebarProps> = ({
	jutsuPlugins,
	doPlugins,
	hashiPlugins,
}) => {
	const pathname = usePathname();

	const isActive = (href: string) => {
		return pathname === href || pathname?.startsWith(`${href}/`);
	};

	const getLinkClass = (href: string) => {
		return isActive(href)
			? "block text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
			: "block text-sm font-semibold text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-300";
	};

	const getSubLinkClass = (href: string) => {
		return isActive(href)
			? "block text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold"
			: "block text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200";
	};

	return (
		<aside className="hidden lg:block w-64 shrink-0">
			<SidebarScrollContainer>
				<nav className="space-y-6">
					{/* Search */}
					<div>
						<Link
							href="/search"
							className="flex items-center space-x-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
						>
							<svg
								className="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-label="Search icon"
							>
								<title>Search</title>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
							<span>Search</span>
						</Link>
					</div>

					{/* Overview */}
					<div>
						<Link
							href="/plugins"
							className={`${getLinkClass("/plugins")} mb-2`}
						>
							Overview
						</Link>
					</div>

					{/* Bushido */}
					<div>
						<Link
							href="/plugins/bushido"
							className={`${getLinkClass("/plugins/bushido")} mb-2`}
						>
							{getCategoryIcon("bushido")} Bushido
						</Link>
						<p className="text-xs font-semibold text-gray-400 dark:text-gray-500 ml-4 mb-2">
							Core philosophy and quality principles
						</p>
					</div>

					{/* Dō */}
					<div>
						<Link
							href="/plugins/do"
							className={`${getLinkClass("/plugins/do")} mb-2`}
						>
							{getCategoryIcon("do")} Dō
						</Link>
						<p className="text-xs font-semibold text-gray-400 dark:text-gray-500 ml-4 mb-2">
							Specialized development disciplines
						</p>
						<ul className="space-y-1 ml-4">
							{doPlugins.map((plugin) => (
								<li key={plugin.name}>
									<Link
										href={`/plugins/do/${plugin.name}`}
										className={getSubLinkClass(`/plugins/do/${plugin.name}`)}
									>
										{plugin.title}
									</Link>
								</li>
							))}
						</ul>
					</div>

					{/* Buki */}
					<div>
						<Link
							href="/plugins/jutsu"
							className={`${getLinkClass("/plugins/jutsu")} mb-2`}
						>
							{getCategoryIcon("jutsu")} Buki
						</Link>
						<p className="text-xs font-semibold text-gray-400 dark:text-gray-500 ml-4 mb-2">
							Technology skills and validations
						</p>
						<ul className="space-y-1 ml-4">
							{jutsuPlugins.map((plugin) => (
								<li key={plugin.name}>
									<Link
										href={`/plugins/jutsu/${plugin.name}`}
										className={getSubLinkClass(`/plugins/jutsu/${plugin.name}`)}
									>
										{plugin.title}
									</Link>
								</li>
							))}
						</ul>
					</div>

					{/* Sensei */}
					<div>
						<Link
							href="/plugins/hashi"
							className={`${getLinkClass("/plugins/hashi")} mb-2`}
						>
							{getCategoryIcon("hashi")} Sensei
						</Link>
						<p className="text-xs font-semibold text-gray-400 dark:text-gray-500 ml-4 mb-2">
							MCP servers for external integrations
						</p>
						<ul className="space-y-1 ml-4">
							{hashiPlugins.map((plugin) => (
								<li key={plugin.name}>
									<Link
										href={`/plugins/hashi/${plugin.name}`}
										className={getSubLinkClass(`/plugins/hashi/${plugin.name}`)}
									>
										{plugin.title}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</nav>
			</SidebarScrollContainer>
		</aside>
	);
};

export default Sidebar;
