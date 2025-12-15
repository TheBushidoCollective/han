interface CodeBlockProps {
	children: string;
	language?: string;
	filename?: string;
}

export function CodeBlock({
	children,
	language = "text",
	filename,
}: CodeBlockProps) {
	return (
		<div className="my-4">
			{filename && (
				<div className="inline-flex items-center gap-2 px-3 py-1 rounded-t-md bg-gray-800 text-xs font-mono text-gray-400">
					{filename}
					{language !== "text" && (
						<span className="text-gray-600 uppercase text-[10px]">
							{language}
						</span>
					)}
				</div>
			)}
			<div
				className={`bg-gray-900 ${filename ? "rounded-tr-lg rounded-b-lg" : "rounded-lg"}`}
			>
				<pre className="p-3 overflow-x-auto">
					<code className={`language-${language} text-sm text-gray-300`}>
						{children}
					</code>
				</pre>
			</div>
		</div>
	);
}
