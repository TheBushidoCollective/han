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

/**
 * Per-tile state: each character position tracks what it currently shows
 * and whether it's mid-flip. This lets tiles settle individually rather
 * than all snapping at once.
 */
interface TileState {
	char: string;
	flipping: boolean;
	fromChar: string;
}

function createInitialTiles(providerIndex: number): TileState[] {
	const name = padName(PROVIDERS[providerIndex].name);
	return Array.from({ length: MAX_LENGTH }, (_, i) => ({
		char: name[i],
		flipping: false,
		fromChar: name[i],
	}));
}

export default function SplitFlapBoard() {
	const [mounted, setMounted] = useState(false);
	const [providerIndex, setProviderIndex] = useState(0);
	const [tiles, setTiles] = useState<TileState[]>(() => createInitialTiles(0));
	const [reducedMotion, setReducedMotion] = useState(false);
	const [iconFading, setIconFading] = useState(false);
	const visibleRef = useRef(true);
	const flippingRef = useRef(false);

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
			if (flippingRef.current) return;
			flippingRef.current = true;

			const toName = padName(PROVIDERS[nextIndex].name);

			if (reducedMotion) {
				setIconFading(true);
				setTiles(createInitialTiles(nextIndex));
				setProviderIndex(nextIndex);
				setTimeout(() => {
					setIconFading(false);
					flippingRef.current = false;
				}, 300);
				return;
			}

			setIconFading(true);

			// Kick off staggered flips: each tile starts its flip animation
			// at a different time, then settles individually when done
			setTiles((prev) =>
				prev.map((tile, i) => {
					if (tile.char === toName[i]) return tile;
					return { char: toName[i], flipping: false, fromChar: tile.char };
				}),
			);

			for (let i = 0; i < MAX_LENGTH; i++) {
				const delay = i * STAGGER_DELAY;

				// Start this tile's flip
				setTimeout(() => {
					setTiles((prev) =>
						prev.map((tile, j) =>
							j === i && tile.fromChar !== tile.char
								? { ...tile, flipping: true }
								: tile,
						),
					);
				}, delay);

				// Settle this tile after its animation completes
				setTimeout(() => {
					setTiles((prev) =>
						prev.map((tile, j) =>
							j === i ? { ...tile, flipping: false } : tile,
						),
					);
				}, delay + FLIP_DURATION);
			}

			// After all tiles have settled, update provider index and icon
			const totalDuration = MAX_LENGTH * STAGGER_DELAY + FLIP_DURATION + 50;
			setTimeout(() => {
				setProviderIndex(nextIndex);
				setIconFading(false);
				flippingRef.current = false;
			}, totalDuration);
		},
		[reducedMotion],
	);

	// Cycle timer
	useEffect(() => {
		if (!mounted) return;

		const timer = setInterval(() => {
			if (!visibleRef.current || flippingRef.current) return;
			setProviderIndex((prev) => {
				const nextIndex = (prev + 1) % PROVIDERS.length;
				triggerFlip(nextIndex);
				return prev; // Don't update here - triggerFlip handles it
			});
		}, CYCLE_INTERVAL);

		return () => clearInterval(timer);
	}, [mounted, triggerFlip]);

	// Visibility API
	useEffect(() => {
		const handler = () => {
			visibleRef.current = !document.hidden;
		};
		document.addEventListener("visibilitychange", handler);
		return () => document.removeEventListener("visibilitychange", handler);
	}, []);

	const currentProvider = PROVIDERS[providerIndex];
	const CurrentIcon = currentProvider.icon;

	// SSR-safe: render first provider as plain text
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
				{TILE_KEYS.map((key, i) => {
					const tile = tiles[i];
					return (
						<SplitFlapChar
							key={key}
							from={tile.fromChar}
							to={tile.char}
							flipping={tile.flipping}
							duration={FLIP_DURATION}
						/>
					);
				})}
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
