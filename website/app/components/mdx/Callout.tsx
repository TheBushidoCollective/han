import type React from "react";

export type CalloutType = "tip" | "warning" | "info" | "note";

interface CalloutProps {
	type?: CalloutType;
	children: React.ReactNode;
	title?: string;
}

const styles: Record<
	CalloutType,
	{ bg: string; border: string; text: string }
> = {
	tip: {
		bg: "bg-green-50 dark:bg-green-950/30",
		border: "border-green-300 dark:border-green-800",
		text: "text-green-800 dark:text-green-300",
	},
	warning: {
		bg: "bg-yellow-50 dark:bg-yellow-950/30",
		border: "border-yellow-300 dark:border-yellow-800",
		text: "text-yellow-800 dark:text-yellow-300",
	},
	info: {
		bg: "bg-blue-50 dark:bg-blue-950/30",
		border: "border-blue-300 dark:border-blue-800",
		text: "text-blue-800 dark:text-blue-300",
	},
	note: {
		bg: "bg-gray-50 dark:bg-gray-800/50",
		border: "border-gray-300 dark:border-gray-700",
		text: "text-gray-700 dark:text-gray-300",
	},
};

export function Callout({ type = "info", children, title }: CalloutProps) {
	const s = styles[type];

	return (
		<div className={`my-4 p-3 rounded border-l-4 ${s.bg} ${s.border}`}>
			{title && (
				<div className={`font-medium text-sm mb-1 ${s.text}`}>{title}</div>
			)}
			<div className="text-sm text-gray-700 dark:text-gray-300">{children}</div>
		</div>
	);
}
