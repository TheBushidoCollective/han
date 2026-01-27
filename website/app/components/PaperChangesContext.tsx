"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useState,
} from "react";

/**
 * Strip YAML frontmatter from markdown content
 * Frontmatter is delimited by --- at the start and end
 */
function stripFrontmatter(content: string): string {
	// Check if content starts with frontmatter delimiter
	if (!content.startsWith("---")) {
		return content;
	}

	// Find the closing delimiter (second ---)
	const endIndex = content.indexOf("\n---", 3);
	if (endIndex === -1) {
		return content;
	}

	// Return content after the closing delimiter
	return content.slice(endIndex + 4).trimStart();
}

interface SectionChange {
	section: string;
	originalSection?: string;
	isNew: boolean;
	isRemoved?: boolean;
	renamedFrom?: string;
	linesAdded: number;
	linesRemoved: number;
}

interface PaperChangesContextType {
	sectionChanges: SectionChange[];
	// Compare functionality
	compareVersion: string | null;
	setCompareVersion: (version: string | null) => void;
	compareContent: string | null;
	isLoadingCompare: boolean;
	loadCompareContent: (
		slug: string,
		fullCommitHash: string,
		version: string,
	) => Promise<void>;
}

const PaperChangesContext = createContext<PaperChangesContextType | null>(null);

export function PaperChangesProvider({
	children,
	sectionChanges,
}: {
	children: ReactNode;
	sectionChanges: SectionChange[];
}) {
	const [compareVersion, setCompareVersion] = useState<string | null>(null);
	const [compareContent, setCompareContent] = useState<string | null>(null);
	const [isLoadingCompare, setIsLoadingCompare] = useState(false);

	const loadCompareContent = useCallback(
		async (paperSlug: string, fullCommitHash: string, version: string) => {
			setIsLoadingCompare(true);
			setCompareVersion(version);

			try {
				// Fetch content from GitHub raw
				const url = `https://raw.githubusercontent.com/TheBushidoCollective/han/${fullCommitHash}/website/content/papers/${paperSlug}.md`;
				const response = await fetch(url);

				if (response.ok) {
					const rawContent = await response.text();
					// Strip frontmatter to match the processed current content
					setCompareContent(stripFrontmatter(rawContent));
				} else {
					console.error("Failed to fetch compare content:", response.status);
					setCompareContent(null);
				}
			} catch (error) {
				console.error("Error fetching compare content:", error);
				setCompareContent(null);
			} finally {
				setIsLoadingCompare(false);
			}
		},
		[],
	);

	const handleSetCompareVersion = useCallback((version: string | null) => {
		if (version === null) {
			setCompareVersion(null);
			setCompareContent(null);
		} else {
			setCompareVersion(version);
		}
	}, []);

	return (
		<PaperChangesContext.Provider
			value={{
				sectionChanges,
				compareVersion,
				setCompareVersion: handleSetCompareVersion,
				compareContent,
				isLoadingCompare,
				loadCompareContent,
			}}
		>
			{children}
		</PaperChangesContext.Provider>
	);
}

export function usePaperChanges() {
	const context = useContext(PaperChangesContext);
	if (!context) {
		return {
			sectionChanges: [],
			compareVersion: null,
			setCompareVersion: () => {},
			compareContent: null,
			isLoadingCompare: false,
			loadCompareContent: async () => {},
		};
	}
	return context;
}
