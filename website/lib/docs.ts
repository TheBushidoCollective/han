import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const DOCS_DIR = path.join(process.cwd(), "content", "docs");
const NAV_FILE = path.join(DOCS_DIR, "_nav.json");

export interface DocPage {
	slug: string;
	title: string;
	description: string;
	content: string;
}

export interface DocPageMetadata {
	slug: string;
	title: string;
	description: string;
}

export interface NavItem {
	title: string;
	slug: string;
}

export interface NavSection {
	title: string;
	items: NavItem[];
}

export interface Navigation {
	sections: NavSection[];
}

/**
 * Get the navigation structure from _nav.json
 */
export function getNavigation(): Navigation {
	try {
		if (!fs.existsSync(NAV_FILE)) {
			return { sections: [] };
		}
		const content = fs.readFileSync(NAV_FILE, "utf-8");
		return JSON.parse(content) as Navigation;
	} catch (error) {
		console.error("Error reading navigation:", error);
		return { sections: [] };
	}
}

/**
 * Get all doc pages for static generation
 */
export function getAllDocSlugs(): string[] {
	const navigation = getNavigation();
	const slugs: string[] = [];

	for (const section of navigation.sections) {
		for (const item of section.items) {
			slugs.push(item.slug);
		}
	}

	return slugs;
}

/**
 * Get all doc pages metadata
 */
export function getAllDocPages(): DocPageMetadata[] {
	const navigation = getNavigation();
	const pages: DocPageMetadata[] = [];

	for (const section of navigation.sections) {
		for (const item of section.items) {
			const page = getDocPage(item.slug);
			if (page) {
				pages.push({
					slug: page.slug,
					title: page.title,
					description: page.description,
				});
			}
		}
	}

	return pages;
}

/**
 * Convert slug to file path
 * "" -> "index.md"
 * "getting-started" -> "getting-started.md"
 * "installation/plugins" -> "installation/plugins.md"
 */
function slugToFilePath(slug: string): string {
	if (slug === "") {
		return path.join(DOCS_DIR, "index.md");
	}
	return path.join(DOCS_DIR, `${slug}.md`);
}

/**
 * Get a single doc page by slug
 */
export function getDocPage(slug: string): DocPage | null {
	try {
		const filePath = slugToFilePath(slug);

		if (!fs.existsSync(filePath)) {
			return null;
		}

		const fileContent = fs.readFileSync(filePath, "utf-8");
		const { data, content } = matter(fileContent);

		return {
			slug,
			title: data.title || "",
			description: data.description || "",
			content,
		};
	} catch (error) {
		console.error(`Error reading doc page ${slug}:`, error);
		return null;
	}
}

/**
 * Get adjacent pages (previous and next) for navigation
 */
export function getAdjacentPages(currentSlug: string): {
	prev: NavItem | null;
	next: NavItem | null;
} {
	const navigation = getNavigation();

	// Flatten all items into a single array
	const allItems: NavItem[] = [];
	for (const section of navigation.sections) {
		for (const item of section.items) {
			allItems.push(item);
		}
	}

	// Find current index
	const currentIndex = allItems.findIndex((item) => item.slug === currentSlug);

	if (currentIndex === -1) {
		return { prev: null, next: null };
	}

	return {
		prev: currentIndex > 0 ? allItems[currentIndex - 1] : null,
		next:
			currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null,
	};
}

/**
 * Generate breadcrumb items for a given slug
 */
export function generateBreadcrumbs(
	slug: string,
): Array<{ title: string; href: string }> {
	if (slug === "") {
		return [];
	}

	const navigation = getNavigation();
	const breadcrumbs: Array<{ title: string; href: string }> = [];

	// Build breadcrumbs from slug parts
	const parts = slug.split("/");
	let currentPath = "";

	for (let i = 0; i < parts.length; i++) {
		currentPath = i === 0 ? parts[i] : `${currentPath}/${parts[i]}`;

		// Find title for this path
		let title = parts[i];
		for (const section of navigation.sections) {
			for (const item of section.items) {
				if (item.slug === currentPath) {
					title = item.title;
					break;
				}
			}
		}

		breadcrumbs.push({
			title,
			href: `/docs/${currentPath}`,
		});
	}

	return breadcrumbs;
}

/**
 * Get the section title for a given slug
 */
export function getSectionTitle(slug: string): string | null {
	const navigation = getNavigation();

	for (const section of navigation.sections) {
		for (const item of section.items) {
			if (item.slug === slug) {
				return section.title;
			}
		}
	}

	return null;
}
