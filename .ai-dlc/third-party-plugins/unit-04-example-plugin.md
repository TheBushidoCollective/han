---
status: pending
depends_on: [unit-01-cli-scaffolding]
branch: ai-dlc/third-party-plugins/04-example-plugin
discipline: backend
---

# unit-04-example-plugin

## Description

Create an example third-party plugin repository that serves as a reference implementation. This demonstrates best practices and can be used for testing the external plugin workflow.

## Discipline

backend - This unit involves creating a working plugin with hooks and skills.

## Success Criteria

- [ ] Example plugin repo created (can be in han repo under examples/)
- [ ] Plugin has working hooks that integrate with han
- [ ] Plugin has at least one skill/command
- [ ] Plugin passes claudelint validation
- [ ] README explains how to install and use the plugin
- [ ] Can be installed via local path and works correctly
- [ ] Demonstrates hook execution and skill invocation

## Notes

- Create a simple but useful example (e.g., a jutsu for a common tool)
- Include comprehensive comments explaining each file's purpose
- Show both hooks.json and plugin.json best practices
- Consider making this a GitHub template repo eventually
