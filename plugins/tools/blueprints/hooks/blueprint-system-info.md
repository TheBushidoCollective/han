# Blueprint System Available

This project uses technical blueprints for system documentation.

**Tool Usage:**

- `Glob("blueprints/*.md")` - List all existing blueprints
- `Grep("keyword", path: "blueprints/")` - Search blueprints by keyword
- `Read("blueprints/{name}.md")` - Read a blueprint before modifying
- `Write("blueprints/{name}.md", content)` - Create or update a blueprint

**When to use:** New features, API changes, architectural modifications, behavior changes.

See UserPromptSubmit hook for detailed requirements.
