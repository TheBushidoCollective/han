---
status: pending
depends_on: [01-repo-setup]
branch: ai-dlc/ai-dlc-website/02-plugin-migration
discipline: backend
---

# unit-02-plugin-migration

## Description

Migrate the AI-DLC plugin from `han/patterns/ai-dlc` to the new monorepo, updating it to work as an external Han-dependent plugin.

## Discipline

backend - This unit handles plugin structure and Claude Code integration.

## Success Criteria

- [ ] All files from `patterns/ai-dlc` copied to `ai-dlc/plugin`
- [ ] `plugin.json` updated with:
  - Correct metadata (name, description, version)
  - Han declared as dependency
  - Repository URL pointing to new repo
- [ ] `han-plugin.yml` updated for external installation
- [ ] All skills and commands reference correct paths
- [ ] Plugin validates with `claude plugin validate`
- [ ] Plugin installable via `han plugin install thebushidocollective/ai-dlc`
- [ ] Basic smoke test: `/elaborate` command works after install

## Notes

- Review `han/patterns/ai-dlc/han-plugin.yml` for current structure
- External plugins use `CLAUDE_PLUGIN_ROOT` for path resolution
- May need to update hook commands to work without Han's directory structure
- Test installation in a fresh Claude Code session
