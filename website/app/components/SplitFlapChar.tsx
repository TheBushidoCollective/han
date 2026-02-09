"use client";

interface SplitFlapCharProps {
	/** Character currently displayed (old, flipping away) */
	from: string;
	/** Character being flipped to (new) */
	to: string;
	/** Whether this tile is actively flipping */
	flipping: boolean;
	/** Animation duration in ms */
	duration?: number;
}

/**
 * Single split-flap tile. Uses a clip-path approach: the full character
 * is rendered at tile size and each half clips to the top or bottom 50%.
 * This avoids the translateY centering issues that caused character clipping.
 */
export default function SplitFlapChar({
	from,
	to,
	flipping,
	duration = 300,
}: SplitFlapCharProps) {
	const displayChar = flipping ? to : from;
	const bothSpace = from.trim() === "" && to.trim() === "";

	// When both characters are spaces, render as transparent gap
	if (bothSpace) {
		return (
			<span
				style={{
					display: "inline-block",
					width: "0.35em",
				}}
				aria-hidden="true"
			/>
		);
	}

	const tileStyle: React.CSSProperties = {
		display: "inline-block",
		position: "relative",
		width: "0.62em",
		height: "1.15em",
		fontSize: "inherit",
		fontFamily: "'Courier New', Courier, monospace",
		perspective: 300,
		verticalAlign: "baseline",
	};

	const charStyle: React.CSSProperties = {
		position: "absolute",
		inset: 0,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontWeight: 700,
		lineHeight: 1,
	};

	const topHalfClip = "inset(0 0 50% 0)";
	const bottomHalfClip = "inset(50% 0 0 0)";

	if (!flipping) {
		return (
			<span style={tileStyle} aria-hidden="true">
				{/* Top half */}
				<span
					style={{
						...charStyle,
						clipPath: topHalfClip,
						backgroundColor: "#1f2937",
						color: "#fff",
						borderRadius: "0.08em 0.08em 0 0",
					}}
				>
					{displayChar}
				</span>
				{/* Bottom half */}
				<span
					style={{
						...charStyle,
						clipPath: bottomHalfClip,
						backgroundColor: "#1f2937",
						color: "#fff",
						borderRadius: "0 0 0.08em 0.08em",
					}}
				>
					{displayChar}
				</span>
				{/* Center crease */}
				<span
					style={{
						position: "absolute",
						left: 0,
						right: 0,
						top: "50%",
						height: "1px",
						backgroundColor: "#374151",
						zIndex: 1,
					}}
				/>
			</span>
		);
	}

	const topFlapDuration = `${duration * 0.5}ms`;
	const bottomFlapDuration = `${duration * 0.5}ms`;
	const bottomFlapDelay = `${duration * 0.4}ms`;

	return (
		<span style={tileStyle} aria-hidden="true">
			{/* Static top: NEW character (revealed when top flap folds away) */}
			<span
				style={{
					...charStyle,
					clipPath: topHalfClip,
					backgroundColor: "#1f2937",
					color: "#fff",
					borderRadius: "0.08em 0.08em 0 0",
				}}
			>
				{to}
			</span>

			{/* Static bottom: OLD character */}
			<span
				style={{
					...charStyle,
					clipPath: bottomHalfClip,
					backgroundColor: "#1f2937",
					color: "#fff",
					borderRadius: "0 0 0.08em 0.08em",
				}}
			>
				{from}
			</span>

			{/* Animated top flap: OLD character, folds down */}
			<span
				className="splitflap-top-flap"
				style={{
					...charStyle,
					clipPath: topHalfClip,
					backgroundColor: "#1f2937",
					color: "#fff",
					borderRadius: "0.08em 0.08em 0 0",
					transformOrigin: "center 50%",
					animation: `splitflap-fold-top ${topFlapDuration} cubic-bezier(0.4, 0.0, 0.8, 0.4) forwards`,
					zIndex: 3,
				}}
			>
				{from}
			</span>

			{/* Animated bottom flap: NEW character, lands into place */}
			<span
				className="splitflap-bottom-flap"
				style={{
					...charStyle,
					clipPath: bottomHalfClip,
					backgroundColor: "#1f2937",
					color: "#fff",
					borderRadius: "0 0 0.08em 0.08em",
					transformOrigin: "center 50%",
					animation: `splitflap-fold-bottom ${bottomFlapDuration} cubic-bezier(0.2, 0.0, 0.4, 1.0) ${bottomFlapDelay} forwards`,
					transform: "rotateX(90deg)",
					zIndex: 3,
				}}
			>
				{to}
			</span>

			{/* Center crease */}
			<span
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: "50%",
					height: "1px",
					backgroundColor: "#374151",
					zIndex: 4,
				}}
			/>
		</span>
	);
}
