import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export interface BlogPost {
	slug: string;
	title: string;
	description: string;
	date: string;
	author: string;
	tags: string[];
	category: string;
	content: string;
	isMdx: boolean;
}

export interface BlogPostMetadata {
	slug: string;
	title: string;
	description: string;
	date: string;
	author: string;
	tags: string[];
	category: string;
}

/**
 * Get all blog posts, sorted by date (newest first)
 */
export function getAllBlogPosts(): BlogPostMetadata[] {
	try {
		if (!fs.existsSync(BLOG_DIR)) {
			return [];
		}

		const files = fs
			.readdirSync(BLOG_DIR)
			.filter((file) => file.endsWith(".md") || file.endsWith(".mdx"));

		const posts = files
			.map((file) => {
				const slug = file.replace(/\.mdx?$/, "");
				const filePath = path.join(BLOG_DIR, file);
				const fileContent = fs.readFileSync(filePath, "utf-8");
				const { data } = matter(fileContent);

				return {
					slug,
					title: data.title || "",
					description: data.description || "",
					date: data.date || "",
					author: data.author || "",
					tags: data.tags || [],
					category: data.category || "Uncategorized",
				};
			})
			.sort((a, b) => {
				// Sort by date, newest first
				return new Date(b.date).getTime() - new Date(a.date).getTime();
			});

		return posts;
	} catch (error) {
		console.error("Error reading blog posts:", error);
		return [];
	}
}

/**
 * Get a single blog post by slug
 */
export function getBlogPost(slug: string): BlogPost | null {
	try {
		// Try .mdx first, then fall back to .md
		let filePath = path.join(BLOG_DIR, `${slug}.mdx`);
		let isMdx = true;

		if (!fs.existsSync(filePath)) {
			filePath = path.join(BLOG_DIR, `${slug}.md`);
			isMdx = false;

			if (!fs.existsSync(filePath)) {
				return null;
			}
		}

		const fileContent = fs.readFileSync(filePath, "utf-8");
		const { data, content } = matter(fileContent);

		return {
			slug,
			title: data.title || "",
			description: data.description || "",
			date: data.date || "",
			author: data.author || "",
			tags: data.tags || [],
			category: data.category || "Uncategorized",
			content,
			isMdx,
		};
	} catch (error) {
		console.error(`Error reading blog post ${slug}:`, error);
		return null;
	}
}

/**
 * Get all unique categories from blog posts
 */
export function getAllCategories(): string[] {
	const posts = getAllBlogPosts();
	const categories = new Set(posts.map((post) => post.category));
	return Array.from(categories).sort();
}

/**
 * Get all unique tags from blog posts
 */
export function getAllTags(): string[] {
	const posts = getAllBlogPosts();
	const tags = new Set(posts.flatMap((post) => post.tags));
	return Array.from(tags).sort();
}

/**
 * Get blog posts by category
 */
export function getBlogPostsByCategory(category: string): BlogPostMetadata[] {
	const posts = getAllBlogPosts();
	return posts.filter((post) => post.category === category);
}

/**
 * Get blog posts by tag
 */
export function getBlogPostsByTag(tag: string): BlogPostMetadata[] {
	const posts = getAllBlogPosts();
	return posts.filter((post) => post.tags.includes(tag));
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
	try {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	} catch {
		return dateString;
	}
}
