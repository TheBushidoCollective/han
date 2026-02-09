import type { Metadata } from "next";
import "./globals.css";
import Analytics from "./components/Analytics";
import Footer from "./components/Footer";
import { ThemeProvider } from "./components/ThemeProvider";

export const metadata: Metadata = {
	title: "Han - Ship-Ready Code from AI Coding Agents",
	description:
		"139+ plugins for quality gates, tooling, memory, and specialized agents. Your AI coding agent writes code that's ready to merge.",
	keywords: [
		"ai-coding-agents",
		"claude-code",
		"opencode",
		"gemini-cli",
		"codex-cli",
		"plugins",
		"marketplace",
		"quality-gates",
		"development",
	],
	alternates: {
		types: {
			"application/rss+xml": "https://han.guru/rss.xml",
			"application/atom+xml": "https://han.guru/atom.xml",
			"application/json": "https://han.guru/feed.json",
		},
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* Blocking script to prevent theme flash - runs before body renders */}
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Required for theme flash prevention - content is static
					dangerouslySetInnerHTML={{
						__html: `
							(function() {
								try {
									var theme = localStorage.getItem('theme');
									if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
										document.documentElement.classList.add('dark');
									}
								} catch (e) {}
							})();
						`,
					}}
				/>
			</head>
			<body className="antialiased flex flex-col min-h-screen">
				<ThemeProvider>
					<main className="flex-1">{children}</main>
					<Footer />
					<Analytics />
				</ThemeProvider>
			</body>
		</html>
	);
}
