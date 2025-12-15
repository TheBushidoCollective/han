"use client";

import type React from "react";
import { useState } from "react";

interface TabsProps {
	children: React.ReactNode;
	defaultTab?: string;
}

interface TabProps {
	label: string;
	children: React.ReactNode;
}

export function Tab({ children }: TabProps) {
	return <div>{children}</div>;
}

export function Tabs({ children, defaultTab }: TabsProps) {
	const childArray = Array.isArray(children) ? children : [children];
	const tabs = childArray.filter(
		(child) => child && typeof child === "object" && "props" in child,
	);

	const [activeTab, setActiveTab] = useState(
		defaultTab || (tabs[0]?.props?.label ?? ""),
	);

	return (
		<div className="my-6 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
			<div className="flex gap-1 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-1">
				{tabs.map((tab) => {
					const label = tab.props.label;
					return (
						<button
							key={label}
							type="button"
							onClick={() => setActiveTab(label)}
							className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
								activeTab === label
									? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
									: "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
							}`}
						>
							{label}
						</button>
					);
				})}
			</div>
			<div className="p-4 bg-white dark:bg-gray-950">
				{tabs.map((tab) => {
					const label = tab.props.label;
					return (
						<div
							key={label}
							className={activeTab === label ? "block" : "hidden"}
						>
							{tab.props.children}
						</div>
					);
				})}
			</div>
		</div>
	);
}
