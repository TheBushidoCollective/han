# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Han bridge for omp (Oh My Pi), shipped as an omp extension. omp had no bridge, so no omp session was visible to Han.
- Session lifecycle events: start, end, switch, and context compaction, as correlated `hook_run` / `hook_result` pairs.
- Per-tool-call events from omp's `tool_execution_start` / `tool_execution_end` observability pair, with real durations and success, plus `hook_file_change` for successful writes and edits.
- `token_usage` events carrying real token counts and dollar cost, read from `message.usage` on assistant entries in omp's session JSONL. omp's event bus exposes neither, and no cost model is applied here.
- omp tool names mapped to Claude Code's, so tool metrics aggregate across harnesses.
