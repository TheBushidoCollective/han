---
name: code-review
allowed-tools:
  - Read
  - Grep
  - Bash
  - "Bash(gh issue view:*)"
  - "Bash(gh search:*)"
  - "Bash(gh issue list:*)"
  - "Bash(gh pr comment:*)"
  - "Bash(gh pr diff:*)"
  - "Bash(gh pr view:*)"
  - "Bash(gh pr list:*)"
description: Code review a pull request

---

# Code Review Skill

Provides a systematic approach to conducting code reviews.
Focuses on the **review process** and **quality dimensions**, not
technology-specific patterns.

## Name

han-core:code-review - Code review a pull request

## Synopsis

```
/code-review [arguments]
```

## Scope

Use this skill to:

- **Conduct systematic code reviews** using a structured process
- **Evaluate code across multiple dimensions** (correctness, safety, maintainability)
- **Provide constructive feedback** with clear, actionable recommendations
- **Determine approval readiness** based on quality standards

### NOT for

- Technology-specific patterns (see appropriate language/framework plugins)
- Detailed implementation guidance (see discipline-specific agents)

## Implementation

Provide a code review for the given pull request.

To do this, follow these steps precisely:

1. Use a Haiku agent to check if the pull request (a) is closed, (b) is a draft, (c) does not need a code review (eg. because it is an automated pull request, or is very simple and obviously ok), (d) already has a code review from you from earlier, OR (e) is too large (>1000 lines changed) and should be split. If any of these conditions are true, do not proceed.
2. Use another Haiku agent to give you a list of file paths to (but not the contents of) any relevant CLAUDE.md files from the codebase: the root CLAUDE.md file (if one exists), as well as any CLAUDE.md files in the directories whose files the pull request modified
3. Use a Haiku agent to view the pull request, and ask the agent to return a summary of the change
4. Then, launch 5 parallel Sonnet agents to independently code review the change. The agents should work independently without seeing other agents' findings, then return a list of issues and the reason each issue was flagged (eg. CLAUDE.md adherence, bug, historical git context, etc.):
   a. Agent #1: Audit the changes to make sure they comply with the CLAUDE.md. Note that CLAUDE.md is guidance for Claude as it writes code, so not all instructions will be applicable during code review.
   b. Agent #2: Read the file changes in the pull request, then do a shallow scan for obvious bugs. Avoid reading extra context beyond the changes, focusing just on the changes themselves. Focus on large bugs, and avoid small issues and nitpicks. Ignore likely false positives.
   c. Agent #3: Read the git blame and history of the code modified, to identify any bugs in light of that historical context
   d. Agent #4: Read previous pull requests that touched these files, and check for any comments on those pull requests that may also apply to the current pull request.
   e. Agent #5: Read code comments in the modified files, and make sure the changes in the pull request comply with any guidance in the comments.

   IMPORTANT: After all 5 agents complete, verify their work using proof-of-work principles:
   - Check each agent's output isn't empty or generic
   - Verify issue descriptions include specific file paths and line numbers
   - Confirm agents didn't all return "no issues found" without actual analysis
   - If verification fails for any agent, note it but proceed with verified results

5. Deduplicate and score issues:
   a. First, deduplicate issues from step 4:
      - Group issues by file path and line range (issues within +/-3 lines are considered duplicates)
      - For each group, combine similar descriptions and keep the most detailed version
      - Merge reasoning from all agents that found the same issue

   b. Then, for each unique issue, launch a parallel Haiku agent that takes the PR, issue description, and list of CLAUDE.md files (from step 2), and returns a score to indicate the agent's level of confidence for whether the issue is real or false positive. To do that, the agent should score each issue on a scale from 0-100, indicating its level of confidence. For issues that were flagged due to CLAUDE.md instructions, the agent should double check that the CLAUDE.md actually calls out that issue specifically. The scale is (give this rubric to the agent verbatim):
      - 0: Not confident at all. This is a false positive that doesn't stand up to light scrutiny, or is a pre-existing issue.
      - 25: Somewhat confident. This might be a real issue, but may also be a false positive. The agent wasn't able to verify that it's a real issue. If the issue is stylistic, it is one that was not explicitly called out in the relevant CLAUDE.md.
      - 50: Moderately confident. The agent was able to verify this is a real issue, but it might be a nitpick or not happen very often in practice. Relative to the rest of the PR, it's not very important.
      - 75: Highly confident. The agent double checked the issue, and verified that it is very likely it is a real issue that will be hit in practice. The existing approach in the PR is insufficient. The issue is very important and will directly impact the code's functionality, or it is an issue that is directly mentioned in the relevant CLAUDE.md.
      - 100: Absolutely certain. The agent double checked the issue, and confirmed that it is definitely a real issue, that will happen frequently in practice. The evidence directly confirms this.

