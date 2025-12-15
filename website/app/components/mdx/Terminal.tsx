import type React from "react";

interface TerminalProps {
	children: React.ReactNode;
	title?: string;
}

export function Terminal({ children, title = "Terminal" }: TerminalProps) {
	return (
		<div className="my-4 rounded-lg overflow-hidden bg-gray-900 border border-gray-700">
			<div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-b border-gray-700">
				<div className="flex gap-1.5">
					<div className="w-2.5 h-2.5 rounded-full bg-red-500" />
					<div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
					<div className="w-2.5 h-2.5 rounded-full bg-green-500" />
				</div>
				<span className="text-xs text-gray-400">{title}</span>
			</div>
			<div className="p-3 font-mono text-sm text-gray-300 overflow-x-auto">
				{children}
			</div>
		</div>
	);
}
