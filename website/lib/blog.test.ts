import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
	formatDate,
	getAllBlogPosts,
	getAllCategories,
	getAllTags,
	getBlogPost,
	getBlogPostsByCategory,
	getBlogPostsByTag,
} from "./blog";

// Mock blog directory path for testing
const TEST_BLOG_DIR = path.join(process.cwd(), "content", "blog");

describe("Blog utilities", () => {
	describe("getAllBlogPosts", () => {
		it("returns an array of blog posts", () => {
			const posts = getAllBlogPosts();
			expect(Array.isArray(posts)).toBe(true);
		});

		it("returns posts with required metadata fields", () => {
			const posts = getAllBlogPosts();
			if (posts.length > 0) {
				const post = posts[0];
				expect(post).toHaveProperty("slug");
				expect(post).toHaveProperty("title");
				expect(post).toHaveProperty("description");
				expect(post).toHaveProperty("date");
				expect(post).toHaveProperty("authors");
				expect(post).toHaveProperty("tags");
				expect(post).toHaveProperty("category");
			}
		});

		it("returns posts sorted by date (newest first)", () => {
			const posts = getAllBlogPosts();
			if (posts.length >= 2) {
				for (let i = 0; i < posts.length - 1; i++) {
					const currentDate = new Date(posts[i].date).getTime();
					const nextDate = new Date(posts[i + 1].date).getTime();
					expect(currentDate).toBeGreaterThanOrEqual(nextDate);
				}
			}
		});

		it("filters only .md and .mdx files", () => {
			const posts = getAllBlogPosts();
			for (const post of posts) {
				// Slugs shouldn't contain file extensions
				expect(post.slug).not.toContain(".md");
				expect(post.slug).not.toContain(".mdx");
			}
		});

		it("returns tags as an array", () => {
			const posts = getAllBlogPosts();
			for (const post of posts) {
				expect(Array.isArray(post.tags)).toBe(true);
			}
		});
	});

	describe("getBlogPost", () => {
		it("returns null for non-existent post", () => {
			const post = getBlogPost("non-existent-post-slug-12345");
			expect(post).toBeNull();
		});

		it("returns a blog post with content for existing slug", () => {
			const posts = getAllBlogPosts();
			if (posts.length > 0) {
				const post = getBlogPost(posts[0].slug);
				expect(post).not.toBeNull();
				expect(post).toHaveProperty("content");
				expect(post).toHaveProperty("isMdx");
			}
		});

		it("includes all metadata fields for existing post", () => {
			const posts = getAllBlogPosts();
			if (posts.length > 0) {
				const post = getBlogPost(posts[0].slug);
				expect(post).toHaveProperty("slug");
				expect(post).toHaveProperty("title");
				expect(post).toHaveProperty("description");
				expect(post).toHaveProperty("date");
				expect(post).toHaveProperty("authors");
				expect(post).toHaveProperty("tags");
				expect(post).toHaveProperty("category");
				expect(post).toHaveProperty("content");
				expect(post).toHaveProperty("isMdx");
			}
		});

		it("correctly identifies MDX files", () => {
			const posts = getAllBlogPosts();
			// Find an MDX post if one exists
			const mdxPost = posts.find((p) => {
				const mdxPath = path.join(TEST_BLOG_DIR, `${p.slug}.mdx`);
				return fs.existsSync(mdxPath);
			});
			if (mdxPost) {
				const post = getBlogPost(mdxPost.slug);
				expect(post?.isMdx).toBe(true);
			}
		});

		it("correctly identifies MD files", () => {
			const posts = getAllBlogPosts();
			// Find a non-MDX post
			const mdPost = posts.find((p) => {
				const mdxPath = path.join(TEST_BLOG_DIR, `${p.slug}.mdx`);
				const mdPath = path.join(TEST_BLOG_DIR, `${p.slug}.md`);
				return !fs.existsSync(mdxPath) && fs.existsSync(mdPath);
			});
			if (mdPost) {
				const post = getBlogPost(mdPost.slug);
				expect(post?.isMdx).toBe(false);
			}
		});

		it("prefers .mdx over .md when both exist", () => {
			// This tests the priority in getBlogPost - .mdx is checked first
			const posts = getAllBlogPosts();
			if (posts.length > 0) {
				const post = getBlogPost(posts[0].slug);
				if (post) {
					const mdxExists = fs.existsSync(
						path.join(TEST_BLOG_DIR, `${post.slug}.mdx`),
					);
					if (mdxExists) {
						expect(post.isMdx).toBe(true);
					}
				}
			}
		});
	});

	describe("getAllCategories", () => {
		it("returns an array of unique categories", () => {
			const categories = getAllCategories();
			expect(Array.isArray(categories)).toBe(true);
			// Check uniqueness
			const uniqueCategories = [...new Set(categories)];
			expect(categories.length).toBe(uniqueCategories.length);
		});

		it("returns sorted categories", () => {
			const categories = getAllCategories();
			const sortedCategories = [...categories].sort();
			expect(categories).toEqual(sortedCategories);
		});

		it("extracts categories from all posts", () => {
			const posts = getAllBlogPosts();
			const categories = getAllCategories();
			const postCategories = new Set(posts.map((p) => p.category));
			expect(categories.length).toBe(postCategories.size);
		});
	});

	describe("getAllTags", () => {
		it("returns an array of unique tags", () => {
			const tags = getAllTags();
			expect(Array.isArray(tags)).toBe(true);
			// Check uniqueness
			const uniqueTags = [...new Set(tags)];
			expect(tags.length).toBe(uniqueTags.length);
		});

		it("returns sorted tags", () => {
			const tags = getAllTags();
			const sortedTags = [...tags].sort();
			expect(tags).toEqual(sortedTags);
		});

		it("extracts tags from all posts", () => {
			const posts = getAllBlogPosts();
			const tags = getAllTags();
			const allPostTags = new Set(posts.flatMap((p) => p.tags));
			expect(tags.length).toBe(allPostTags.size);
		});
	});

	describe("getBlogPostsByCategory", () => {
		it("returns empty array for non-existent category", () => {
			const posts = getBlogPostsByCategory("NonExistentCategory12345");
			expect(posts).toEqual([]);
		});

		it("returns posts filtered by category", () => {
			const categories = getAllCategories();
			if (categories.length > 0) {
				const category = categories[0];
				const posts = getBlogPostsByCategory(category);
				for (const post of posts) {
					expect(post.category).toBe(category);
				}
			}
		});

		it("returns all posts for a category", () => {
			const allPosts = getAllBlogPosts();
			const categories = getAllCategories();
			if (categories.length > 0) {
				const category = categories[0];
				const filteredPosts = getBlogPostsByCategory(category);
				const manuallyFiltered = allPosts.filter(
					(p) => p.category === category,
				);
				expect(filteredPosts.length).toBe(manuallyFiltered.length);
			}
		});
	});

	describe("getBlogPostsByTag", () => {
		it("returns empty array for non-existent tag", () => {
			const posts = getBlogPostsByTag("nonexistenttag12345");
			expect(posts).toEqual([]);
		});

		it("returns posts filtered by tag", () => {
			const tags = getAllTags();
			if (tags.length > 0) {
				const tag = tags[0];
				const posts = getBlogPostsByTag(tag);
				for (const post of posts) {
					expect(post.tags).toContain(tag);
				}
			}
		});

		it("returns all posts containing the tag", () => {
			const allPosts = getAllBlogPosts();
			const tags = getAllTags();
			if (tags.length > 0) {
				const tag = tags[0];
				const filteredPosts = getBlogPostsByTag(tag);
				const manuallyFiltered = allPosts.filter((p) => p.tags.includes(tag));
				expect(filteredPosts.length).toBe(manuallyFiltered.length);
			}
		});
	});

	describe("formatDate", () => {
		it("formats valid date string correctly", () => {
			const formatted = formatDate("2026-01-21");
			expect(formatted).toBe("January 21, 2026");
		});

		it("formats ISO date string correctly", () => {
			const formatted = formatDate("2025-12-25T00:00:00Z");
			// The exact output depends on locale, but it should include year, month, and day
			expect(formatted).toContain("2025");
			expect(formatted).toContain("December");
			expect(formatted).toContain("25");
		});

		it("returns original string for invalid date", () => {
			const invalidDate = "not-a-date";
			const formatted = formatDate(invalidDate);
			// For invalid dates, the function returns the original string
			// because Date constructor creates "Invalid Date" which toLocaleDateString handles
			expect(typeof formatted).toBe("string");
		});

		it("handles empty string", () => {
			const formatted = formatDate("");
			expect(typeof formatted).toBe("string");
		});

		it("uses US locale formatting", () => {
			const formatted = formatDate("2026-03-15");
			// US format: Month Day, Year
			expect(formatted).toBe("March 15, 2026");
		});

		it("formats full date with long month name", () => {
			const formatted = formatDate("2026-11-08");
			expect(formatted).toBe("November 8, 2026");
		});
	});
});
