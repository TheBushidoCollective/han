import type { FC, SVGProps } from "react";

export interface Provider {
	name: string;
	icon: FC<SVGProps<SVGSVGElement>>;
}

/** Claude Code - Anthropic's sparkle icon */
function ClaudeCodeIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="currentColor"
			role="img"
			aria-label="Claude Code"
			{...props}
		>
			<path d="M4.709 15.955l4.397-10.985c.2-.5.907-.5 1.107 0l4.397 10.985c.145.363-.19.738-.56.626L10.32 15.28a.75.75 0 00-.64 0L5.27 16.581c-.37.112-.706-.263-.56-.626z" />
			<path
				d="M14.669 8.478l3.478-3.478c.354-.354.956-.104.956.396v7.803c0 .5-.602.75-.956.396l-3.478-3.478a.875.875 0 010-1.238l.4.4-.4-.4z"
				opacity="0.5"
			/>
		</svg>
	);
}

/** OpenCode - terminal prompt icon */
function OpenCodeIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			role="img"
			aria-label="OpenCode"
			{...props}
		>
			<polyline points="4 17 10 11 4 5" />
			<line x1="12" y1="19" x2="20" y2="19" />
		</svg>
	);
}

export const PROVIDERS: Provider[] = [
	{ name: "Claude Code", icon: ClaudeCodeIcon },
	{ name: "OpenCode", icon: OpenCodeIcon },
];