6. Filter out any issues with a score less than 80. If there are no issues that meet this criteria, do not proceed.
7. Use a Haiku agent to repeat the eligibility check from #1, to make sure that the pull request is still eligible for code review.
8. Finally, use the gh bash command to comment back on the pull request with the result. When writing your comment, keep in mind to:
   a. Keep your output brief
   b. Avoid emojis
   c. Link and cite relevant code, files, and URLs

Examples of false positives, for steps 4 and 5:

- Pre-existing issues
- Something that looks like a bug but is not actually a bug
- Pedantic nitpicks that a senior engineer wouldn't call out
- Issues that a linter, typechecker, or compiler would catch (eg. missing or incorrect imports, type errors, broken tests, formatting issues, pedantic style issues like newlines). No need to run these build steps yourself -- it is safe to assume that they will be run separately as part of CI.
- General code quality issues (eg. lack of test coverage, general security issues, poor documentation), unless explicitly required in CLAUDE.md
- Issues that are called out in CLAUDE.md, but explicitly silenced in the code (eg. due to a lint ignore comment)
- Changes in functionality that are likely intentional or are directly related to the broader change
- Real issues, but on lines that the user did not modify in their pull request

Notes:

- Do not check build signal or attempt to build or typecheck the app. These will run separately, and are not relevant to your code review.
- Use `gh` to interact with Github (eg. to fetch a pull request, or to create inline comments), rather than web fetch
- Use TaskCreate to track progress through steps 1-8
- You must cite and link each bug (eg. if referring to a CLAUDE.md, you must link it)

## Review Process Overview

### Phase 1: Pre-Review Preparation

### Before starting review, gather context

1. **Understand the change**:

   ```bash
   # Review the diff
   git diff <base-branch>...HEAD

   # Check scope of changes
   git diff --stat <base-branch>...HEAD
   ```

2. **Identify relevant context**:

   ```bash
   # Find similar patterns in codebase
   grep -r "similar_pattern" .
   ```

3. **Verify business context**:
   - Is there a related issue/ticket? Review requirements
   - What domain is impacted?
   - What's the user-facing impact?

### Phase 2: Systematic Review

### Review across these dimensions

#### 1. Correctness

- **Does it solve the stated problem?**
- **Does business logic align with domain rules?**
- **Are edge cases handled appropriately?**
- **Do tests verify the expected behavior?**

### Check correctness by

- Reading tests first to understand intended behavior
- Tracing code paths through the change
- Verifying error scenarios are covered
- Cross-referencing with requirements

#### 2. Safety

- **Does it follow authorization/authentication patterns?**
- **Are there breaking changes to APIs or contracts?**
- **Could this expose sensitive data?**
- **Are data operations safe?**
- **Are there potential race conditions or data integrity issues?**

### Check safety by

- Verifying access control on operations
- Running compatibility checks for API changes
- Checking for proper input validation
- Reviewing transaction boundaries
- Validating input sanitization

#### 3. Maintainability

- **Does it follow existing codebase patterns?**
- **Is the code readable and understandable?**
- **Are complex areas documented?**
- **Does it follow the Boy Scout Rule?** (leaves code better than found)
- **Is naming clear and consistent?**

### Check maintainability by

- Comparing with similar code in codebase
- Verifying documentation on complex logic
- Checking for magic numbers and hard-coded values
- Ensuring consistent naming conventions
- Looking for commented-out code (anti-pattern)

#### 4. Testability

- **Are there tests for new functionality?**
- **Do tests cover edge cases and error scenarios?**
- **Are tests clear and maintainable?**
- **Is test data setup appropriate?**

### Check testability by

- Reviewing test coverage of changed code
- Verifying both happy and sad paths are tested
- Ensuring tests are deterministic and clear
- Checking for proper test isolation

#### 5. Performance

- **Are there obvious performance issues?**
- **Are database queries efficient?**
- **Are expensive operations properly optimized?**
- **Are resources properly managed?**

### Check performance by

- Identifying N+1 query patterns
- Checking for missing indexes on queries
- Reviewing resource allocation and cleanup
- Verifying appropriate data structures

#### 6. Standards Compliance

- **Does it follow language-specific best practices?**
- **Does it pass all verification checks?**
- **Are there linting or type errors?**
- **Does it follow agreed coding standards?**

### Check standards compliance by

