"use client";

import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";

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
			theme: "base",
			themeVariables: isDark
				? {
						// Dark mode: light text on transparent backgrounds
						primaryColor: "transparent",
						primaryTextColor: "#f3f4f6",
						primaryBorderColor: "#60a5fa",
						lineColor: "#9ca3af",
						secondaryColor: "transparent",
						tertiaryColor: "transparent",
						background: "transparent",
						mainBkg: "transparent",
						secondBkg: "transparent",
						tertiaryBkg: "transparent",
						nodeBorder: "#60a5fa",
						clusterBkg: "transparent",
						clusterBorder: "#60a5fa",
						edgeLabelBackground: "transparent",
						textColor: "#f3f4f6",
						fontSize: "16px",
					}
				: {
						// Light mode: dark text on transparent backgrounds
						primaryColor: "transparent",
						primaryTextColor: "#171717",
						primaryBorderColor: "#2563eb",
						lineColor: "#6b7280",
						secondaryColor: "transparent",
						tertiaryColor: "transparent",
						background: "transparent",
						mainBkg: "transparent",
						secondBkg: "transparent",
						tertiaryBkg: "transparent",
						nodeBorder: "#2563eb",
						clusterBkg: "transparent",
						clusterBorder: "#2563eb",
						edgeLabelBackground: "transparent",
						textColor: "#171717",
						fontSize: "16px",
					},
			flowchart: {
				useMaxWidth: true,
				htmlLabels: true,
				curve: "basis",
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
				setError(
					err instanceof Error ? err.message : "Failed to render diagram",
				);
			}
		};

		renderDiagram();
	}, [chart, isDark]);

	// Add colored backgrounds to edge labels after SVG renders
	useEffect(() => {
		if (!containerRef.current || !svg) return;

		const svgElement = containerRef.current.querySelector("svg");
		if (!svgElement) return;

		// Wait for next frame to ensure text is fully rendered
		requestAnimationFrame(() => {
			const edgeLabels = svgElement.querySelectorAll(".edgeLabel");

			edgeLabels.forEach((labelGroup) => {
				const textElement = labelGroup.querySelector("text");
				if (!textElement || !(textElement instanceof SVGTextElement)) return;

				const labelText = textElement.textContent?.trim();
				let bgColor = "";
				let textColor = "#ffffff";

				if (labelText === "No") {
					bgColor = "#ef4444";
					textColor = "#ffffff";
				} else if (labelText === "Yes") {
					bgColor = "#22c55e";
					textColor = "#ffffff";
				} else if (labelText === "Blocked") {
					bgColor = "#f59e0b";
					textColor = "#000000";
				}

				if (bgColor) {
					try {
						const bbox = textElement.getBBox();
						const padding = 4;

						const rect = document.createElementNS(
							"http://www.w3.org/2000/svg",
							"rect",
						);
						rect.setAttribute("x", String(bbox.x - padding));
						rect.setAttribute("y", String(bbox.y - padding));
						rect.setAttribute("width", String(bbox.width + padding * 2));
						rect.setAttribute("height", String(bbox.height + padding * 2));
						rect.setAttribute("fill", bgColor);
						rect.setAttribute("rx", "3");

						labelGroup.insertBefore(rect, textElement);

						textElement.setAttribute("fill", textColor);
						textElement.style.fill = textColor;
					} catch (err) {
						console.error("Error adding label background:", err);
					}
				}
			});
		});
	}, [svg]);

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
			className="my-6 flex justify-center overflow-x-auto not-prose"
			style={{ background: "transparent" }}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid generates safe SVG
			dangerouslySetInnerHTML={{ __html: svg }}
		/>
	);
}
