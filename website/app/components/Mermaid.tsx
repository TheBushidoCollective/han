"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

interface MermaidProps {
	chart: string;
}

export function Mermaid({ chart }: MermaidProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [svg, setSvg] = useState<string>("");
	const [error, setError] = useState<string | null>(null);
	const [isDark, setIsDark] = useState<boolean | null>(null);

	// Detect dark mode
	useEffect(() => {
		const checkDarkMode = () => {
			const isDarkMode = document.documentElement.classList.contains("dark");
			setIsDark(isDarkMode);
		};

		// Initial check
		checkDarkMode();

		// Watch for theme changes
		const observer = new MutationObserver(checkDarkMode);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (!chart || isDark === null) return;

		// Re-initialize mermaid each time to pick up theme changes
		mermaid.initialize({
			startOnLoad: false,
			theme: isDark ? "dark" : "default",
			flowchart: {
				useMaxWidth: true,
				htmlLabels: true,
				curve: "linear",
			},
			sequence: {
				useMaxWidth: true,
				wrap: true,
			},
		});

		// Render the diagram
		const renderDiagram = async () => {
			try {
				const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
				const { svg } = await mermaid.render(id, chart);
				setSvg(svg);
				setError(null);
			} catch (err) {
				console.error("Mermaid rendering error:", err);
				setError(err instanceof Error ? err.message : "Failed to render diagram");
			}
		};

		renderDiagram();
	}, [chart, isDark]);

	// Don't render anything until we've detected the theme
	if (isDark === null) {
		return null;
	}

	if (error) {
		return (
			<div className="my-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
				<p className="text-sm text-red-800 dark:text-red-200">
					<strong>Diagram Error:</strong> {error}
				</p>
				<pre className="mt-2 text-xs text-red-700 dark:text-red-300 overflow-x-auto">
					{chart}
				</pre>
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className="my-6 flex justify-center overflow-x-auto [&_svg]:!bg-transparent [&_rect.background]:!fill-transparent"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid generates safe SVG
			dangerouslySetInnerHTML={{ __html: svg }}
		/>
	);
}
