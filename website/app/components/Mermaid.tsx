"use client";

import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";

interface MermaidProps {
	chart: string;
}

/**
 * Convert a light color to a darker version for dark mode
 * Preserves hue but reduces lightness significantly
 */
function darkenColorForDarkMode(hexColor: string): string {
	// Remove # if present
	const hex = hexColor.replace("#", "");
	if (hex.length !== 6) return hexColor;

	// Parse RGB
	const r = Number.parseInt(hex.substring(0, 2), 16);
	const g = Number.parseInt(hex.substring(2, 4), 16);
	const b = Number.parseInt(hex.substring(4, 6), 16);

	// Convert to HSL
	const rNorm = r / 255;
	const gNorm = g / 255;
	const bNorm = b / 255;

	const max = Math.max(rNorm, gNorm, bNorm);
	const min = Math.min(rNorm, gNorm, bNorm);
	const l = (max + min) / 2;

	// Only darken if it's a light color (lightness > 0.7)
	if (l < 0.7) return hexColor;

	let h = 0;
	let s = 0;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

		switch (max) {
			case rNorm:
				h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
				break;
			case gNorm:
				h = ((bNorm - rNorm) / d + 2) / 6;
				break;
			case bNorm:
				h = ((rNorm - gNorm) / d + 4) / 6;
				break;
		}
	}

	// Darken: reduce lightness to 0.25-0.35 range for dark mode
	const newL = 0.3 + (l - 0.7) * 0.2;
	// Significantly boost saturation for better color visibility in dark mode
	// Pastel colors have low saturation, so we need to increase it substantially
	const newS = Math.min(s * 2.5 + 0.3, 0.9);

	// Convert back to RGB
	const hueToRgb = (p: number, q: number, t: number) => {
		let tNorm = t;
		if (tNorm < 0) tNorm += 1;
		if (tNorm > 1) tNorm -= 1;
		if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
		if (tNorm < 1 / 2) return q;
		if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
		return p;
	};

	let newR: number;
	let newG: number;
	let newB: number;

	if (newS === 0) {
		newR = newG = newB = newL;
	} else {
		const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
		const p = 2 * newL - q;
		newR = hueToRgb(p, q, h + 1 / 3);
		newG = hueToRgb(p, q, h);
		newB = hueToRgb(p, q, h - 1 / 3);
	}

	const toHex = (n: number) =>
		Math.round(n * 255)
			.toString(16)
			.padStart(2, "0");

	return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
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
						// Dark mode: light text on darker backgrounds with white lines
						primaryColor: "transparent",
						primaryTextColor: "#f3f4f6",
						primaryBorderColor: "#ffffff",
						lineColor: "#ffffff",
						secondaryColor: "transparent",
						tertiaryColor: "transparent",
						background: "transparent",
						mainBkg: "transparent",
						secondBkg: "transparent",
						tertiaryBkg: "transparent",
						nodeBorder: "#ffffff",
						nodeTextColor: "#f3f4f6",
						clusterBkg: "transparent",
						clusterBorder: "#ffffff",
						titleColor: "#f3f4f6",
						edgeLabelBackground: "transparent",
						textColor: "#f3f4f6",
						fontSize: "16px",
						// Additional border settings
						border1: "#ffffff",
						border2: "#ffffff",
						arrowheadColor: "#ffffff",
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
						titleColor: "#171717",
						clusterBkg: "transparent",
						clusterBorder: "#2563eb",
						edgeLabelBackground: "transparent",
						textColor: "#171717",
						fontSize: "16px",
					},
			flowchart: {
				useMaxWidth: false,
				htmlLabels: true,
				curve: "basis",
			},
			sequence: {
				useMaxWidth: false,
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

	// Post-process SVG: darken fills in dark mode and add edge label backgrounds
	useEffect(() => {
		if (!containerRef.current || !svg) return;

		const svgElement = containerRef.current.querySelector("svg");
		if (!svgElement) return;

		// Wait for next frame to ensure SVG is fully rendered
		requestAnimationFrame(() => {
			// In dark mode, darken any light-colored fills and fix stroke colors
			if (isDark) {
				const lineColor = "#ffffff";

				// Darken light fills
				const elementsWithFill = svgElement.querySelectorAll("[style*='fill']");
				elementsWithFill.forEach((el) => {
					const style = el.getAttribute("style");
					if (!style) return;

					// Match fill color in style attribute
					const fillMatch = style.match(/fill:\s*(#[0-9a-fA-F]{6})/);
					if (fillMatch) {
						const originalColor = fillMatch[1];
						const darkenedColor = darkenColorForDarkMode(originalColor);
						if (darkenedColor !== originalColor) {
							el.setAttribute(
								"style",
								style.replace(originalColor, darkenedColor),
							);
						}
					}
				});

				// Also check fill attributes directly
				const elementsWithFillAttr = svgElement.querySelectorAll("[fill]");
				elementsWithFillAttr.forEach((el) => {
					const fill = el.getAttribute("fill");
					if (fill?.startsWith("#") && fill.length === 7) {
						const darkenedColor = darkenColorForDarkMode(fill);
						if (darkenedColor !== fill) {
							el.setAttribute("fill", darkenedColor);
						}
					}
				});

				// Fix stroke colors - convert light gray/white strokes to blue
				const elementsWithStroke = svgElement.querySelectorAll(
					"[stroke], [style*='stroke']",
				);
				elementsWithStroke.forEach((el) => {
					// Check stroke attribute
					const stroke = el.getAttribute("stroke");
					if (stroke) {
						const lowerStroke = stroke.toLowerCase();
						// Convert light colors to blue
						if (
							lowerStroke === "#ccc" ||
							lowerStroke === "#cccccc" ||
							lowerStroke === "#ddd" ||
							lowerStroke === "#dddddd" ||
							lowerStroke === "#eee" ||
							lowerStroke === "#eeeeee" ||
							lowerStroke === "#fff" ||
							lowerStroke === "#ffffff" ||
							lowerStroke === "#999" ||
							lowerStroke === "#999999" ||
							lowerStroke === "#aaa" ||
							lowerStroke === "#aaaaaa" ||
							lowerStroke === "#bbb" ||
							lowerStroke === "#bbbbbb" ||
							lowerStroke === "gray" ||
							lowerStroke === "grey" ||
							lowerStroke === "lightgray" ||
							lowerStroke === "lightgrey"
						) {
							el.setAttribute("stroke", lineColor);
						}
					}

					// Check style attribute for stroke
					const style = el.getAttribute("style");
					if (style?.includes("stroke")) {
						let newStyle = style;
						// Replace light stroke colors with blue
						newStyle = newStyle.replace(
							/stroke:\s*#(ccc|ddd|eee|fff|999|aaa|bbb)[;\s]/gi,
							`stroke: ${lineColor};`,
						);
						newStyle = newStyle.replace(
							/stroke:\s*#(cccccc|dddddd|eeeeee|ffffff|999999|aaaaaa|bbbbbb)[;\s]/gi,
							`stroke: ${lineColor};`,
						);
						newStyle = newStyle.replace(
							/stroke:\s*(gray|grey|lightgray|lightgrey)[;\s]/gi,
							`stroke: ${lineColor};`,
						);
						if (newStyle !== style) {
							el.setAttribute("style", newStyle);
						}
					}
				});

				// Ensure cluster/subgraph titles are visible (light text)
				const clusterLabels = svgElement.querySelectorAll(
					".cluster-label, .cluster text, [class*='cluster'] text",
				);
				clusterLabels.forEach((el) => {
					el.setAttribute("fill", "#f3f4f6");
					if (el instanceof HTMLElement || el instanceof SVGElement) {
						(el as SVGElement).style.fill = "#f3f4f6";
					}
				});
			}

			// Add colored backgrounds to edge labels
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
	}, [svg, isDark]);

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
		<div className="my-6 overflow-x-auto not-prose">
			<div
				ref={containerRef}
				className="flex justify-center min-w-fit"
				style={{ background: "transparent" }}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid generates safe SVG
				dangerouslySetInnerHTML={{ __html: svg }}
			/>
		</div>
	);
}
