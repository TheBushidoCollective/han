"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PROVIDERS } from "./providers";
import SplitFlapChar from "./SplitFlapChar";

const CYCLE_INTERVAL = 3500;
const STAGGER_DELAY = 40;
const FLIP_DURATION = 300;

/** Longest provider name determines total tile count */
const MAX_LENGTH = Math.max(...PROVIDERS.map((p) => p.name.length));

/** Stable keys for each tile position */
const TILE_KEYS = Array.from({ length: MAX_LENGTH }, (_, i) => `tile-${i}`);

/** Pad name to fixed tile width */
function padName(name: string): string {
	return name.padEnd(MAX_LENGTH);
}

export default function SplitFlapBoard() {
	const [mounted, setMounted] = useState(false);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [prevIndex, setPrevIndex] = useState(0);
	const [flippingChars, setFlippingChars] = useState<Set<number>>(new Set());
	const [reducedMotion, setReducedMotion] = useState(false);
	const [iconFading, setIconFading] = useState(false);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const visibleRef = useRef(true);

	// Mounted check for SSR safety
	useEffect(() => {
		setMounted(true);

		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReducedMotion(mq.matches);
		const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	const triggerFlip = useCallback(
		(nextIndex: number) => {
			const fromName = padName(PROVIDERS[currentIndex].name);
			const toName = padName(PROVIDERS[nextIndex].name);

			if (reducedMotion) {
				// Simple crossfade for reduced motion
				setIconFading(true);
				setPrevIndex(currentIndex);
				setCurrentIndex(nextIndex);
				setTimeout(() => setIconFading(false), 300);
				return;
			}

			setPrevIndex(currentIndex);
			setIconFading(true);

			// Stagger character flips
			for (let i = 0; i < MAX_LENGTH; i++) {
				if (fromName[i] !== toName[i]) {
					setTimeout(() => {
						setFlippingChars((prev) => new Set(prev).add(i));
					}, i * STAGGER_DELAY);
				}
			}

			// After all flips complete, update state
			const totalDuration = MAX_LENGTH * STAGGER_DELAY + FLIP_DURATION + 50;
			setTimeout(() => {
				setCurrentIndex(nextIndex);
				setFlippingChars(new Set());
				setIconFading(false);
			}, totalDuration);
		},
		[currentIndex, reducedMotion],
	);

	// Cycle timer
	useEffect(() => {
		if (!mounted) return;

		timerRef.current = setInterval(() => {
			if (!visibleRef.current) return;
			const nextIndex = (currentIndex + 1) % PROVIDERS.length;
			triggerFlip(nextIndex);
		}, CYCLE_INTERVAL);

		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, [mounted, currentIndex, triggerFlip]);

	// Visibility API - pause when tab hidden
	useEffect(() => {
		const handler = () => {
			visibleRef.current = !document.hidden;
		};
		document.addEventListener("visibilitychange", handler);
		return () => document.removeEventListener("visibilitychange", handler);
	}, []);

	const currentProvider = PROVIDERS[currentIndex];
	const prevProvider = PROVIDERS[prevIndex];
	const CurrentIcon = currentProvider.icon;

	// Pre-mount: render first provider as plain text (SSR-safe)
	if (!mounted) {
		return (
			<span
				className="inline-flex items-center gap-2"
				role="img"
				aria-label={`for ${PROVIDERS[0].name}`}
			>
				<ProviderIcon
					Icon={PROVIDERS[0].icon}
					label={PROVIDERS[0].name}
					fading={false}
				/>
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

	const fromChars = padName(prevProvider.name);
	const toChars = padName(currentProvider.name);

	return (
		<span
			className="inline-flex items-center gap-2"
			role="img"
			aria-label={`for ${currentProvider.name}`}
			aria-live="polite"
		>
			<ProviderIcon
				Icon={CurrentIcon}
				label={currentProvider.name}
				fading={iconFading}
			/>
			<span
				className="inline-flex"
				style={{
					gap: "0.03em",
					lineHeight: 1,
				}}
			>
				{TILE_KEYS.map((key, i) => (
					<SplitFlapChar
						key={key}
						from={flippingChars.has(i) ? fromChars[i] : toChars[i]}
						to={toChars[i]}
						flipping={flippingChars.has(i)}
						duration={FLIP_DURATION}
					/>
				))}
			</span>
		</span>
	);
}

function ProviderIcon({
	Icon,
	label,
	fading,
}: {
	Icon: React.FC<React.SVGProps<SVGSVGElement>>;
	label: string;
	fading: boolean;
}) {
	return (
		<span
			className="inline-flex items-center"
			style={{
				width: "1.1em",
				height: "1.1em",
				transition: "opacity 200ms ease-in-out",
				opacity: fading ? 0.3 : 1,
			}}
		>
			<Icon
				width="100%"
				height="100%"
				aria-label={label}
				style={{ display: "block" }}
			/>
		</span>
	);
}
