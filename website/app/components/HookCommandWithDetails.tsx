"use client";

import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import javascript from "highlight.js/lib/languages/javascript";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import "highlight.js/styles/github-dark.css";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Register languages
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);

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
	prompt?: string;
	timeout?: number;
	hanHooks?: Record<string, HanHookConfig>;
	pluginName: string;
	files?: HookFile[];
}

// Get language from file extension
function getLanguageFromPath(filePath: string): string {
	const ext = filePath.split(".").pop()?.toLowerCase() || "";
	const langMap: Record<string, string> = {
		sh: "bash",
		bash: "bash",
		js: "javascript",
		ts: "typescript",
		py: "python",
		md: "markdown",
	};
	return langMap[ext] || "plaintext";
}

// Highlighted code block component
function HighlightedCode({
	code,
	language,
	maxHeight = "max-h-96",
}: {
	code: string;
	language: string;
	maxHeight?: string;
}) {
	let highlighted: string;
	try {
		if (language && hljs.getLanguage(language)) {
			highlighted = hljs.highlight(code, { language }).value;
		} else {
			highlighted = hljs.highlightAuto(code).value;
		}
	} catch {
		highlighted = code
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	}

	return (
		<pre
			className={`bg-[#0d1117] text-gray-100 p-4 rounded overflow-x-auto text-sm scrollbar-custom ${maxHeight}`}
		>
			<code
				className={`hljs language-${language}`}
				// biome-ignore lint: safe HTML from highlight.js
				dangerouslySetInnerHTML={{ __html: highlighted }}
			/>
		</pre>
	);
}

// Extract han hook name from a command like:
// han hook run typescript build --fail-fast --cached
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

// Extract file references from a command string
function extractCommandFileReferences(
	command: string,
	files?: HookFile[],
): HookFile[] {
	if (!files || files.length === 0) return [];

	const referencedFiles: HookFile[] = [];

	// Pattern: cat "${CLAUDE_PLUGIN_ROOT}/hooks/file.md"
	const hookFileMatches = command.matchAll(
		/hooks\/([a-zA-Z0-9_-]+\.(md|sh|js))/g,
	);
	for (const match of hookFileMatches) {
		const fileName = match[1];
		const file = files.find((f) => f.path === fileName);
		if (file && !referencedFiles.some((f) => f.path === fileName)) {
			referencedFiles.push(file);
		}
	}

	// Pattern: scripts/file.sh
	const scriptMatches = command.matchAll(/scripts\/([a-zA-Z0-9_-]+\.(sh|js))/g);
	for (const match of scriptMatches) {
		const scriptPath = `scripts/${match[1]}`;
		const file = files.find((f) => f.path === scriptPath);
		if (file && !referencedFiles.some((f) => f.path === scriptPath)) {
			referencedFiles.push(file);
		}
	}

	return referencedFiles;
}

