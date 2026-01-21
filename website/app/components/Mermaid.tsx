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
	const [isDark, setIsDark] = useState(false);

	// Detect dark mode
	useEffect(() => {
		const checkDarkMode = () => {
			setIsDark(document.documentElement.classList.contains("dark"));
		};

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
		// Initialize mermaid with theme-aware configuration
		const theme = isDark ? "dark" : "default";
		const themeVariables = isDark
			? {
					primaryColor: "#3b82f6",
					primaryTextColor: "#e5e7eb",
					primaryBorderColor: "#60a5fa",
					lineColor: "#9ca3af",
					secondaryColor: "#1f2937",
					tertiaryColor: "#374151",
					background: "transparent",
					mainBkg: "#1f2937",
					secondBkg: "#374151",
					tertiaryBkg: "#4b5563",
					clusterBkg: "#1f2937",
					clusterBorder: "#4b5563",
					edgeLabelBackground: "transparent",
					fontFamily: "ui-sans-serif, system-ui, sans-serif",
					fontSize: "14px",
				}
			: {
					primaryColor: "#3b82f6",
					primaryTextColor: "#1f2937",
					primaryBorderColor: "#60a5fa",
					lineColor: "#6b7280",
					secondaryColor: "#e5e7eb",
					tertiaryColor: "#d1d5db",
					background: "transparent",
					mainBkg: "#f3f4f6",
					secondBkg: "#e5e7eb",
					tertiaryBkg: "#d1d5db",
					clusterBkg: "#f9fafb",
					clusterBorder: "#d1d5db",
					edgeLabelBackground: "transparent",
					fontFamily: "ui-sans-serif, system-ui, sans-serif",
					fontSize: "14px",
				};

		mermaid.initialize({
			startOnLoad: false,
			theme,
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
				setSvg(svg);
				setError(null);
			} catch (err) {
				console.error("Mermaid rendering error:", err);
				setError(err instanceof Error ? err.message : "Failed to render diagram");
			}
		};

		renderDiagram();
	}, [chart, isDark]);

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
