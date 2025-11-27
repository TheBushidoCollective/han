"use client";

import { useState } from "react";

export default function InstallationTabs({
	pluginName,
}: {
	pluginName: string;
}) {
	const [activeTab, setActiveTab] = useState<
		"quick" | "homebrew" | "npm" | "cli" | "within-claude" | "config"
	>("quick");

	return (
		<div className="space-y-4">
			<div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
				<div className="flex space-x-1 min-w-max">
					<button
						type="button"
						onClick={() => setActiveTab("quick")}
						className={`px-4 py-2 font-semibold border-b-2 transition whitespace-nowrap ${
							activeTab === "quick"
								? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
								: "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
						}`}
					>
						Quick Install
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("homebrew")}
						className={`px-4 py-2 font-semibold border-b-2 transition whitespace-nowrap ${
							activeTab === "homebrew"
								? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
								: "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
						}`}
					>
						Homebrew
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("npm")}
						className={`px-4 py-2 font-semibold border-b-2 transition whitespace-nowrap ${
							activeTab === "npm"
								? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
								: "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
						}`}
					>
						npm
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("cli")}
						className={`px-4 py-2 font-semibold border-b-2 transition whitespace-nowrap ${
							activeTab === "cli"
								? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
								: "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
						}`}
					>
						Claude CLI
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("within-claude")}
						className={`px-4 py-2 font-semibold border-b-2 transition whitespace-nowrap ${
							activeTab === "within-claude"
								? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
								: "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
						}`}
					>
						In Claude
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("config")}
						className={`px-4 py-2 font-semibold border-b-2 transition whitespace-nowrap ${
							activeTab === "config"
								? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
								: "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
						}`}
					>
						Manual
					</button>
				</div>
			</div>

			{activeTab === "quick" && (
				<div>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						Install the Han CLI with a single command:
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto mb-3">
						<code>curl -fsSL https://han.guru/install.sh | sh</code>
					</pre>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						Then install this plugin:
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto">
						<code>han plugin install {pluginName}</code>
					</pre>
				</div>
			)}

			{activeTab === "homebrew" && (
				<div>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						Install via Homebrew (macOS &amp; Linux):
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto mb-3">
						<code>brew install thebushidocollective/tap/han</code>
					</pre>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						Then install this plugin:
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto">
						<code>han plugin install {pluginName}</code>
					</pre>
				</div>
			)}

			{activeTab === "npm" && (
				<div>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						Install the Han CLI via npm:
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto mb-3">
						<code>npm install -g @thebushidocollective/han</code>
					</pre>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						Then install this plugin:
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto">
						<code>han plugin install {pluginName}</code>
					</pre>
				</div>
			)}

			{activeTab === "cli" && (
				<div>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						From the command line with Claude CLI:
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto">
						<code>claude plugin install {pluginName}@han</code>
					</pre>
				</div>
			)}

			{activeTab === "within-claude" && (
				<div>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						From within a Claude Code session:
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto">
						<code>/plugin install {pluginName}@han</code>
					</pre>
				</div>
			)}

			{activeTab === "config" && (
				<div>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						Add to your Claude Code configuration file:
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto">
						<code>{`{
  "enabledPlugins": {
    "${pluginName}@han": true
  }
}`}</code>
					</pre>
				</div>
			)}
		</div>
	);
}
