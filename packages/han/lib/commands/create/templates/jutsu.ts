/**
 * Jutsu plugin template.
 *
 * Jutsu plugins provide language/tool skills with validation hooks.
 * They typically include skills, commands, and hook configurations.
 */

import { type PluginConfig, processTemplate, toTitleCase } from './index.ts';

export interface JutsuTemplateFiles {
  [key: string]: string;
  '.claude-plugin/plugin.json': string;
  'han-plugin.yml': string;
  'skills/getting-started/SKILL.md': string;
  'README.md': string;
  'CHANGELOG.md': string;
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
  "keywords": ["{{KEYWORD}}"]
}
`;

const HAN_PLUGIN_YML_TEMPLATE = `# {{TITLE}} Plugin Configuration
# Define validation hooks for your plugin

# Example hooks configuration:
# hooks:
#   lint:
#     command: "your-lint-command \${HAN_FILES}"
#     dirs_with:
#       - "your-config-file"
#     if_changed:
#       - "**/*.{your,file,extensions}"

# Empty hooks - add your own hooks above
hooks: {}
`;

const SKILL_TEMPLATE = `---
name: getting-started
description: Use when getting started with {{TITLE}} - covers setup, configuration, and basic usage.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# Getting Started with {{TITLE}}

This skill provides guidance for setting up and using {{TITLE}}.

## Overview

{{DESCRIPTION}}

## Setup

<!-- Add your setup instructions here -->

1. Install required dependencies
2. Configure your project
3. Start using the tool

## Basic Usage

<!-- Add basic usage examples here -->

## Configuration

<!-- Add configuration options here -->

## Common Patterns

<!-- Add common usage patterns here -->

## Troubleshooting

<!-- Add troubleshooting tips here -->
`;

const README_TEMPLATE = `# {{TITLE}}

{{DESCRIPTION}}

## Installation

\`\`\`bash
han plugin install {{NAME}}
\`\`\`

## Skills

This plugin provides the following skills:

- **getting-started** - Setup, configuration, and basic usage

## Hooks

<!-- Document your validation hooks here -->

## Configuration

<!-- Document any configuration options here -->

## License

MIT
`;

const CHANGELOG_TEMPLATE = `# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - {{DATE}}

### Added

- Initial release
- Getting started skill
`;

/**
 * Generate all files for a jutsu plugin.
 */
export function getJutsuTemplate(config: PluginConfig): JutsuTemplateFiles {
  const variables = {
    NAME: config.name,
    TITLE: toTitleCase(config.name.replace(/^jutsu-/, '')),
    DESCRIPTION: config.description,
    AUTHOR_NAME: config.authorName,
    AUTHOR_URL: config.authorUrl,
    KEYWORD: config.name.replace(/^jutsu-/, ''),
    DATE: new Date().toISOString().split('T')[0],
  };

  return {
    '.claude-plugin/plugin.json': processTemplate(
      PLUGIN_JSON_TEMPLATE,
      variables
    ),
    'han-plugin.yml': processTemplate(HAN_PLUGIN_YML_TEMPLATE, variables),
    'skills/getting-started/SKILL.md': processTemplate(
      SKILL_TEMPLATE,
      variables
    ),
    'README.md': processTemplate(README_TEMPLATE, variables),
    'CHANGELOG.md': processTemplate(CHANGELOG_TEMPLATE, variables),
  };
}
