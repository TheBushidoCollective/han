import type { Metadata } from "next";
import "./globals.css";
import Analytics from "./components/Analytics";
import Footer from "./components/Footer";
import { ThemeProvider } from "./components/ThemeProvider";

export const metadata: Metadata = {
	title: "Han - Sophisticated Claude Code Plugins with Superior Accuracy",
	description:
		"Sophisticated Claude Code plugins with superior accuracy, built on the foundation of the seven Bushido virtues.",
	keywords: [
		"claude",
		"claude-code",
		"plugins",
		"marketplace",
		"bushido",
		"development",
		"quality",
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
