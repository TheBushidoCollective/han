---
description: A simple example command that demonstrates slash command functionality
---

# Greet Command

This is an example slash command. When invoked with `/example-jutsu-plugin:greet`, it provides a friendly greeting and demonstrates command functionality.

## Usage

Invoke this command to see a greeting message and learn about Han plugin commands.

## Response

Hello! This is the example greet command from the example-jutsu-plugin.

Commands are invoked using slash notation: `/plugin-name:command-name`

For example:
- `/example-jutsu-plugin:greet` - This command
- `/jutsu-biome:format` - Format with Biome (if installed)

## Creating Your Own Commands

To create a command in your plugin:

1. Create a markdown file in the `commands/` directory
2. Add YAML frontmatter with a `description` field
3. Write the command content below the frontmatter

Example structure:
```
my-plugin/
  commands/
    my-command.md
```

The command will be available as `/my-plugin:my-command`.
