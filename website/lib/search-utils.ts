/**
 * Parsed search query with filters extracted
 */
export interface ParsedQuery {
  textQuery: string;
  tagFilters: string[];
  componentFilters: string[];
  categoryFilters: string[];
}

/**
 * Parse a search query string into structured filters
 *
 * Supports special syntax:
 * - `tag:typescript` or `tags:typescript,react` - filter by tags
 * - `component:skill` or `components:skill,agent` - filter by component types
 * - `category:buki` or `categories:buki,do` - filter by plugin category
 *
 * Regular text is treated as a fuzzy search query
 */
export function parseQuery(query: string): ParsedQuery {
  const parsed: ParsedQuery = {
    textQuery: "",
    tagFilters: [],
    componentFilters: [],
    categoryFilters: [],
  };

  // Split query into parts
  const parts = query.split(/\s+/);
  const textParts: string[] = [];

  for (const part of parts) {
    // Check for tag: or tags:
    const tagMatch = part.match(/^tags?:(.+)$/i);
    if (tagMatch) {
      parsed.tagFilters.push(...tagMatch[1].split(","));
      continue;
    }

    // Check for component: or components:
    const componentMatch = part.match(/^components?:(.+)$/i);
    if (componentMatch) {
      parsed.componentFilters.push(...componentMatch[1].split(","));
      continue;
    }

    // Check for category: or categories:
    const categoryMatch = part.match(/^categor(?:y|ies):(.+)$/i);
    if (categoryMatch) {
      parsed.categoryFilters.push(...categoryMatch[1].split(","));
      continue;
    }

    // Regular text query
    textParts.push(part);
  }

  parsed.textQuery = textParts.join(" ").trim();
  return parsed;
}

/**
 * Check if a result has a specific component type
 */
export function hasComponent(
  components: string[],
  componentFilter: string,
): boolean {
  return components
    .map((c) => c.toLowerCase())
    .includes(componentFilter.toLowerCase());
}
