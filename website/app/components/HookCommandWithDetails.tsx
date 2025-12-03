"use client";

import { useState } from "react";

interface HanHookConfig {
	command?: string;
	dirsWith?: string[];
	testDir?: string;
	ifChanged?: string[];
}

interface HookFile {
	name: string;
	path: string;
	content: string;
}

interface HookCommandWithDetailsProps {
	command: string;
	timeout?: number;
	hanHooks?: Record<string, HanHookConfig>;
	pluginName: string;
	files?: HookFile[];
}

// Extract han hook name from a command like:
// npx -y @thebushidocollective/han hook run jutsu-ios ios-build --fail-fast --cached
function extractHanHookName(
	command: string,
	pluginName: string,
): string | null {
	const regex = new RegExp(
		`han\\s+hook\\s+run\\s+${pluginName}\\s+([\\w-]+)`,
		"i",
	);
	const match = command.match(regex);
	return match ? match[1] : null;
}

// Find files referenced in the hookConfig command
function findReferencedFiles(
	hookConfig: HanHookConfig | null,
	files?: HookFile[],
): HookFile[] {
	if (!hookConfig?.command || !files || files.length === 0) return [];
	return files.filter((file) => hookConfig.command?.includes(file.path));
}

export default function HookCommandWithDetails({
	command,
	timeout,
	hanHooks,
	pluginName,
	files,
}: HookCommandWithDetailsProps) {
	const [expanded, setExpanded] = useState(false);
	const [configExpanded, setConfigExpanded] = useState(false);
	const [scriptExpanded, setScriptExpanded] = useState(false);

	const hookName = extractHanHookName(command, pluginName);
	const hookConfig = hookName && hanHooks ? hanHooks[hookName] : null;
	const referencedFiles = findReferencedFiles(hookConfig, files);

	return (
		<div className="relative">
			{hookConfig ? (
				<button
					type="button"
					onClick={() => setExpanded(!expanded)}
					className="w-full text-left"
				>
					<div className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-t overflow-x-auto text-sm scrollbar-custom flex items-center justify-between">
						<code className="flex-1">{command}</code>
						<div className="flex items-center gap-2 ml-4">
							{timeout && (
								<span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
									⏱️{" "}
									{timeout >= 60000
										? `${timeout / 60000}m`
										: `${timeout / 1000}s`}
								</span>
							)}
							<span className="px-2 py-1 text-xs bg-blue-600 text-blue-100 rounded flex items-center gap-1">
								<span>⚡</span>
								<span>{hookName}</span>
								<svg
									aria-hidden="true"
									className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							</span>
						</div>
					</div>
				</button>
			) : (
				<div className="relative">
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto text-sm scrollbar-custom">
						<code>{command}</code>
					</pre>
					{timeout && (
						<span className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
							⏱️{" "}
							{timeout >= 60000 ? `${timeout / 60000}m` : `${timeout / 1000}s`}
						</span>
					)}
				</div>
			)}

			{expanded && hookConfig && (
				<div className="bg-gray-800 dark:bg-gray-900 border-t border-gray-700 rounded-b p-4 space-y-4">
					{/* Command */}
					{hookConfig.command && (
						<div>
							<h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
								<span>💻</span>
								<span>Executes</span>
							</h4>
							<pre className="bg-gray-950 text-gray-100 p-3 rounded overflow-x-auto text-sm scrollbar-custom">
								<code>{hookConfig.command}</code>
							</pre>
						</div>
					)}

					{/* Referenced Script Files */}
					{referencedFiles.length > 0 && (
						<div>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setScriptExpanded(!scriptExpanded);
								}}
								className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-gray-100 transition"
							>
								<span>📄</span>
								<span>Script Source</span>
								<code className="text-xs text-gray-400 font-normal">
									{referencedFiles[0].path}
								</code>
								<svg
									aria-hidden="true"
									className={`w-3 h-3 transition-transform ${scriptExpanded ? "rotate-180" : ""}`}
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							</button>
							{scriptExpanded && (
								<pre className="mt-2 bg-gray-950 text-gray-100 p-3 rounded overflow-x-auto text-xs scrollbar-custom max-h-96">
									<code>{referencedFiles[0].content}</code>
								</pre>
							)}
						</div>
					)}

					{/* dirsWith */}
					{hookConfig.dirsWith && hookConfig.dirsWith.length > 0 && (
						<div>
							<h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
								<span>📁</span>
								<span>Active in directories containing</span>
							</h4>
							<div className="flex flex-wrap gap-2">
								{hookConfig.dirsWith.map((pattern) => (
									<code
										key={pattern}
										className="px-2 py-1 bg-blue-900 text-blue-200 rounded text-sm font-mono"
									>
										{pattern}
									</code>
								))}
							</div>
						</div>
					)}

					{/* testDir */}
					{hookConfig.testDir && (
						<div>
							<h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
								<span>🧪</span>
								<span>Directory validation</span>
							</h4>
							<pre className="bg-gray-950 text-gray-100 p-3 rounded overflow-x-auto text-sm scrollbar-custom">
								<code>{hookConfig.testDir}</code>
							</pre>
						</div>
					)}

					{/* ifChanged */}
					{hookConfig.ifChanged && hookConfig.ifChanged.length > 0 && (
						<div>
							<h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
								<span>👀</span>
								<span>
									Triggers on changes to ({hookConfig.ifChanged.length}{" "}
									patterns)
								</span>
							</h4>
							<div className="bg-gray-950 p-3 rounded overflow-x-auto max-h-32 scrollbar-custom">
								<div className="flex flex-wrap gap-2">
									{hookConfig.ifChanged.map((pattern) => (
										<code
											key={pattern}
											className="px-2 py-1 bg-gray-700 text-gray-200 rounded text-xs font-mono"
										>
											{pattern}
										</code>
									))}
								</div>
							</div>
						</div>
					)}

					{/* Configuration Override */}
					<div className="border-t border-gray-700 pt-4">
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								setConfigExpanded(!configExpanded);
							}}
							className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-gray-200 transition"
						>
							<span>⚙️</span>
							<span>Override Configuration</span>
							<svg
								aria-hidden="true"
								className={`w-3 h-3 transition-transform ${configExpanded ? "rotate-180" : ""}`}
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						</button>

						{configExpanded && hookName && (
							<div className="mt-3 space-y-3">
								<p className="text-xs text-gray-400">
									Add to{" "}
									<code className="bg-gray-700 px-1 rounded">
										han-config.yml
									</code>{" "}
									in your project:
								</p>
								<pre className="bg-gray-950 text-gray-100 p-3 rounded overflow-x-auto text-xs scrollbar-custom">
									<code>{`${pluginName}:
  ${hookName}:
    # enabled: false  # Disable this hook
    # command: "${hookConfig.command || ""}"
${
	hookConfig.ifChanged
		? `    # if_changed:
${hookConfig.ifChanged
	.slice(0, 3)
	.map((p) => `    #   - "${p}"`)
	.join("\n")}
    #   # ... add more patterns`
		: ""
}`}</code>
								</pre>
								<ul className="text-xs text-gray-400 space-y-1">
									<li>
										<code className="bg-gray-700 px-1 rounded">enabled</code> —
										Set to{" "}
										<code className="bg-gray-700 px-1 rounded">false</code> to
										disable
									</li>
									<li>
										<code className="bg-gray-700 px-1 rounded">command</code> —
										Override the command
									</li>
									<li>
										<code className="bg-gray-700 px-1 rounded">if_changed</code>{" "}
										— Override file patterns
									</li>
								</ul>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
