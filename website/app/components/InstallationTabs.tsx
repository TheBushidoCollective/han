"use client";

import { useState } from "react";

export default function InstallationTabs({
	pluginName,
}: {
	pluginName: string;
}) {
	const [activeTab, setActiveTab] = useState<
		"npx" | "claude" | "cli" | "config"
	>("npx");

	return (
		<div className="space-y-4">
			<div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
				<div className="flex space-x-1 min-w-max">
					<button
						type="button"
						onClick={() => setActiveTab("npx")}
						className={`px-4 py-2 font-semibold border-b-2 transition whitespace-nowrap ${
							activeTab === "npx"
								? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
								: "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
						}`}
					>
						npx
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("claude")}
						className={`px-4 py-2 font-semibold border-b-2 transition whitespace-nowrap ${
							activeTab === "claude"
								? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
								: "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
						}`}
					>
						Claude Code
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

			{activeTab === "npx" && (
				<div>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						Install this plugin with npx (no installation required):
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto">
						<code>
							npx @thebushidocollective/han plugin install {pluginName}
						</code>
					</pre>
				</div>
			)}

			{activeTab === "claude" && (
				<div>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						First, add the Han marketplace to Claude Code:
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto mb-3">
						<code>/marketplace add han</code>
					</pre>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						Then install this plugin:
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto">
						<code>/plugin install {pluginName}@han</code>
					</pre>
				</div>
			)}

			{activeTab === "cli" && (
				<div>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						First, add the Han marketplace:
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto mb-3">
						<code>claude marketplace add han</code>
					</pre>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						Then install this plugin:
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto">
						<code>claude plugin install {pluginName}@han</code>
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
