"use client";

import { useState } from "react";

export default function InstallationTabs({
	pluginName,
}: {
	pluginName: string;
}) {
	const [activeTab, setActiveTab] = useState<
		"curl" | "homebrew" | "claude" | "config"
	>("curl");

	return (
		<div className="space-y-4">
			<div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
				<div className="flex space-x-1 min-w-max">
					<button
						type="button"
						onClick={() => setActiveTab("curl")}
						className={`px-4 py-2 font-semibold border-b-2 transition whitespace-nowrap ${
							activeTab === "curl"
								? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
								: "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
						}`}
					>
						curl (Recommended)
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

			{activeTab === "curl" && (
				<div>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						Install han binary (required for hooks to work):
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto mb-3">
						<code>curl -fsSL https://han.guru/install.sh | bash</code>
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
						Install han via Homebrew:
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

			{activeTab === "claude" && (
				<div>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						First, install han binary (required for hooks):
					</p>
					<pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto mb-3">
						<code>curl -fsSL https://han.guru/install.sh | bash</code>
					</pre>
					<p className="text-gray-600 dark:text-gray-300 mb-3">
						Add the Han marketplace to Claude Code:
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
