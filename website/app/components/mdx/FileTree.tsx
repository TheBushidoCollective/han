"use client";

import type React from "react";
import { useState } from "react";

interface TreeNode {
	name: string;
	type: "file" | "folder";
	children?: TreeNode[];
	comment?: string;
	gitTracked?: boolean;
}

interface FileTreeProps {
	data: TreeNode[];
	title?: string;
}

interface TreeItemProps {
	node: TreeNode;
	depth: number;
}

function TreeItem({ node, depth }: TreeItemProps) {
	const [isOpen, setIsOpen] = useState(true);
	const isFolder = node.type === "folder";

	const indentStyle = {
		paddingLeft: `${depth * 1.25}rem`,
	};

	const handleToggle = () => {
		if (isFolder) {
			setIsOpen(!isOpen);
		}
	};

	return (
		<div>
			<div
				className={`flex items-center gap-2 py-1.5 px-2 rounded ${
					isFolder
						? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
						: "hover:bg-gray-50 dark:hover:bg-gray-800/50"
				}`}
				style={indentStyle}
				{...(isFolder
					? {
							onClick: handleToggle,
							onKeyDown: (e: React.KeyboardEvent) => {
								if (e.key === "Enter" || e.key === " ") {
									handleToggle();
								}
							},
							role: "button",
							tabIndex: 0,
						}
					: {})}
			>
				{/* Expand/collapse indicator */}
				{isFolder && (
					<span className="text-gray-500 dark:text-gray-400 w-4 text-center text-xs">
						{isOpen ? "▼" : "▶"}
					</span>
				)}
				{!isFolder && <span className="w-4" />}

				{/* Icon */}
				<span className="text-sm">
					{isFolder ? (isOpen ? "📂" : "📁") : "📄"}
				</span>

				{/* Name */}
				<span
					className={`font-mono text-sm ${
						isFolder
							? "font-medium text-gray-900 dark:text-gray-100"
							: "text-gray-700 dark:text-gray-300"
					}`}
				>
					{node.name}
				</span>

				{/* Git tracked badge */}
				{node.gitTracked && (
					<span className="px-1.5 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
						git
					</span>
				)}

				{/* Comment */}
				{node.comment && (
					<span className="text-xs text-gray-500 dark:text-gray-400 italic ml-2">
						{node.comment}
					</span>
				)}
			</div>

			{/* Children */}
			{isFolder && isOpen && node.children && (
				<div>
					{node.children.map((child, index) => (
						<TreeItem
							key={`${child.name}-${index}`}
							node={child}
							depth={depth + 1}
						/>
					))}
				</div>
			)}
		</div>
	);
}

export function FileTree({ data, title = "File Structure" }: FileTreeProps) {
	return (
		<div className="my-4 rounded-lg overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
			{/* Header */}
			<div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
				<span>📁</span>
				<span className="text-sm font-medium text-gray-900 dark:text-gray-100">
					{title}
				</span>
			</div>

			{/* Tree content */}
			<div className="p-3 font-mono text-sm overflow-x-auto">
				{data.map((node, index) => (
					<TreeItem key={`${node.name}-${index}`} node={node} depth={0} />
				))}
			</div>
		</div>
	);
}

// Helper function to create the memory storage structure
export function MemoryStorageTree() {
	const treeData: TreeNode[] = [
		{
			name: "~/.claude/",
			type: "folder",
			children: [
				{
					name: "han/",
					type: "folder",
					children: [
						{
							name: "memory/",
							type: "folder",
							children: [
								{
									name: "personal/",
									type: "folder",
									children: [
										{
											name: "sessions/",
											type: "folder",
											comment: "Layer 3: Raw observations (JSONL)",
										},
										{
											name: "summaries/",
											type: "folder",
											comment: "Layer 2: AI summaries (YAML)",
										},
									],
								},
								{
									name: "index/",
									type: "folder",
									children: [
										{
											name: "fts.db",
											type: "file",
											comment: "FTS index (LanceDB/SQLite)",
										},
									],
								},
								{
									name: "projects/",
									type: "folder",
									children: [
										{
											name: "github.com_org_repo/",
											type: "folder",
											children: [
												{
													name: "meta.yaml",
													type: "file",
													comment: "Team memory metadata",
												},
											],
										},
									],
								},
							],
						},
					],
				},
				{
					name: "projects/",
					type: "folder",
					children: [
						{
							name: "{project-slug}/",
							type: "folder",
							comment: "Layer 4: Claude transcripts (JSONL)",
							children: [
								{
									name: "*.jsonl",
									type: "file",
								},
							],
						},
					],
				},
			],
		},
		{
			name: ".claude/",
			type: "folder",
			gitTracked: true,
			comment: "In project repo (git-tracked)",
			children: [
				{
					name: "rules/",
					type: "folder",
					gitTracked: true,
					comment: "Layer 1: Permanent rules",
					children: [
						{
							name: "testing.md",
							type: "file",
							gitTracked: true,
						},
						{
							name: "api.md",
							type: "file",
							gitTracked: true,
						},
					],
				},
			],
		},
	];

	return <FileTree data={treeData} title="Memory Storage Structure" />;
}
