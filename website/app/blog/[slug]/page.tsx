import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDate, getAllBlogPosts, getBlogPost } from "../../../lib/blog";
import Header from "../../components/Header";
import {
	ArchitectureDiagram,
	Callout,
	CodeBlock,
	FileTree,
	MemoryStorageTree,
	Tab,
	Tabs,
	Terminal,
} from "../../components/mdx";

// MDX components mapping
const mdxComponents = {
	Callout,
	CodeBlock,
	Tabs,
	Tab,
	Terminal,
	ArchitectureDiagram,
	FileTree,
	MemoryStorageTree,
};

export async function generateStaticParams() {
	const posts = getAllBlogPosts();
	return posts.map((post) => ({
		slug: post.slug,
	}));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const post = getBlogPost(slug);

	if (!post) {
		return {
			title: "Post Not Found - Han",
		};
	}

	return {
		title: `${post.title} - Han Blog`,
		description: post.description,
	};
}

export default async function BlogPostPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const post = getBlogPost(slug);

	if (!post) {
		notFound();
	}

	const allPosts = getAllBlogPosts();
	const recentPosts = allPosts.slice(0, 5);

	return (
		<div className="min-h-screen bg-white dark:bg-gray-900">
			<Header />

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="flex gap-8">
					{/* Main Content */}
					<article className="flex-1 max-w-3xl">
						{/* Header */}
						<header className="mb-8">
							<Link
								href="/blog"
								className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition mb-4"
							>
								← Back to Blog
							</Link>

							<h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
								{post.title}
							</h1>

							<div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
								<time dateTime={post.date}>{formatDate(post.date)}</time>
								{post.authors.length > 0 && (
									<>
										<span>•</span>
										<span>By {post.authors.join(", ")}</span>
									</>
								)}
								{post.category && (
									<>
										<span>•</span>
										<Link
											href={`/blog?category=${encodeURIComponent(post.category)}`}
											className="hover:text-gray-900 dark:hover:text-white transition"
										>
											{post.category}
										</Link>
									</>
								)}
							</div>

							<p className="text-xl text-gray-600 dark:text-gray-300 mb-6">
								{post.description}
							</p>

							{post.tags.length > 0 && (
								<div className="flex flex-wrap gap-2">
									{post.tags.map((tag) => (
										<Link
											key={tag}
											href={`/blog?tag=${encodeURIComponent(tag)}`}
											className="inline-block px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
										>
											{tag}
										</Link>
									))}
								</div>
							)}
						</header>

						{/* Content */}
						<div className="prose prose-lg dark:prose-invert max-w-none">
							{post.isMdx ? (
								<MDXRemote
									source={post.content}
									components={mdxComponents}
									options={{
										mdxOptions: {
											remarkPlugins: [remarkGfm],
										},
									}}
								/>
							) : (
								<ReactMarkdown remarkPlugins={[remarkGfm]}>
									{post.content}
								</ReactMarkdown>
							)}
						</div>

						{/* Footer */}
						<footer className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
							<div className="flex items-center justify-between">
								<Link
									href="/blog"
									className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
								>
									← Back to all posts
								</Link>

								<div className="flex items-center gap-4">
									<a
										href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://han.thebushido.co/blog/${post.slug}`)}`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
									>
										Share on Twitter
									</a>
								</div>
							</div>
						</footer>
					</article>

					{/* Sidebar */}
					<aside className="hidden lg:block w-80 flex-shrink-0">
						<div className="sticky top-8">
							<div className="space-y-6">
								<div>
									<h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
										Recent Posts
									</h3>
									<div className="space-y-4">
										{recentPosts
											.filter((p) => p.slug !== post.slug)
											.slice(0, 4)
											.map((recentPost) => (
												<Link
													key={recentPost.slug}
													href={`/blog/${recentPost.slug}`}
													className="block group"
												>
													<h4 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition mb-1">
														{recentPost.title}
													</h4>
													<p className="text-xs text-gray-500 dark:text-gray-400">
														{formatDate(recentPost.date)}
													</p>
												</Link>
											))}
									</div>
								</div>

								<div>
									<h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
										Tags
									</h3>
									<div className="flex flex-wrap gap-2">
										{post.tags.map((tag) => (
											<Link
												key={tag}
												href={`/blog?tag=${encodeURIComponent(tag)}`}
												className="inline-block px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
											>
												{tag}
											</Link>
										))}
									</div>
								</div>

								<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
									<h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
										Get Started with Han
									</h3>
									<p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
										Install Han plugins and start building with confidence.
									</p>
									<Link
										href="/docs"
										className="block w-full text-center px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition text-sm"
									>
										View Documentation
									</Link>
								</div>
							</div>
						</div>
					</aside>
				</div>
			</div>
		</div>
	);
}
