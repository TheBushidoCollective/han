---
description: Ask questions about AI-DLC methodology (spawns research agent to avoid context bloat)
---

# /methodology - AI-DLC Methodology Guide

**User-facing command** - Ask questions about the AI-DLC 2026 methodology without bloating your main context window.

## How It Works

This command spawns a **research agent** that reads the AI-DLC paper and runbooks to answer your question. The agent's research stays in its own context, returning only the concise answer to you.

## Usage

```
/methodology [your question]
```

### Examples

```
/methodology When should I use HITL vs OHOTL mode?
/methodology How do I handle a blocked unit?
/methodology What's the difference between Intent and Unit?
/methodology How does AI-DLC compare to traditional Agile?
```

## Instructions for Claude

When the user runs `/methodology`, spawn a research agent to answer their question.

**Step 1: Extract the question**

The user's question follows the command. If no question provided, ask what they'd like to know about AI-DLC.

**Step 2: Spawn the research agent**

Use the Task tool to spawn an Explore agent with this prompt:

```
Research the AI-DLC 2026 methodology to answer this question: {question}

Sources to consult (in order of relevance):
1. The AI-DLC 2026 paper: website/content/papers/ai-dlc-2026.md
2. Runbooks in: website/content/papers/ai-dlc-2026/runbooks/
3. The jutsu-ai-dlc plugin: jutsu/jutsu-ai-dlc/

Key runbooks by topic:
- Reimagining SDLC: reimagining-sdlc.md
- Reimagining Roles: reimagining-roles.md
- Operating Modes (HITL/OHOTL/AHOTL): mode-selection.md, hitl-mode.md, ohotl-mode.md
- Adoption: from-waterfall.md, from-agile.md, greenfield.md
- Building Trust: building-trust.md

Provide a concise, actionable answer. Include specific references to sections when helpful.
```

**Step 3: Return the answer**

Share the agent's response with the user. Keep it concise - the point is to avoid context bloat.

## Topics Covered

The AI-DLC paper and runbooks cover:

| Topic | Runbook |
|-------|---------|
| Core principles | ai-dlc-2026.md |
| HITL, OHOTL, AHOTL modes | mode-selection.md, hitl-mode.md, ohotl-mode.md |
| Reimagining the SDLC | reimagining-sdlc.md |
| Reimagining roles | reimagining-roles.md |
| Adoption from Waterfall | from-waterfall.md |
| Adoption from Agile | from-agile.md |
| Greenfield projects | greenfield.md |
| Building organizational trust | building-trust.md |
| Completion criteria | completion-criteria.md |
| Backpressure patterns | backpressure.md |

## Why Use This?

- **Context efficiency** - Research happens in a separate agent's context
- **Fresh perspective** - Each query gets full attention without prior conversation baggage
- **Deep answers** - Agent can read full paper sections, returning only what's relevant