// Extract first heading from prompt for display
function extractPromptTitle(prompt: string): string {
	const match = prompt.match(/^#\s+(.+)$/m);
	return match ? match[1] : "Prompt-based Hook";
}

export default function HookCommandWithDetails({
	command,
	prompt,
	timeout,
	hanHooks,
	pluginName,
	files,
}: HookCommandWithDetailsProps) {
	const [expanded, setExpanded] = useState(false);
	const [configExpanded, setConfigExpanded] = useState(false);
	const [scriptExpanded, setScriptExpanded] = useState(false);
	const [promptExpanded, setPromptExpanded] = useState(false);

	const isPromptHook = !!prompt;
	const promptTitle = prompt ? extractPromptTitle(prompt) : "";
	const hookName = extractHanHookName(command, pluginName);
	const hookConfig = hookName && hanHooks ? hanHooks[hookName] : null;
	const referencedFiles = findReferencedFiles(hookConfig, files);
	const commandReferencedFiles = extractCommandFileReferences(command, files);

	return (
		<div className="relative">
			{isPromptHook ? (
				<div>
					<button
						type="button"
						onClick={() => setPromptExpanded(!promptExpanded)}
						className="w-full text-left"
					>
						<div className="bg-purple-900 dark:bg-purple-950 text-purple-100 p-4 rounded-t overflow-x-auto text-sm scrollbar-custom flex items-center justify-between">
							<div className="flex-1 flex items-center gap-3">
								<span className="text-lg">🧠</span>
								<code className="flex-1">{promptTitle}</code>
							</div>
							<div className="flex items-center gap-2 ml-4">
								{timeout && (
									<span className="px-2 py-1 text-xs bg-purple-700 text-purple-200 rounded">
										⏱️ {timeout >= 60 ? `${timeout / 60}m` : `${timeout}s`}
									</span>
								)}
								<span className="px-2 py-1 text-xs bg-purple-600 text-purple-100 rounded flex items-center gap-1">
									<span>Prompt Hook</span>
									<svg
										aria-hidden="true"
										className={`w-3 h-3 transition-transform ${promptExpanded ? "rotate-180" : ""}`}
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
					{promptExpanded && (
						<div className="bg-gray-800 dark:bg-gray-900 border-t border-gray-700 rounded-b p-4 space-y-4">
							{/* Prompt Content */}
							<div>
								<h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
									<span>🧠</span>
									<span>Evaluation Prompt</span>
								</h4>
								<div className="bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto text-sm scrollbar-custom max-h-96 prose dark:prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:mb-2 prose-headings:mt-4 prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700 prose-code:text-purple-300 prose-strong:text-purple-200 prose-headings:text-gray-200">
									<ReactMarkdown remarkPlugins={[remarkGfm]}>
										{prompt}
									</ReactMarkdown>
								</div>
							</div>

							{/* How it works */}
							<div className="border-t border-gray-700 pt-4">
								<h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
									<span>ℹ️</span>
									<span>How Prompt-based Hooks Work</span>
								</h4>
								<div className="text-sm text-gray-400 space-y-2">
									<p>
										This hook uses an LLM to evaluate Claude's work against the
										criteria defined in the prompt above.
									</p>
									<p>The LLM will:</p>
									<ul className="list-disc list-inside space-y-1 ml-2">
										<li>
											Analyze the conversation context and Claude's response
										</li>
										<li>
											Check compliance with the principles in the evaluation
											prompt
										</li>
										<li>
											Return{" "}
											<code className="bg-gray-700 px-1 rounded">
												decision: "approve"
											</code>{" "}
											or{" "}
											<code className="bg-gray-700 px-1 rounded">
												decision: "block"
											</code>
										</li>
										<li>
											Provide a{" "}
											<code className="bg-gray-700 px-1 rounded">
												systemMessage
											</code>{" "}
											with feedback
										</li>
									</ul>
								</div>
							</div>
						</div>
					)}
				</div>
			) : hookConfig ? (
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
									⏱️ {timeout >= 60 ? `${timeout / 60}m` : `${timeout}s`}
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
			) : commandReferencedFiles.length > 0 ? (
				<div>
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
										⏱️ {timeout >= 60 ? `${timeout / 60}m` : `${timeout}s`}
									</span>
								)}
								<span className="px-2 py-1 text-xs bg-gray-600 text-gray-100 rounded flex items-center gap-1">
									<span>
										{commandReferencedFiles.length}{" "}
										{commandReferencedFiles.length === 1 ? "file" : "files"}
									</span>
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
					{expanded && (
						<div className="bg-gray-800 dark:bg-gray-900 border-t border-gray-700 rounded-b p-4 space-y-4">
							{/* Referenced Files */}
							{commandReferencedFiles.map((file) => (
								<div key={file.path}>
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											setScriptExpanded(!scriptExpanded);
										}}
										className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-gray-100 transition"
									>
										<span>📄</span>
										<span>Referenced File</span>
										<code className="text-xs text-gray-400 font-normal">
											{file.path}
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
										<div className="mt-2">
											<HighlightedCode
												code={file.content}
												language={getLanguageFromPath(file.path)}
											/>
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			) : (
				<div className="relative">
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto text-sm scrollbar-custom">
						<code>{command}</code>
					</pre>
					{timeout && (
						<span className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
							⏱️ {timeout >= 60 ? `${timeout / 60}m` : `${timeout}s`}
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
								<div className="mt-2">
									<HighlightedCode
										code={referencedFiles[0].content}
										language={getLanguageFromPath(referencedFiles[0].path)}
									/>
								</div>
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
