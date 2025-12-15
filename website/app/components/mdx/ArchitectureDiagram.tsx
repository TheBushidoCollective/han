export function ArchitectureDiagram() {
	const layers = [
		{
			number: 1,
			title: "Rules",
			path: ".claude/rules/",
			description: "Project conventions and patterns",
			speed: "Instant",
		},
		{
			number: 2,
			title: "Session Summaries",
			path: "~/.claude/han/memory/",
			description: "AI-generated work overviews",
			speed: "Fast",
		},
		{
			number: 3,
			title: "Observations",
			path: "JSONL logs",
			description: "Detailed breadcrumbs of tool usage",
			speed: "Indexed",
		},
		{
			number: 4,
			title: "Transcripts",
			path: "Conversation history",
			description: "The reasoning behind decisions",
			speed: "Searchable",
		},
		{
			number: 5,
			title: "Team Memory",
			path: "Git history",
			description: "Institutional knowledge from commits",
			speed: "Research",
		},
	];

	return (
		<div className="my-6">
			<div className="text-center mb-4">
				<div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
					Five-Layer Memory Architecture
				</div>
			</div>

			<div className="space-y-1">
				{layers.map((layer) => (
					<div
						key={layer.number}
						className="flex items-center gap-3 p-3 rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
					>
						<div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
							{layer.number}
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<span className="font-medium text-gray-900 dark:text-gray-100">
									{layer.title}
								</span>
								<span className="text-xs text-gray-500 font-mono">
									{layer.path}
								</span>
							</div>
							<div className="text-sm text-gray-600 dark:text-gray-400">
								{layer.description}
							</div>
						</div>
						<div className="text-xs text-gray-500 dark:text-gray-500">
							{layer.speed}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
