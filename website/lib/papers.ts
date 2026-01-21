import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const PAPERS_DIR = path.join(process.cwd(), "content", "papers");

export interface Paper {
	slug: string;
	title: string;
	subtitle?: string;
	description: string;
	date: string;
	authors: string[];
	tags: string[];
	content: string;
	isMdx: boolean;
}

export interface PaperMetadata {
	slug: string;
	title: string;
	subtitle?: string;
	description: string;
	date: string;
	authors: string[];
	tags: string[];
}

/**
 * Get all papers, sorted by date (newest first)
 */
export function getAllPapers(): PaperMetadata[] {
	try {
		if (!fs.existsSync(PAPERS_DIR)) {
			return [];
		}

		const files = fs
			.readdirSync(PAPERS_DIR)
			.filter((file) => file.endsWith(".md") || file.endsWith(".mdx"));

		const papers = files
			.map((file) => {
				const slug = file.replace(/\.mdx?$/, "");
				const filePath = path.join(PAPERS_DIR, file);
				const fileContent = fs.readFileSync(filePath, "utf-8");
				const { data } = matter(fileContent);

				return {
					slug,
					title: data.title || "",
					subtitle: data.subtitle,
					description: data.description || "",
					date: data.date || "",
					authors: data.authors || [],
					tags: data.tags || [],
				};
			})
			.sort((a, b) => {
				// Sort by date, newest first
				return new Date(b.date).getTime() - new Date(a.date).getTime();
			});

		return papers;
	} catch (error) {
		console.error("Error reading papers:", error);
		return [];
	}
}

/**
 * Get a single paper by slug
 */
export function getPaper(slug: string): Paper | null {
	try {
		// Try .mdx first, then fall back to .md
		let filePath = path.join(PAPERS_DIR, `${slug}.mdx`);
		let isMdx = true;

		if (!fs.existsSync(filePath)) {
			filePath = path.join(PAPERS_DIR, `${slug}.md`);
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
			subtitle: data.subtitle,
			description: data.description || "",
			date: data.date || "",
			authors: data.authors || [],
			tags: data.tags || [],
			content,
			isMdx,
		};
	} catch (error) {
		console.error(`Error reading paper ${slug}:`, error);
		return null;
	}
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
