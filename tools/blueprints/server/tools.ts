import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  Blueprint,
  BlueprintMetadata,
  ReadBlueprintResult,
  SearchBlueprintsResult,
  WriteBlueprintResult,
} from './types.js';

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

/**
 * Find the blueprints directory in the current repository
 */
function getBlueprintsDir(): string | null {
  const cwd = process.cwd();
  const blueprintsPath = join(cwd, 'blueprints');

  if (existsSync(blueprintsPath)) {
    return blueprintsPath;
  }

  return null;
}

/**
 * Parse frontmatter from blueprint markdown
 */
function parseFrontmatter(content: string): {
  metadata: BlueprintMetadata | null;
  content: string;
} {
  const match = content.match(FRONTMATTER_REGEX);

  if (!match) {
    return { metadata: null, content };
  }

  const frontmatterText = match[1];
  const bodyContent = match[2];

  // Parse YAML frontmatter (simple key-value pairs)
  const metadata: Partial<BlueprintMetadata> = {};
  for (const line of frontmatterText.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    if (key === 'name' || key === 'summary') {
      metadata[key] = value;
    }
  }

  if (!metadata.name || !metadata.summary) {
    return { metadata: null, content };
  }

  return {
    metadata: metadata as BlueprintMetadata,
    content: bodyContent,
  };
}

/**
 * Format blueprint with frontmatter
 */
function formatWithFrontmatter(blueprint: Blueprint): string {
  return `---
name: ${blueprint.name}
summary: ${blueprint.summary}
---

${blueprint.content}`;
}

/**
 * Search blueprints by optional keyword
 */
export function searchBlueprints(keyword?: string): SearchBlueprintsResult {
  const blueprintsDir = getBlueprintsDir();
  if (!blueprintsDir) {
    return { blueprints: [] };
  }

  const files = readdirSync(blueprintsDir).filter(
    (f) => f.endsWith('.md') && f !== 'README.md'
  );

  const blueprints: BlueprintMetadata[] = [];

  for (const file of files) {
    const filePath = join(blueprintsDir, file);
    const content = readFileSync(filePath, 'utf-8');
    const { metadata } = parseFrontmatter(content);

    if (!metadata) {
      // If no frontmatter, try to extract from filename
      const name = file.replace('.md', '');
      blueprints.push({
        name,
        summary: 'No summary available (missing frontmatter)',
      });
      continue;
    }

    // Filter by keyword if provided
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      const matchesName = metadata.name.toLowerCase().includes(lowerKeyword);
      const matchesSummary = metadata.summary
        .toLowerCase()
        .includes(lowerKeyword);

      if (!matchesName && !matchesSummary) {
        continue;
      }
    }

    blueprints.push(metadata);
  }

  // Sort alphabetically by name
  blueprints.sort((a, b) => a.name.localeCompare(b.name));

  return { blueprints };
}

/**
 * Read a specific blueprint by name
 */
export function readBlueprint(name: string): ReadBlueprintResult {
  const blueprintsDir = getBlueprintsDir();
  if (!blueprintsDir) {
    throw new Error('Blueprints directory not found at repository root');
  }

  const filePath = join(blueprintsDir, `${name}.md`);
  if (!existsSync(filePath)) {
    throw new Error(`Blueprint not found: ${name}`);
  }

  const fileContent = readFileSync(filePath, 'utf-8');
  const { metadata, content } = parseFrontmatter(fileContent);

  if (!metadata) {
    throw new Error(
      `Blueprint ${name} is missing frontmatter. Expected:\n---\nname: ${name}\nsummary: Brief description\n---`
    );
  }

  return {
    name: metadata.name,
    summary: metadata.summary,
    content,
  };
}

/**
 * Write a blueprint (create or update)
 */
export function writeBlueprint(
  name: string,
  summary: string,
  content: string
): WriteBlueprintResult {
  const blueprintsDir = getBlueprintsDir();
  if (!blueprintsDir) {
    throw new Error('Blueprints directory not found at repository root');
  }

  // Validate inputs
  if (!name || !summary || !content) {
    throw new Error('Name, summary, and content are all required');
  }

  // Ensure name doesn't have .md extension
  const cleanName = name.replace(/\.md$/, '');

  const blueprint: Blueprint = {
    name: cleanName,
    summary,
    content: content.trim(),
  };

  const filePath = join(blueprintsDir, `${cleanName}.md`);
  const fileContent = formatWithFrontmatter(blueprint);

  writeFileSync(filePath, fileContent, 'utf-8');

  const action = existsSync(filePath) ? 'updated' : 'created';
  return {
    success: true,
    message: `Blueprint ${cleanName} ${action} successfully`,
  };
}
