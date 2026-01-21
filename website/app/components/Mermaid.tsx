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

		// Initialize mermaid with theme-aware configuration
		const themeVariables = {
			primaryColor: "#3b82f6",
			primaryTextColor: isDark ? "#e5e7eb" : "#1f2937",
			primaryBorderColor: "#60a5fa",
			lineColor: isDark ? "#9ca3af" : "#6b7280",
			secondaryColor: isDark ? "#1f2937" : "#e5e7eb",
			tertiaryColor: isDark ? "#374151" : "#d1d5db",
			background: "transparent",
			mainBkg: isDark ? "#1f2937" : "#f3f4f6",
			secondBkg: isDark ? "#374151" : "#e5e7eb",
			tertiaryBkg: isDark ? "#4b5563" : "#d1d5db",
			clusterBkg: "transparent",
			clusterBorder: isDark ? "#4b5563" : "#d1d5db",
			edgeLabelBackground: "transparent",
			fontFamily: "ui-sans-serif, system-ui, sans-serif",
			fontSize: "14px",
		};

		// Re-initialize mermaid each time to pick up theme changes
		mermaid.initialize({
			startOnLoad: false,
			theme: "base",
			themeVariables,
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

				// Remove any background elements and set SVG to transparent
				let cleanedSvg = svg
					// Remove background rectangles
					.replace(/<rect[^>]*class="[^"]*background[^"]*"[^>]*>/g, '')
					// Remove any rect with white or colored fill that spans the whole SVG
					.replace(/<rect[^>]*class="[^"]*backgroundRect[^"]*"[^>]*>/g, '')
					// Add transparent background style to the SVG element
					.replace(/<svg/, '<svg style="background: transparent;"');

				setSvg(cleanedSvg);
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
			className="my-6 flex justify-center overflow-x-auto"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid generates safe SVG
			dangerouslySetInnerHTML={{ __html: svg }}
		/>
	);
}
