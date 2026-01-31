import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { getFileContributorNames } from "./git-contributors";

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

				// Get authors from git history, sorted by number of contributions
				const gitAuthors = getFileContributorNames(filePath);
				// Fall back to frontmatter authors if no git history
				const authors = gitAuthors.length > 0 ? gitAuthors : data.authors || [];

				return {
					slug,
					title: data.title || "",
					subtitle: data.subtitle,
					description: data.description || "",
					date: data.date || "",
					authors,
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

		// Get authors from git history, sorted by number of contributions
		const gitAuthors = getFileContributorNames(filePath);
		// Fall back to frontmatter authors if no git history
		const authors = gitAuthors.length > 0 ? gitAuthors : data.authors || [];

		// Strip duplicate title and subtitle from content
		let processedContent = content;
		const lines = content.split("\n");
		let startIndex = 0;

		// Skip leading empty lines
		while (startIndex < lines.length && lines[startIndex].trim() === "") {
			startIndex++;
		}

		// Check if first non-empty line is an H1 heading
		if (startIndex < lines.length && lines[startIndex].startsWith("# ")) {
			startIndex++; // Skip the H1

			// Skip any empty lines after H1
			while (startIndex < lines.length && lines[startIndex].trim() === "") {
				startIndex++;
			}

			// Check if next line is an H2 heading (subtitle)
			if (startIndex < lines.length && lines[startIndex].startsWith("## ")) {
				startIndex++; // Skip the H2

				// Skip any empty lines after H2
				while (startIndex < lines.length && lines[startIndex].trim() === "") {
					startIndex++;
				}

				// Check if next line is a horizontal rule
				if (startIndex < lines.length && lines[startIndex].trim() === "---") {
					startIndex++; // Skip the horizontal rule
				}
			}

			processedContent = lines.slice(startIndex).join("\n");
		}

		return {
			slug,
			title: data.title || "",
			subtitle: data.subtitle,
			description: data.description || "",
			date: data.date || "",
			authors,
			tags: data.tags || [],
			content: processedContent,
			isMdx,
		};
	} catch (error) {
		console.error(`Error reading paper ${slug}:`, error);
		return null;
	}
}

/**
 * Format authors list with "and" before the last author
 * - 1 author: "John"
 * - 2 authors: "John and Jane"
 * - 3+ authors: "John, Jane, and Bob"
 */
export function formatAuthors(authors: string[]): string {
	if (authors.length === 0) return "";
	if (authors.length === 1) return authors[0];
	if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
	return `${authors.slice(0, -1).join(", ")}, and ${authors[authors.length - 1]}`;
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
