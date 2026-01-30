---
status: pending
depends_on: []
branch: ai-dlc/third-party-plugins/02-hook-integration
discipline: backend
---

# unit-02-hook-integration

## Description

Ensure the han hook system discovers and executes hooks from externally-installed plugins (not in the han repo). Verify that external plugins integrate seamlessly with the hook orchestration system.

## Discipline

backend - This unit involves the han hook orchestrator and plugin discovery system.

## Success Criteria

- [ ] han discovers hooks from plugins installed via local path
- [ ] han discovers hooks from plugins installed via git URL
- [ ] External plugin hooks run in correct order with first-party hooks
- [ ] `han hook list` shows hooks from external plugins
- [ ] Hook caching works correctly for external plugins
- [ ] External plugin hooks can define dependencies on han hooks

## Notes

- Review how Claude Code discovers plugins via settings.json
- Check if CLAUDE_PLUGIN_ROOT is set correctly for external plugins
- Test with a real external plugin installed from a different directory
- May need to update hook discovery to search all installed plugin locations
