import type { Metadata } from "next";
import "./globals.css";
import Footer from "./components/Footer";

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
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className="antialiased flex flex-col min-h-screen">
				<main className="flex-1">{children}</main>
				<Footer />
			</body>
		</html>
	);
}
