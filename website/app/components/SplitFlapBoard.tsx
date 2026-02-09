"use client";

import { useEffect, useRef, useState } from "react";
import { PROVIDERS } from "./providers";

const CYCLE_INTERVAL = 3500;

/** Longest provider name determines total tile count */
const MAX_LENGTH = Math.max(...PROVIDERS.map((p) => p.name.length));

/** Pad name to fixed tile width */
function padName(name: string): string {
	return name.padEnd(MAX_LENGTH);
}

export default function SplitFlapBoard() {
	const [mounted, setMounted] = useState(false);
	const [providerIndex, setProviderIndex] = useState(0);
	const visibleRef = useRef(true);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Cycle timer
	useEffect(() => {
		if (!mounted) return;

		const timer = setInterval(() => {
			if (!visibleRef.current) return;
			setProviderIndex((prev) => (prev + 1) % PROVIDERS.length);
		}, CYCLE_INTERVAL);

		return () => clearInterval(timer);
	}, [mounted]);

	// Visibility API
	useEffect(() => {
		const handler = () => {
			visibleRef.current = !document.hidden;
		};
		document.addEventListener("visibilitychange", handler);
		return () => document.removeEventListener("visibilitychange", handler);
	}, []);

	const name = padName(PROVIDERS[providerIndex].name);

	// SSR-safe: render first provider as plain text
	if (!mounted) {
		return (
			<span
				className="inline-flex items-center"
				role="img"
				aria-label={`for ${PROVIDERS[0].name}`}
			>
				<span
					style={{
						fontFamily: "'Courier New', Courier, monospace",
						letterSpacing: "0.02em",
					}}
				>
					{PROVIDERS[0].name}
				</span>
			</span>
		);
	}

	return (
		<span
			className="inline-flex items-center"
			role="img"
			aria-label={`for ${PROVIDERS[providerIndex].name}`}
			aria-live="polite"
		>
			<span
				className="inline-flex"
				style={{
					gap: "0.03em",
					lineHeight: 1,
				}}
			>
				{Array.from({ length: MAX_LENGTH }, (_, i) => {
					const char = name[i];
					const displayChar = char.trim() === "" ? "\u00A0" : char;
					const staggerDelay = `${(i / MAX_LENGTH) * 0.5}s`;

					return (
						<span
							key={`${i}-${char}`}
							className="flip-char"
							data-char={displayChar}
							aria-hidden="true"
							style={
								{
									"--flip-delay": staggerDelay,
								} as React.CSSProperties
							}
						>
							{displayChar}
						</span>
					);
				})}
			</span>
		</span>
	);
}