- Running verification suite
- Checking for standard pattern violations
- Verifying no bypasses of quality gates

### Phase 3: Confidence Scoring

### Apply confidence scoring to all findings

Each identified issue must include a **confidence score (0-100)** indicating how certain you are that it's a genuine problem:

| Score | Confidence Level | When to Use |
|-------|------------------|-------------|
| 100   | Absolutely certain | Objective facts: linter errors, type errors, failing tests, security vulnerabilities |
| 90    | Very high confidence | Clear violations of documented standards, obvious correctness bugs |
| 80    | High confidence | Pattern violations, missing error handling, maintainability issues |
| 70    | Moderately confident | Potential issues that need context, possible edge cases |
| 60    | Somewhat confident | Questionable patterns, style concerns with codebase precedent |
| 50    | Uncertain | Potential improvements without clear precedent |
| <50   | Low confidence | Speculative concerns, personal preferences |

**CRITICAL FILTERING RULE**: Only report issues with **confidence >= 80%**. Lower-confidence findings create noise and should be omitted.

### Confidence Scoring Guidelines

**High Confidence (90-100)** - Report these:

- Verification failures (linting, tests, types)
- Security vulnerabilities (SQL injection, XSS, auth bypass)
- Correctness bugs with clear reproduction
- Breaking API changes
- Violations of documented team standards

**Medium-High Confidence (80-89)** - Report these:

- Missing tests for new functionality
- Error handling gaps
- Performance issues (N+1 queries, missing indexes)
- Maintainability concerns with clear patterns
- Boy Scout Rule violations

**Medium Confidence (60-79)** - DO NOT REPORT:

- Style preferences without clear codebase precedent
- Speculative performance concerns
- Alternative approaches without clear benefit

**Low Confidence (<60)** - DO NOT REPORT:

- Personal opinions
- "Could be better" without specific impact
- Theoretical edge cases without evidence

### False Positive Filtering

**CRITICAL**: Apply these filters to avoid reporting non-issues:

**DO NOT REPORT**:

- Pre-existing issues not introduced by this change (check git blame)
- Issues already handled by linters/formatters
- Code with explicit lint-ignore comments (respect developer decisions)
- Style preferences without documented standards
- Theoretical bugs without evidence or reproduction
- "Could use" suggestions without clear benefit
- Pedantic nitpicks that don't affect quality

**VERIFY BEFORE REPORTING**:

- Run `git diff` to confirm issue is in changed lines
- Check if automated tools already catch this
- Verify against documented project standards (CLAUDE.md, CONTRIBUTING.md, etc.)
- Confirm the issue actually impacts correctness, safety, or maintainability

**Example of False Positive vs. Genuine Issue**:

False Positive: "This function could use TypeScript generics for better type safety" (confidence: 60%, style preference, no documented standard)

Genuine Issue: "Function `processPayment` at `services/payment.ts:42` performs database operation without transaction protection, risking data inconsistency if an error occurs mid-operation." (confidence: 90%, documented pattern violation, clear impact)

### Phase 4: Feedback & Decision

### Provide structured feedback

1. **Summary**: High-level assessment
2. **Strengths**: What's done well (positive reinforcement)
3. **Issues**: Organized by severity with **confidence scores**:
   - **Critical** (confidence >= 90): Blocks approval (security, correctness, breaking changes)
   - **Important** (confidence >= 80): Should be addressed (maintainability, best practices)
4. **Actionable next steps**: Specific changes with file:line references
5. **Decision**: Approve, Request Changes, or Needs Discussion

**Note**: Suggestions/nice-to-haves are intentionally omitted. Focus only on high-confidence, actionable feedback.

## Approval Criteria

### Approve When

- [ ] All verification checks pass (linting, tests, types, etc.)
- [ ] Business logic is correct and complete
- [ ] Security and authorization patterns followed
- [ ] No breaking changes (or properly coordinated)
- [ ] Code follows existing patterns
- [ ] Complex logic has clear documentation
- [ ] Tests cover happy paths, edge cases, and error scenarios
- [ ] Changes align with requirements
- [ ] Code is maintainable and clear
- [ ] Boy Scout Rule applied (code improved, not degraded)

### Request Changes When

- [ ] Critical issues: Security holes, correctness bugs, breaking changes
- [ ] Important issues: Pattern violations, missing tests, unclear code
- [ ] Verification failures not addressed
- [ ] Business logic doesn't match requirements
- [ ] Insufficient error handling

### Needs Discussion When

- [ ] Architectural concerns
- [ ] Unclear requirements
- [ ] Trade-off decisions needed
- [ ] Pattern deviation requires justification
- [ ] Performance implications uncertain

