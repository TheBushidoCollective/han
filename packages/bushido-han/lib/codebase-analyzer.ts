import { execSync } from "node:child_process";
import { basename } from "node:path";

export interface ExtensionCount {
  extension: string;
  count: number;
}

export interface ConfigFileCount {
  fileName: string;
  count: number;
}

export interface CodebaseStats {
  totalFiles: number;
  extensions: ExtensionCount[];
  configFiles: ConfigFileCount[];
}

// Config file extensions - these likely contain framework/tool configuration
const CONFIG_EXTENSIONS = new Set([
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".ini",
  ".conf",
  ".config",
]);

function getExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === fileName.length - 1) {
    return "[no extension]";
  }
  return fileName.slice(dotIndex).toLowerCase();
}

export function analyzeCodebase(rootPath: string): CodebaseStats {
  const extensionCounts = new Map<string, number>();
  const configFileCounts = new Map<string, number>();
  let files: string[] = [];

  try {
    // Use git ls-files to get tracked files (respects .gitignore automatically)
    const output = execSync("git ls-files", {
      cwd: rootPath,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large repos
    });

    files = output.trim().split("\n").filter(Boolean);

    for (const file of files) {
      const ext = getExtension(file);

      // Count all file extensions
      extensionCounts.set(ext, (extensionCounts.get(ext) || 0) + 1);

      // Track config files by their actual filename (not just extension)
      if (CONFIG_EXTENSIONS.has(ext)) {
        const fileName = basename(file);
        configFileCounts.set(
          fileName,
          (configFileCounts.get(fileName) || 0) + 1,
        );
      }
    }
  } catch (_error) {
    // If git command fails (not a git repo, etc.), return empty stats
    return {
      totalFiles: 0,
      extensions: [],
      configFiles: [],
    };
  }

  // Convert maps to sorted arrays
  const extensions = Array.from(extensionCounts.entries())
    .map(([extension, count]) => ({ extension, count }))
    .sort((a, b) => b.count - a.count); // Sort by count descending

  const configFiles = Array.from(configFileCounts.entries())
    .map(([fileName, count]) => ({ fileName, count }))
    .sort((a, b) => {
      // Sort by count descending, then alphabetically
      if (b.count !== a.count) return b.count - a.count;
      return a.fileName.localeCompare(b.fileName);
    });

  const totalFiles = files.length;

  return {
    totalFiles,
    extensions,
    configFiles,
  };
}

export function formatStatsForPrompt(stats: CodebaseStats): string {
  if (stats.totalFiles === 0) {
    return "No codebase statistics available (not a git repository or no tracked files).";
  }

  const lines: string[] = [];

  lines.push(`Total files: ${stats.totalFiles}\n`);

  // Format extensions
  if (stats.extensions.length > 0) {
    lines.push("File extensions:");
    for (const { extension, count } of stats.extensions.slice(0, 20)) {
      // Limit to top 20
      lines.push(`  ${extension}: ${count}`);
    }
    if (stats.extensions.length > 20) {
      lines.push(`  ... and ${stats.extensions.length - 20} more extensions`);
    }
    lines.push("");
  }

  // Format config files
  if (stats.configFiles.length > 0) {
    lines.push("Config files:");
    for (const { fileName, count } of stats.configFiles) {
      lines.push(`  ${fileName}: ${count}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
