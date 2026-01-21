import fs from "node:fs";
import path from "node:path";
import { getAllBlogPosts } from "../lib/blog";
import { buildSearchIndex } from "../lib/search";

const SITE_URL = "https://han.guru";

interface SitemapEntry {
	url: string;
	lastmod: string;
	changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
	priority: number;
}

const entries: SitemapEntry[] = [];

// Add static pages
entries.push(
	{
		url: `${SITE_URL}/`,
		lastmod: new Date().toISOString(),
		changefreq: "daily",
		priority: 1.0,
	},
	{
		url: `${SITE_URL}/blog`,
		lastmod: new Date().toISOString(),
		changefreq: "daily",
		priority: 0.9,
	},
	{
		url: `${SITE_URL}/plugins`,
		lastmod: new Date().toISOString(),
		changefreq: "weekly",
		priority: 0.8,
	},
);

// Add blog posts
const posts = getAllBlogPosts();
for (const post of posts) {
	entries.push({
		url: `${SITE_URL}/blog/${post.slug}`,
		lastmod: post.date,
		changefreq: "monthly",
		priority: 0.7,
	});
}

// Add plugin pages
const searchIndex = buildSearchIndex();
for (const plugin of searchIndex.entries) {
	entries.push({
		url: `${SITE_URL}/plugins/${plugin.id}`,
		lastmod: new Date().toISOString(),
		changefreq: "weekly",
		priority: 0.6,
	});
}

// Generate XML
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
	.map(
		(entry) => `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
	)
	.join("\n")}
</urlset>`;

// Create public directory if it doesn't exist
const publicDir = path.join(process.cwd(), "public");
if (!fs.existsSync(publicDir)) {
	fs.mkdirSync(publicDir, { recursive: true });
}

// Write sitemap
const sitemapPath = path.join(publicDir, "sitemap.xml");
fs.writeFileSync(sitemapPath, xml);

console.log(`Sitemap generated at ${sitemapPath}`);
console.log(`✓ Generated ${entries.length} URLs in sitemap`);
