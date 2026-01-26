#!/usr/bin/env bash
# Consolidated SessionStart reference hooks
# Outputs all must-read-first tags in a single hook to avoid repeated Bun startup overhead

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"

cat <<EOF
<must-read-first reason="no time estimates policy">${PLUGIN_ROOT}/hooks/no-time-estimates.md</must-read-first>

<must-read-first reason="epistemic rigor and professional honesty">${PLUGIN_ROOT}/hooks/professional-honesty.md</must-read-first>

<must-read-first reason="subagent delegation rules">${PLUGIN_ROOT}/hooks/ensure-subagent.md</must-read-first>

<must-read-first reason="bash output capture best practices">${PLUGIN_ROOT}/hooks/bash-output-capture.md</must-read-first>

<must-read-first reason="skill selection and transparency">${PLUGIN_ROOT}/hooks/ensure-skill-use.md</must-read-first>

<must-read-first reason="date handling best practices">${PLUGIN_ROOT}/hooks/date-handling.md</must-read-first>
EOF
