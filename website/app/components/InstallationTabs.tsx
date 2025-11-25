"use client";

import { useState } from "react";

export default function InstallationTabs({
  pluginName,
}: {
  pluginName: string;
}) {
  const [activeTab, setActiveTab] = useState<
    "npm" | "cli" | "within-claude" | "config"
  >("npm");

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab("npm")}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
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
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === "cli"
                ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            CLI
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("within-claude")}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === "within-claude"
                ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Within Claude
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("config")}
            className={`px-4 py-2 font-semibold border-b-2 transition ${
              activeTab === "config"
                ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Config File
          </button>
        </div>
      </div>

      {activeTab === "npm" && (
        <div>
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            First, install the Han CLI tool:
          </p>
          <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto mb-3">
            <code>npm install -g @thebushidocollective/han</code>
          </pre>
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            Then install the plugin:
          </p>
          <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto">
            <code>han plugin install {pluginName}</code>
          </pre>
        </div>
      )}

      {activeTab === "cli" && (
        <div>
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            From the command line:
          </p>
          <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto">
            <code>claude plugin install {pluginName}@han</code>
          </pre>
        </div>
      )}

      {activeTab === "within-claude" && (
        <div>
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            From within Claude Code:
          </p>
          <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded overflow-x-auto">
            <code>/plugin install {pluginName}@han</code>
          </pre>
        </div>
      )}

      {activeTab === "config" && (
        <div>
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            Add to your Claude Code configuration:
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
