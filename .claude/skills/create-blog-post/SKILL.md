---
description: Research Reddit discussions and write a blog post about how Han addresses the topic
---

# Create Blog Post

Research relevant hype, pain points, and discussions in the Reddit AI/coding community, then write a blog post about how Han tackles that angle.

## Input

**Direction/Topic**: $ARGUMENTS

If no topic provided, ask the user what angle they want to cover.

## MCP Server Required

This command requires the `reddit` MCP server to be installed and running.

## Phase 1: Research Reddit Discussions

### Target Subreddits

Research these subreddits for relevant discussions:

1. **r/ClaudeAI** - Main Claude AI community
2. **r/AnthropicAI** - Anthropic company discussions
3. **r/LocalLLaMA** - AI development community
4. **r/ChatGPT** - Competitor comparisons
5. **r/ArtificialIntelligence** - Broader AI discussions
6. **r/programming** - Developer pain points
7. **r/webdev** - Web development workflows

### Search Strategy

1. **Gather hot posts** related to the topic:

```
get_subreddit_hot_posts(subreddit_name="ClaudeAI", limit=25)
```

2. **Search for topic-specific posts**:

```
search_reddit(query="{topic} Claude Code", limit=25)
search_reddit(query="{topic} AI coding assistant", limit=25)
```

3. **Analyze comments** on highly engaged posts:

```
get_post_comments(post_id="xyz123", limit=50)
```

### What to Look For

- **Pain points**: What frustrates users about current tools?
- **Feature requests**: What do people wish existed?
- **Workarounds**: What hacks are people using?
- **Comparisons**: How do people compare tools?
- **Success stories**: What's working well?
- **Emerging patterns**: What trends are appearing?

## Phase 2: Connect to Han

Analyze how Han's features address the discovered pain points:

### Han Feature Mapping

| Reddit Pain Point | Han Solution |
|-------------------|--------------|
| Inconsistent code quality | Jutsu validation hooks |
| Lack of specialization | Do discipline agents |
| Poor tool integration | Hashi MCP bridges |
| No memory across sessions | Memory system |
| Uncalibrated confidence | Metrics tracking |
| Missing documentation | Blueprints system |

### Key Han Differentiators

- **Plugin marketplace**: Curated, quality-focused
- **Bushido principles**: Quality over quantity
- **Validation hooks**: Catch issues before they spread
- **Specialized agents**: Domain expertise on demand
- **MCP integration**: Connect to real tools
- **Memory system**: Learn from experience

## Phase 3: Write the Blog Post

### Blog Post Structure

```markdown
---
title: "{Compelling title addressing the topic}"
description: "{One-line hook connecting pain point to solution}"
date: "{YYYY-MM-DD}"
author: "The Bushido Collective"
tags: ["{relevant}", "{tags}"]
category: "{Feature|Technical Deep Dive|Philosophy|Tutorial}"
---

{Opening hook - acknowledge the pain point from Reddit discussions}

## The Problem

{Describe the issue users face, cite Reddit sentiment without quoting directly}

## How Others Approach It

{Brief overview of existing solutions and their limitations}

## The Han Way

{Explain Han's approach to solving this problem}

### {Specific Feature 1}

{How this Han feature helps}

### {Specific Feature 2}

{How this Han feature helps}

## Real-World Application

{Concrete example of using Han to solve this problem}

## Getting Started

{How to actually use Han to address this}

## What's Next

{Future improvements or related features}
```

### Writing Guidelines

- **Voice**: Technical but accessible, confident but not arrogant
- **Length**: 800-1500 words
- **Code examples**: Include working examples when relevant
- **No fluff**: Every paragraph should add value
- **Honest**: Don't oversell - acknowledge limitations
- **Actionable**: Reader should know how to get started

### File Location

Save to: `website/content/blog/{slug}.md`

Use kebab-case for filename based on title.

## Phase 4: Review and Refine

Before finalizing:

1. **Verify accuracy**: All Han features mentioned should exist
2. **Check examples**: Code snippets should work
3. **Validate links**: Any referenced docs should exist
4. **Read aloud**: Does it flow naturally?
5. **Cut fluff**: Remove anything that doesn't add value

## Output

- Research summary with key Reddit findings
- Draft blog post in `website/content/blog/`
- Suggested social media snippets for promotion

## Example Usage

```
/create-blog-post memory and context across sessions
/create-blog-post code quality and validation
/create-blog-post specialized AI agents for different domains
/create-blog-post MCP server integrations
```
