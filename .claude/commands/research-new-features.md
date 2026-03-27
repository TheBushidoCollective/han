---
description: Research Claude AI/Code feature requests and discussions on Reddit
---

# Research New Features from Reddit

Research feature requests, pain points, and community discussions about Claude AI and Claude Code from Reddit.

## MCP Server Required

This command requires the `reddit` MCP server to be installed and running.

## Target Subreddits

Research the following subreddits for Claude-related discussions:

1. **r/ClaudeAI** - Main Claude AI community
2. **r/ClaudeCoding** - Claude Code specific discussions (if exists)
3. **r/AnthropicAI** - Anthropic company discussions
4. **r/LocalLLaMA** - AI development community (filter for Claude mentions)
5. **r/ChatGPT** - Competitor comparisons (filter for Claude mentions)
6. **r/ArtificialIntelligence** - Broader AI discussions

## Research Tasks

### 1. Gather Hot Posts

For each target subreddit, use `get_subreddit_hot_posts` to find current discussions:

```
get_subreddit_hot_posts(subreddit_name="ClaudeAI", limit=25)
get_subreddit_hot_posts(subreddit_name="AnthropicAI", limit=25)
```

### 2. Gather Top Posts (Recent)

Use `get_subreddit_top_posts` with time filters to find popular discussions:

```
get_subreddit_top_posts(subreddit_name="ClaudeAI", limit=25, time="week")
get_subreddit_top_posts(subreddit_name="ClaudeAI", limit=25, time="month")
```

### 3. Analyze Comments on Key Posts

For posts with high engagement about features, use `get_post_comments` to understand sentiment:

```
get_post_comments(post_id="xyz123", limit=50)
```

## Analysis Focus Areas

When reviewing posts and comments, look for:

### Feature Requests

- What features are users asking for?
- What workflows are frustrating?
- What would make Claude Code more useful?

### Pain Points

- Common complaints or issues
- Workarounds users have developed
- Comparisons with other tools

### Use Cases

- How are people using Claude Code?
- What domains/industries are represented?
- What integrations are desired?

### Plugin Opportunities

- What MCP servers would be valuable?
- What validation hooks would help?
- What specialized agents are needed?

## Output Format

Summarize findings as:

```markdown
## Feature Research Report

### Top Feature Requests
1. **{Feature}** - {description} ({post count} mentions)
2. ...

### Common Pain Points
1. **{Issue}** - {description}
2. ...

### Emerging Use Cases
1. **{Use Case}** - {description}
2. ...

### Plugin Opportunities
1. **{Plugin Idea}** - {why it would help}
2. ...

### Notable Discussions
- [{Post Title}]({url}) - {key takeaway}
- ...
```

## Notes

- Respect Reddit's read-only nature - this is research only
- Look for patterns across multiple posts, not just individual opinions
- Pay attention to heavily upvoted comments as indicators of community sentiment
- Consider both positive feature requests and negative pain points
- Cross-reference with existing Han plugins to identify gaps
