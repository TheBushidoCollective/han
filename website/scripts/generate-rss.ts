import fs from "node:fs";
import path from "node:path";
import { Feed } from "feed";
import { getAllBlogPosts, getBlogPost } from "../lib/blog";

const SITE_URL = "https://han.guru";
const AUTHOR_NAME = "The Bushido Collective";
const AUTHOR_EMAIL = "info@han.guru";

// Create the RSS feed
const feed = new Feed({
	title: "Han Blog - AI Coding Agent Plugin Marketplace",
	description:
		"News, tutorials, and insights about Han plugins for AI coding agents built on Bushido principles",
	id: SITE_URL,
	link: SITE_URL,
	language: "en",
	image: `${SITE_URL}/og-image.png`,
	favicon: `${SITE_URL}/favicon.ico`,
	copyright: `© ${new Date().getFullYear()} ${AUTHOR_NAME}`,
	feedLinks: {
		rss2: `${SITE_URL}/rss.xml`,
		atom: `${SITE_URL}/atom.xml`,
		json: `${SITE_URL}/feed.json`,
	},
	author: {
		name: AUTHOR_NAME,
		email: AUTHOR_EMAIL,
		link: SITE_URL,
	},
});

// Get all blog posts and add them to the feed
const posts = getAllBlogPosts();

for (const post of posts) {
	const fullPost = getBlogPost(post.slug);
	if (!fullPost) continue;

	const postUrl = `${SITE_URL}/blog/${post.slug}`;
	const postDate = new Date(post.date);

	feed.addItem({
		title: post.title,
		id: postUrl,
		link: postUrl,
		description: post.description,
		content: fullPost.content,
		author: [
			{
				name: post.author,
			},
		],
		date: postDate,
		category: [
			{
				name: post.category,
			},
			...post.tags.map((tag) => ({ name: tag })),
		],
	});
}

// Create public directory if it doesn't exist
const publicDir = path.join(process.cwd(), "public");
if (!fs.existsSync(publicDir)) {
	fs.mkdirSync(publicDir, { recursive: true });
}

// Generate RSS 2.0
const rssPath = path.join(publicDir, "rss.xml");
fs.writeFileSync(rssPath, feed.rss2());
console.log(`RSS feed generated at ${rssPath}`);

// Generate Atom 1.0
const atomPath = path.join(publicDir, "atom.xml");
fs.writeFileSync(atomPath, feed.atom1());
console.log(`Atom feed generated at ${atomPath}`);

// Generate JSON Feed
const jsonPath = path.join(publicDir, "feed.json");
fs.writeFileSync(jsonPath, feed.json1());
console.log(`JSON feed generated at ${jsonPath}`);

console.log(
	`✓ Generated ${posts.length} blog post entries in all feed formats`,
);
