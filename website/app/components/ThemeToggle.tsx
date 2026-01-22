"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
	const [mounted, setMounted] = useState(false);
	const { theme, setTheme, resolvedTheme } = useTheme();

	// useEffect only runs on the client, so now we can safely show the UI
	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return null;
	}

	const cycleTheme = () => {
		if (theme === "light") {
			setTheme("dark");
		} else if (theme === "dark") {
			setTheme("system");
		} else {
			setTheme("light");
		}
	};

	const getIcon = () => {
		if (theme === "system") {
			return "💻";
		}
		return resolvedTheme === "dark" ? "🌙" : "☀️";
	};

	const getTitle = () => {
		if (theme === "system") {
			return "Theme: System";
		}
		return theme === "dark" ? "Theme: Dark" : "Theme: Light";
	};

	return (
		<button
			type="button"
			onClick={cycleTheme}
			className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition p-1"
			title={getTitle()}
			aria-label={getTitle()}
		>
			<span className="text-xl">{getIcon()}</span>
		</button>
	);
}