## Common Review Pitfalls

### Reviewers often miss

1. **Authorization bypasses**: Operations without proper access control
2. **Breaking changes**: Not checking compatibility
3. **Error handling gaps**: Only reviewing happy paths
4. **Test quality**: Tests exist but don't actually test edge cases
5. **Domain logic errors**: Not understanding business rules
6. **Commented-out code**: Leaving dead code instead of removing
7. **Magic numbers**: Unexplained constants without names
8. **Over-clever code**: Complex when simple would work
9. **Boy Scout Rule violations**: Making code worse, not better

## Red Flags (Never Approve)

### These always require changes

- **Commented-out code** -> Remove it (git preserves history)
- **Secrets or credentials in code** -> Use secure configuration
- **Breaking changes** without compatibility verification
- **Tests commented out or skipped** -> Fix code, not tests
- **Verification failures ignored** -> Must all pass
- **No tests for new functionality** -> Tests are required
- **Hard-coded business logic** -> Should be configurable
- **Error handling missing** -> Must handle edge cases
- **Obvious security vulnerabilities** -> Must fix immediately

## Integration with Development Workflow

### Code review fits in Phase 2: Implementation

```text
Implementation -> Verification Suite -> Code Review -> Approval -> Merge
                 (automated checks)   (this skill)    (human)
```

### Review happens AFTER verification

1. Developer runs verification suite
2. ALL automated checks must pass
3. Code review skill applied for quality assessment
4. Issues identified and fixed
5. Re-verify after fixes
6. Human reviews and approves for merge

**Review is NOT a substitute for verification.** Both are required.

## Output Format

For your final comment, follow the following format precisely (assuming for this example that you found 3 issues):

---

### Code review

Found 3 issues:

1. <brief description of bug> (CLAUDE.md says "<...>")

<link to file and line with full sha1 + line range for context, note that you MUST provide the full sha and not use bash here, eg. https://github.com/anthropics/claude-code/blob/1d54823877c4de72b2316a64032a54afc404e619/README.md#L13-L17>

1. <brief description of bug> (some/other/CLAUDE.md says "<...>")

<link to file and line with full sha1 + line range for context>

1. <brief description of bug> (bug due to <file and code snippet>)

<link to file and line with full sha1 + line range for context>

Generated with [Claude Code](https://claude.ai/code)

<sub>- If this code review was useful, please react with thumbs up. Otherwise, react with thumbs down.</sub>

---

- Or, if you found no issues:

---

### Code review

No issues found. Checked for bugs and CLAUDE.md compliance.

Generated with [Claude Code](https://claude.ai/code)

- When linking to code, follow the following format precisely, otherwise the Markdown preview won't render correctly: <https://github.com/anthropics/claude-cli-internal/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-L15>
  - Requires full git sha
  - You must provide the full sha. Commands like `https://github.com/owner/repo/blob/$(git rev-parse HEAD)/foo/bar` will not work, since your comment will be directly rendered in Markdown.
  - Repo name must match the repo you're code reviewing

  - `#` sign after the file name

  - Line range format is L[start]-L[end]
  - Provide at least 1 line of context before and after, centered on the line you are commenting about (eg. if you are commenting about lines 5-6, you should link to `L4-7`)

## Constructive Feedback Principles

### When providing feedback

1. **Be specific**: Point to exact lines, not vague areas
2. **Explain why**: Don't just say "this is wrong," explain the impact
3. **Provide direction**: Suggest approaches or patterns
4. **Balance critique with praise**: Note what's done well
5. **Prioritize issues**: Critical vs. important vs. suggestions
6. **Be respectful**: Code is not the person
7. **Assume competence**: Ask questions, don't accuse
8. **Teach, don't just correct**: Help developers grow

### Example of constructive feedback

**Good**: "In `services/payment_service:45`, processing payments without
transaction protection could lead to data inconsistency if an error occurs
mid-operation. Wrap the operation in a transaction to ensure atomicity.
Consider the ACID principles from database design."

**Bad**: "Use transactions here."

## Quality Philosophy

### Code review ensures

- **Correctness**: Solves the actual problem
- **Safety**: Protects data and follows security patterns
- **Maintainability**: Future developers can understand and modify
- **Consistency**: Follows established patterns
- **Quality**: Meets standards

### Remember

- Reviews are about code quality, not personal critique
- Goal is to improve code AND developer skills
- Balance thoroughness with pragmatism
- Perfection is not the standard; "good enough" that meets quality bar is
- Boy Scout Rule: Leave code better than you found it
