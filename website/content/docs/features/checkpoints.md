---
title: "Session-Scoped Validation"
description: "How Han keeps validation focused on the code you actually modified, instead of drowning you in a legacy project's pre-existing issues."
---

Han applies the Boy Scout Rule to code validation: leave the code better than you found it, but don't demand perfection on day one.

> **Naming note:** Han used to implement this with an explicit checkpoint system, and some configuration keys and CLI flags still carry the `checkpoint` name. That subsystem has been removed and this page documents what actually runs today. The `checkpoints` config key and the `--no-checkpoints` flag now control session-scoped filtering; see [turning session filtering off](#turning-session-filtering-off). Two flags survive that genuinely do nothing, listed under [inert leftovers](#inert-leftovers).

## The Problem

Run validation hooks against your entire codebase and a legacy project with 500 pre-existing issues buries you in problems you didn't create.

This leads to:

- Developers disabling hooks in frustration
- Validation abandoned entirely
- Net result: worse quality, not better

## The Solution

Two independent mechanisms keep a hook's attention on your work.

```text
Your Work:
├─ Modified: components/Button.tsx
├─ Untouched: utils/format.ts (has lint errors)

Stop hook runs:
├─ Filters to: components/Button.tsx
└─ Pre-existing issues in utils/format.ts: not your problem today
```

### 1. Caching

Every hook declares `if_changed` glob patterns. Before running, Han builds a manifest of the files matching those patterns and decides whether there is anything to do:

- If the current session has not touched any file in the manifest, the hook is skipped
- Otherwise each file's hash is compared against the hash recorded at its last validation, and the hook runs when any hash differs or a previously validated file was deleted
- On any error reading cache state, Han assumes changes and runs the hook, so a cache fault never silently skips validation

Caching is on by default. Turn it off with `--no-cache` on `han hook run`, `HAN_NO_CACHE=1`, or `hooks.cache: false` in `han.yml`.

### 2. Session file filtering

A hook command can opt in to file-level targeting by including the `${HAN_FILES}` template:

```yaml
# han-plugin.yml
hooks:
  lint:
    command: npx biome check --write ${HAN_FILES}
    if_changed:
      - "**/*.ts"
      - "**/*.tsx"
```

At `Stop`, Han resolves that template against the files the current session modified:

- `${HAN_FILES}` becomes the session-modified files under the hook's directory that also match `if_changed`
- With no session ID, no session-modified files, or a failed lookup, it becomes `.` so the hook falls back to the whole directory
- If the session did modify files but none match this directory and `if_changed`, the hook is skipped for that directory rather than run against `.`
- A command without `${HAN_FILES}` runs unchanged

This is automatic and has no off switch. A command opts in by using the template and opts out by not using it.

## Multi-Session Safety

Session file filtering is what keeps two Claude Code sessions in the same repo from fighting:

```text
Session A: modifies src/auth.ts   → its Stop hook validates src/auth.ts
Session B: modifies src/utils.ts  → its Stop hook validates src/utils.ts
```

Without it, Session B's hook would see Session A's unfinished edit to `auth.ts`, try to fix it, and collide with Session A doing the same thing.

## Subagent Work

Subagents run the same hooks as the main conversation. A `SubagentStop` hook validates through the same caching and `${HAN_FILES}` path as a `Stop` hook, so a subagent's validation naturally narrows to the files that subagent touched.

## Turning Session Filtering Off

Session-scoped filtering narrows a hook to the files the session touched. Turn
it off when you want a hook to check the whole tree every time:

| Name | Where it appears | Effect |
|------|------------------|--------|
| `hooks.checkpoints: false` | `han.yml` | `${HAN_FILES}` expands to `.`, so hooks check everything |
| `--no-checkpoints` | `han hook dispatch` | Same, for the hooks that dispatch invokes |
| `HAN_NO_CHECKPOINTS=1` | Environment | Same, read by the hook runner |

## Inert Leftovers

`--checkpoint-type` and `--checkpoint-id` on `han hook run` are still parsed and
validated, then ignored. They are remnants of the removed checkpoint system.

There is no `han checkpoint` command. Earlier documentation described
`han checkpoint capture`, `list`, and `clean`; those subcommands were removed
along with the feature.

## Adopting Han on a Legacy Codebase

Because a hook only fires on files you touch, you can install validation plugins on a messy codebase without a cleanup sprint first:

1. Install the plugins for your stack
2. Work normally. Hooks validate only what you edit
3. Pre-existing issues surface gradually, as you touch the files that contain them

To deliberately attack accumulated debt, force a full run:

```bash
han hook run biome lint --no-cache
```

## Learn More

- [Hook System](/docs/features/hooks) - How hooks fire and what they do
- [Hook Commands](/docs/cli/hooks) - Running hooks manually
- [Configuration](/docs/configuration) - Tuning hook behaviour
