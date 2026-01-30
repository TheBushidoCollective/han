---
status: in_progress
depends_on: []
branch: ai-dlc/third-party-plugins/01-cli-scaffolding
discipline: backend
---

# unit-01-cli-scaffolding

## Description

Add `han create plugin` command to scaffold new plugin projects with the correct structure, configuration files, and boilerplate code.

## Discipline

backend - This unit involves CLI development using the existing han CLI architecture (Commander.js, Ink).

## Success Criteria

- [ ] `han create plugin` command exists and is documented in help
- [ ] Interactive prompts ask for plugin type (jutsu, do, hashi) and name
- [ ] Scaffolded jutsu plugin has: plugin.json, hooks.json, skills/, commands/
- [ ] Scaffolded do plugin has: plugin.json, agents/ with agent definitions
- [ ] Scaffolded hashi plugin has: plugin.json, mcp server configuration
- [ ] All scaffolded plugins pass `claudelint` validation
- [ ] Generated plugin.json has correct schema and required fields

## Notes

- Use Ink for interactive CLI experience (consistent with existing han UX)
- Plugin structure must match what claudelint expects
- Consider adding `--type` and `--name` flags for non-interactive use
- Reference existing plugin structures in jutsu/, do/, hashi/ directories

## Plan

### Phase 1: Command Infrastructure

**Step 1: Create command directory structure**

Create `/packages/han/lib/commands/create/` directory with:
- `index.ts` - Main command registration
- `plugin.ts` - Plugin scaffolding logic
- `plugin-creator.tsx` - Interactive Ink UI component
- `templates/` - Template files for each plugin type

**Step 2: Register command in main.ts**

Add import and registration in `/packages/han/lib/main.ts`:
```typescript
import { registerCreateCommands } from "./commands/create/index.ts";
registerCreateCommands(program);
```

### Phase 2: Interactive UI Component

**Step 3: Create PluginCreator Ink component**

Following pattern from `scope-selector.tsx` and `plugin-selector.tsx`:

1. Plugin Type Selection - Choose from jutsu, do, or hashi using arrow keys
2. Plugin Name Input - Text input with kebab-case validation
3. Author Information - Prompt for author name and URL
4. Description - Prompt for plugin description
5. Confirmation - Show summary and confirm creation

**Step 4: Add non-interactive flags**

Support CLI flags for scripted usage:
- `--type <type>` - Plugin type (jutsu|do|hashi)
- `--name <name>` - Plugin name
- `--author <name>` - Author name
- `--description <desc>` - Plugin description
- `--output <path>` - Output directory (defaults to current directory)

### Phase 3: Plugin Templates

**Step 5: Create jutsu plugin template**

Based on `/jutsu/jutsu-biome/`:
```
<plugin-name>/
├── .claude-plugin/
│   └── plugin.json           # Required metadata
├── han-plugin.yml            # Hook configuration
├── skills/
│   └── <skill-name>/
│       └── SKILL.md          # Skill with frontmatter
├── README.md
└── CHANGELOG.md
```

**Step 6: Create do plugin template**

Based on `/do/do-architecture/`:
```
<plugin-name>/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   └── <agent-name>.md       # Agent definition with frontmatter
├── README.md
└── CHANGELOG.md
```

**Step 7: Create hashi plugin template**

Based on `/hashi/hashi-reddit/`:
```
<plugin-name>/
├── .claude-plugin/
│   └── plugin.json           # Includes mcpServers if HTTP
├── .mcp.json                 # MCP server configuration
├── han-plugin.yml
├── README.md
└── CHANGELOG.md
```

### Phase 4: Scaffolding Logic

**Step 8: Implement template processing**

Create utility functions in `templates/index.ts`:
- `processTemplate(template: string, variables: Record<string, string>): string`
- `getPluginTemplate(type: 'jutsu' | 'do' | 'hashi'): PluginTemplate`

**Step 9: Implement directory creation**

1. Validate plugin name (kebab-case, no reserved names)
2. Check target directory doesn't exist
3. Create directory structure based on type
4. Process and write template files
5. Display success message with next steps

### Phase 5: Validation Integration

**Step 10: Add post-creation validation**

After scaffolding, run validation to ensure the created plugin is valid.

### Files to Create

1. `/packages/han/lib/commands/create/index.ts`
2. `/packages/han/lib/commands/create/plugin.ts`
3. `/packages/han/lib/commands/create/plugin-creator.tsx`
4. `/packages/han/lib/commands/create/templates/index.ts`
5. `/packages/han/lib/commands/create/templates/jutsu.ts`
6. `/packages/han/lib/commands/create/templates/do.ts`
7. `/packages/han/lib/commands/create/templates/hashi.ts`

### Files to Modify

1. `/packages/han/lib/main.ts` - Register create commands

### Critical Files for Reference

- `packages/han/lib/main.ts` - Entry point for command registration
- `packages/han/lib/commands/plugin/validate.ts` - Validation logic pattern
- `packages/han/lib/scope-selector.tsx` - Ink interactive selection pattern
- `jutsu/jutsu-biome/.claude-plugin/plugin.json` - Jutsu plugin.json reference
- `hashi/hashi-reddit/.mcp.json` - Hashi MCP configuration reference
