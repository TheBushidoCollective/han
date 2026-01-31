/**
 * Do plugin template.
 *
 * Do plugins provide specialized agents for specific disciplines.
 * They include agent definitions with frontmatter.
 */

import {
	type PluginConfig,
	processTemplate,
	toTitleCase,
} from "./index.ts";

export interface DoTemplateFiles {
	[key: string]: string;
	".claude-plugin/plugin.json": string;
	"agents/specialist.md": string;
	"README.md": string;
	"CHANGELOG.md": string;
}

const PLUGIN_JSON_TEMPLATE = `{
  "name": "{{NAME}}",
  "version": "0.1.0",
  "description": "{{DESCRIPTION}}",
  "author": {
    "name": "{{AUTHOR_NAME}}",
    "url": "{{AUTHOR_URL}}"
  },
  "license": "MIT",
  "keywords": ["{{KEYWORD}}", "agent"]
}
`;

const AGENT_TEMPLATE = `---
name: {{AGENT_NAME}}
description: |
  Use this agent for {{AGENT_DESCRIPTION}}.

  Examples:
  <example>
  Context: User needs help with {{KEYWORD}} tasks.
  user: 'Help me with {{KEYWORD}}'
  assistant: 'I'll use {{AGENT_NAME}} to analyze and provide guidance.'
  <commentary>This requires specialized {{KEYWORD}} expertise.</commentary>
  </example>
model: inherit
color: blue
---

# {{AGENT_TITLE}}

You are a specialized {{AGENT_TITLE}} focused on {{KEYWORD}}.

## Core Responsibilities

1. **Analysis**: Analyze and evaluate {{KEYWORD}} requirements
2. **Guidance**: Provide expert guidance on best practices
3. **Implementation**: Help implement solutions following best practices
4. **Review**: Review and provide feedback on existing work

## Expertise Areas

- Core {{KEYWORD}} concepts and principles
- Best practices and patterns
- Common pitfalls and how to avoid them
- Industry standards and conventions

## Working Style

- Ask clarifying questions when requirements are ambiguous
- Provide rationale for recommendations
- Consider trade-offs and alternatives
- Focus on practical, actionable advice

## Output Format

When providing recommendations:

1. **Summary**: Brief overview of the recommendation
2. **Rationale**: Why this approach is recommended
3. **Implementation**: How to implement the recommendation
4. **Trade-offs**: Potential downsides or alternatives to consider
`;

const README_TEMPLATE = `# {{TITLE}}

{{DESCRIPTION}}

## Installation

\`\`\`bash
han plugin install {{NAME}}
\`\`\`

## Agents

This plugin provides the following agents:

- **{{AGENT_NAME}}** - Specialized agent for {{KEYWORD}} tasks

## Usage

Invoke the agent using the Task tool or by asking Claude to use it for {{KEYWORD}}-related tasks.

## License

MIT
`;

const CHANGELOG_TEMPLATE = `# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - {{DATE}}

### Added

- Initial release
- {{AGENT_NAME}} agent
`;

/**
 * Generate all files for a do plugin.
 */
export function getDoTemplate(config: PluginConfig): DoTemplateFiles {
	const keyword = config.name.replace(/^do-/, "");
	const agentName = keyword;
	const agentTitle = toTitleCase(keyword);

	const variables = {
		NAME: config.name,
		TITLE: toTitleCase(config.name.replace(/^do-/, "")),
		DESCRIPTION: config.description,
		AUTHOR_NAME: config.authorName,
		AUTHOR_URL: config.authorUrl,
		KEYWORD: keyword,
		AGENT_NAME: agentName,
		AGENT_TITLE: agentTitle,
		AGENT_DESCRIPTION: config.description.toLowerCase(),
		DATE: new Date().toISOString().split("T")[0],
	};

	return {
		".claude-plugin/plugin.json": processTemplate(
			PLUGIN_JSON_TEMPLATE,
			variables,
		),
		"agents/specialist.md": processTemplate(AGENT_TEMPLATE, variables),
		"README.md": processTemplate(README_TEMPLATE, variables),
		"CHANGELOG.md": processTemplate(CHANGELOG_TEMPLATE, variables),
	};
}
