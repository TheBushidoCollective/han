import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, getAllBlogPosts, getAllCategories } from "../../lib/blog";
import Header from "../components/Header";

export const metadata: Metadata = {
	title: "Blog - Han",
	description:
		"Learn how to use Han plugins with real-world examples, tutorials, and technical deep dives from the Bushido Collective.",
};

export default function BlogPage() {
	const posts = getAllBlogPosts();
	const categories = getAllCategories();

	return (
		<div className="min-h-screen bg-white dark:bg-gray-900">
			<Header />

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="flex gap-8">
					{/* Sidebar */}
					<aside className="hidden lg:block w-64 flex-shrink-0">
						<div className="sticky top-8">
							<div className="space-y-6">
								<div>
									<h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
										Categories
									</h3>
									<div className="space-y-2">
										<Link
											href="/blog"
											className="block text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
										>
											All Posts
										</Link>
										{categories.map((category) => (
											<Link
												key={category}
												href={`/blog?category=${encodeURIComponent(category)}`}
												className="block text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
											>
												{category}
											</Link>
										))}
									</div>
								</div>

								<div>
									<h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
										Featured Topics
									</h3>
									<div className="flex flex-wrap gap-2">
										{[
											"testing",
											"nextjs",
											"typescript",
											"mcp",
											"hooks",
											"github",
										].map((tag) => (
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
							</div>
						</div>
					</aside>

					{/* Main Content */}
					<div className="flex-1">
						<div className="mb-12">
							<h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
								Blog
							</h1>
							<p className="text-xl text-gray-600 dark:text-gray-300">
								Real-world examples, tutorials, and technical insights from the
								Han community.
							</p>
						</div>

						{posts.length === 0 ? (
							<div className="text-center py-12">
								<p className="text-gray-600 dark:text-gray-400">
									No blog posts yet. Check back soon!
								</p>
							</div>
						) : (
							<div className="space-y-8">
								{posts.map((post) => (
									<article
										key={post.slug}
										className="border-b border-gray-200 dark:border-gray-800 pb-8 last:border-b-0"
									>
										<div className="flex items-start justify-between gap-4 mb-3">
											<div className="flex-1">
												<Link
													href={`/blog/${post.slug}`}
													className="group block"
												>
													<h2 className="text-2xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition mb-2">
														{post.title}
													</h2>
												</Link>

												<div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
													<time dateTime={post.date}>
														{formatDate(post.date)}
													</time>
													<span>•</span>
													<span>{post.author}</span>
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
											</div>
										</div>

										<p className="text-gray-600 dark:text-gray-300 mb-4">
											{post.description}
										</p>

										<div className="flex items-center justify-between">
											<div className="flex flex-wrap gap-2">
												{post.tags.slice(0, 5).map((tag) => (
													<Link
														key={tag}
														href={`/blog?tag=${encodeURIComponent(tag)}`}
														className="inline-block px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
													>
														{tag}
													</Link>
												))}
											</div>

											<Link
												href={`/blog/${post.slug}`}
												className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm transition"
											>
												Read more →
											</Link>
										</div>
									</article>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
