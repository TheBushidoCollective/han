---
name: code-review
description: Review current branch changes against REVIEW.md guidelines
---

# Code Review

## Name

session-code-review:code-review - Review session changes against REVIEW.md and CLAUDE.md guidelines

## Synopsis

```
/code-review [--branch <base>]
```

## Description

Performs a thorough code review of all changes on the current branch compared to the base branch (defaults to `main` or `master`). Reviews against `REVIEW.md` and `CLAUDE.md` guidelines in the repository.

This is a local-only review — no PR or GitHub integration required. It examines your uncommitted changes, staged changes, and all commits on the current branch.

## Implementation

Follow these steps exactly:

### 1. Determine the base branch

If `--branch` was provided, use that. Otherwise, detect the default branch:

```bash
git remote show origin | grep 'HEAD branch' | sed 's/.*: //'
```

### 2. Gather review guidelines

Read the following files if they exist:
- `REVIEW.md` at the repo root
- `CLAUDE.md` at the repo root
- Any `CLAUDE.md` files in directories containing changed files

These define the review criteria. If no `REVIEW.md` or `CLAUDE.md` exists, use general best practices (security, correctness, logic errors).

### 3. Get the full diff

```bash
# Uncommitted changes
git diff

# Staged changes
git diff --cached

# All commits on this branch vs base
git diff <base-branch>...HEAD
```

### 4. Review the changes

For each changed file, check against the guidelines from step 2. Focus on:

- **REVIEW.md violations**: Explicit rules the team has defined
- **CLAUDE.md violations**: Project conventions and requirements
- **Bugs**: Logic errors, off-by-one errors, null pointer issues
- **Security**: Injection, auth bypass, exposed secrets, OWASP top 10
- **Correctness**: Code that will produce wrong results

Do NOT flag:
- Style preferences (unless in REVIEW.md)
- Issues a linter catches
- Subjective improvements
- Pre-existing issues not in the diff

### 5. Report findings

For each issue found, report:
- **File and line number** (link format: `file_path:line_number`)
- **Severity**: critical / warning
- **Description**: What's wrong and why
- **Suggestion**: How to fix it

If no issues are found, report: "No issues found. Changes comply with REVIEW.md and CLAUDE.md guidelines."

### 6. Offer to fix

If issues were found, ask the user if they'd like you to fix them.

## Example Interaction

```
User: /code-review

Claude: Reviewing changes on branch `feature/auth-flow` against `main`...

Found REVIEW.md with 3 rules:
1. All API routes must validate auth tokens
2. Database queries must use parameterized statements
3. Error responses must not leak internal details

Reviewing 4 changed files...

## Code Review Results

### 1. Missing auth validation (critical)
`src/routes/users.ts:45` — New GET `/users/:id` endpoint does not validate the auth token. REVIEW.md rule: "All API routes must validate auth tokens."

**Fix**: Add `validateToken(req)` middleware before the handler.

### 2. SQL injection risk (critical)
`src/db/queries.ts:23` — String interpolation in SQL query: `` `SELECT * FROM users WHERE id = ${id}` ``. REVIEW.md rule: "Database queries must use parameterized statements."

**Fix**: Use `db.query('SELECT * FROM users WHERE id = ?', [id])`.

---

Found 2 issues (2 critical). Would you like me to fix them?
```
