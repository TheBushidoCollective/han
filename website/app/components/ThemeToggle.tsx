"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
	const [mounted, setMounted] = useState(false);
	const { theme, setTheme } = useTheme();

	// useEffect only runs on the client, so now we can safely show the UI
	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return null;
	}

	return (
		<div className="fixed bottom-4 right-4 z-50 flex gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
			<button
				type="button"
				onClick={() => setTheme("light")}
				className={`px-3 py-1.5 text-sm rounded transition-colors ${
					theme === "light"
						? "bg-blue-500 text-white"
						: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
				}`}
				title="Light mode"
			>
				☀️ Light
			</button>
			<button
				type="button"
				onClick={() => setTheme("dark")}
				className={`px-3 py-1.5 text-sm rounded transition-colors ${
					theme === "dark"
						? "bg-blue-500 text-white"
						: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
				}`}
				title="Dark mode"
			>
				🌙 Dark
			</button>
			<button
				type="button"
				onClick={() => setTheme("system")}
				className={`px-3 py-1.5 text-sm rounded transition-colors ${
					theme === "system"
						? "bg-blue-500 text-white"
						: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
				}`}
				title="System preference"
			>
				💻 System
			</button>
		</div>
	);
}
