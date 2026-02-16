//! Hook discovery - finds and parses hooks.json from installed plugins.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DiscoveryError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON parse error: {0}")]
    Json(#[from] serde_json::Error),
}

/// A hook definition from hooks.json.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookDef {
    #[serde(rename = "type")]
    pub hook_type: String,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub prompt: Option<String>,
    #[serde(default)]
    pub timeout: Option<u64>,
}

/// A hook event group with optional matcher.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookEventGroup {
    #[serde(default)]
    pub matcher: Option<String>,
    pub hooks: Vec<HookDef>,
}

/// The top-level hooks.json structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HooksJson {
    pub hooks: HashMap<String, Vec<HookEventGroup>>,
}

/// A discovered hook with its plugin context.
#[derive(Debug, Clone)]
pub struct DiscoveredHook {
    pub plugin_name: String,
    pub plugin_root: PathBuf,
    pub event: String,
    pub matcher: Option<String>,
    pub hook_type: String,
    pub command: Option<String>,
    pub prompt: Option<String>,
    pub timeout: Option<u64>,
}

/// Discover all hooks from installed Claude Code plugins.
///
/// Scans both user-level (`~/.claude/plugins/`) and project-level plugin directories.
pub fn discover_hooks(project_path: Option<&Path>) -> Result<Vec<DiscoveredHook>, DiscoveryError> {
    let mut all_hooks = Vec::new();

    // Scan user plugins
    if let Some(home) = dirs::home_dir() {
        let user_plugins = home.join(".claude").join("plugins");
        if user_plugins.exists() {
            scan_plugins_dir(&user_plugins, &mut all_hooks)?;
        }
    }

    // Scan project plugins
    if let Some(project) = project_path {
        let project_plugins = project.join(".claude").join("plugins");
        if project_plugins.exists() {
            scan_plugins_dir(&project_plugins, &mut all_hooks)?;
        }
    }

    Ok(all_hooks)
}

/// Find hooks matching a specific event and optional tool name.
pub fn find_matching_hooks(
    hooks: &[DiscoveredHook],
    event: &str,
    tool_name: Option<&str>,
) -> Vec<DiscoveredHook> {
    hooks
        .iter()
        .filter(|h| {
            if h.event != event {
                return false;
            }
            if let (Some(matcher), Some(tool)) = (&h.matcher, tool_name) {
                matcher.split('|').any(|m| m.trim() == tool)
            } else if h.matcher.is_some() && tool_name.is_none() {
                false
            } else {
                true
            }
        })
        .cloned()
        .collect()
}

/// Scan a plugins directory for hooks.json files.
fn scan_plugins_dir(
    plugins_dir: &Path,
    hooks: &mut Vec<DiscoveredHook>,
) -> Result<(), DiscoveryError> {
    let entries = std::fs::read_dir(plugins_dir)?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let plugin_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        // Check for hooks.json at standard locations
        let hooks_paths = [
            path.join("hooks").join("hooks.json"),
            path.join(".claude-plugin").join("hooks.json"),
            path.join("hooks.json"),
        ];

        for hooks_path in &hooks_paths {
            if hooks_path.exists() {
                match parse_hooks_json(hooks_path, &plugin_name, &path) {
                    Ok(discovered) => hooks.extend(discovered),
                    Err(e) => {
                        tracing::warn!(
                            "Failed to parse hooks.json at {:?}: {}",
                            hooks_path,
                            e
                        );
                    }
                }
                break;
            }
        }
    }

    Ok(())
}

/// Parse a hooks.json file and return discovered hooks.
fn parse_hooks_json(
    hooks_path: &Path,
    plugin_name: &str,
    plugin_root: &Path,
) -> Result<Vec<DiscoveredHook>, DiscoveryError> {
    let content = std::fs::read_to_string(hooks_path)?;
    let hooks_json: HooksJson = serde_json::from_str(&content)?;

    let mut discovered = Vec::new();

    for (event, groups) in &hooks_json.hooks {
        for group in groups {
            for hook in &group.hooks {
                discovered.push(DiscoveredHook {
                    plugin_name: plugin_name.to_string(),
                    plugin_root: plugin_root.to_path_buf(),
                    event: event.clone(),
                    matcher: group.matcher.clone(),
                    hook_type: hook.hook_type.clone(),
                    command: hook.command.clone(),
                    prompt: hook.prompt.clone(),
                    timeout: hook.timeout,
                });
            }
        }
    }

    Ok(discovered)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_parse_hooks_json() {
        let dir = TempDir::new().unwrap();
        let hooks_path = dir.path().join("hooks.json");
        std::fs::write(
            &hooks_path,
            r#"{
                "hooks": {
                    "Stop": [{
                        "hooks": [{
                            "type": "command",
                            "command": "npm run lint",
                            "timeout": 60000
                        }]
                    }],
                    "PostToolUse": [{
                        "matcher": "Edit|Write",
                        "hooks": [{
                            "type": "command",
                            "command": "npx biome check"
                        }]
                    }]
                }
            }"#,
        )
        .unwrap();

        let hooks = parse_hooks_json(&hooks_path, "test-plugin", dir.path()).unwrap();
        assert_eq!(hooks.len(), 2);

        let stop_hooks: Vec<_> = hooks.iter().filter(|h| h.event == "Stop").collect();
        assert_eq!(stop_hooks.len(), 1);
        assert_eq!(stop_hooks[0].command.as_deref(), Some("npm run lint"));
        assert_eq!(stop_hooks[0].timeout, Some(60000));

        let post_hooks: Vec<_> = hooks.iter().filter(|h| h.event == "PostToolUse").collect();
        assert_eq!(post_hooks.len(), 1);
        assert_eq!(post_hooks[0].matcher.as_deref(), Some("Edit|Write"));
    }

    #[test]
    fn test_find_matching_hooks() {
        let hooks = vec![
            DiscoveredHook {
                plugin_name: "biome".into(),
                plugin_root: PathBuf::from("/test"),
                event: "Stop".into(),
                matcher: None,
                hook_type: "command".into(),
                command: Some("npx biome check".into()),
                prompt: None,
                timeout: None,
            },
            DiscoveredHook {
                plugin_name: "biome".into(),
                plugin_root: PathBuf::from("/test"),
                event: "PostToolUse".into(),
                matcher: Some("Edit|Write".into()),
                hook_type: "command".into(),
                command: Some("npx biome check".into()),
                prompt: None,
                timeout: None,
            },
        ];

        // Stop event matches (no matcher needed)
        let matched = find_matching_hooks(&hooks, "Stop", None);
        assert_eq!(matched.len(), 1);

        // PostToolUse with Edit matches
        let matched = find_matching_hooks(&hooks, "PostToolUse", Some("Edit"));
        assert_eq!(matched.len(), 1);

        // PostToolUse with Bash doesn't match
        let matched = find_matching_hooks(&hooks, "PostToolUse", Some("Bash"));
        assert_eq!(matched.len(), 0);

        // PostToolUse without tool name doesn't match (matcher requires tool)
        let matched = find_matching_hooks(&hooks, "PostToolUse", None);
        assert_eq!(matched.len(), 0);
    }

    #[test]
    fn test_parse_hooks_json_empty_hooks_object() {
        let dir = TempDir::new().unwrap();
        let hooks_path = dir.path().join("hooks.json");
        std::fs::write(&hooks_path, r#"{"hooks": {}}"#).unwrap();

        let hooks = parse_hooks_json(&hooks_path, "empty-plugin", dir.path()).unwrap();
        assert!(hooks.is_empty());
    }

    #[test]
    fn test_parse_hooks_json_multiple_events() {
        let dir = TempDir::new().unwrap();
        let hooks_path = dir.path().join("hooks.json");
        std::fs::write(
            &hooks_path,
            r#"{
                "hooks": {
                    "SessionStart": [{
                        "hooks": [{
                            "type": "command",
                            "command": "echo starting"
                        }]
                    }],
                    "Stop": [{
                        "hooks": [{
                            "type": "command",
                            "command": "npm run lint",
                            "timeout": 30000
                        }]
                    }],
                    "PreToolUse": [{
                        "matcher": "Bash",
                        "hooks": [{
                            "type": "command",
                            "command": "echo pre-tool"
                        }]
                    }]
                }
            }"#,
        )
        .unwrap();

        let hooks = parse_hooks_json(&hooks_path, "multi-plugin", dir.path()).unwrap();
        assert_eq!(hooks.len(), 3);

        let session_start: Vec<_> = hooks.iter().filter(|h| h.event == "SessionStart").collect();
        assert_eq!(session_start.len(), 1);
        assert_eq!(session_start[0].command.as_deref(), Some("echo starting"));
        assert_eq!(session_start[0].plugin_name, "multi-plugin");

        let stop: Vec<_> = hooks.iter().filter(|h| h.event == "Stop").collect();
        assert_eq!(stop.len(), 1);
        assert_eq!(stop[0].timeout, Some(30000));

        let pre_tool: Vec<_> = hooks.iter().filter(|h| h.event == "PreToolUse").collect();
        assert_eq!(pre_tool.len(), 1);
        assert_eq!(pre_tool[0].matcher.as_deref(), Some("Bash"));
    }

    #[test]
    fn test_parse_hooks_json_prompt_type_hooks() {
        let dir = TempDir::new().unwrap();
        let hooks_path = dir.path().join("hooks.json");
        std::fs::write(
            &hooks_path,
            r#"{
                "hooks": {
                    "SessionStart": [{
                        "hooks": [{
                            "type": "prompt",
                            "prompt": "Remember to follow coding standards."
                        }]
                    }]
                }
            }"#,
        )
        .unwrap();

        let hooks = parse_hooks_json(&hooks_path, "prompt-plugin", dir.path()).unwrap();
        assert_eq!(hooks.len(), 1);
        assert_eq!(hooks[0].hook_type, "prompt");
        assert_eq!(
            hooks[0].prompt.as_deref(),
            Some("Remember to follow coding standards.")
        );
        assert!(hooks[0].command.is_none());
    }

    #[test]
    fn test_find_matching_hooks_pipe_separated_matchers() {
        let hooks = vec![DiscoveredHook {
            plugin_name: "validator".into(),
            plugin_root: PathBuf::from("/test"),
            event: "PostToolUse".into(),
            matcher: Some("Edit|Write|Bash".into()),
            hook_type: "command".into(),
            command: Some("echo validated".into()),
            prompt: None,
            timeout: None,
        }];

        // Each tool in the pipe-separated matcher should match
        let matched = find_matching_hooks(&hooks, "PostToolUse", Some("Edit"));
        assert_eq!(matched.len(), 1);

        let matched = find_matching_hooks(&hooks, "PostToolUse", Some("Write"));
        assert_eq!(matched.len(), 1);

        let matched = find_matching_hooks(&hooks, "PostToolUse", Some("Bash"));
        assert_eq!(matched.len(), 1);

        // A tool not in the list should not match
        let matched = find_matching_hooks(&hooks, "PostToolUse", Some("Read"));
        assert_eq!(matched.len(), 0);

        let matched = find_matching_hooks(&hooks, "PostToolUse", Some("Glob"));
        assert_eq!(matched.len(), 0);
    }

    #[test]
    fn test_find_matching_hooks_empty_matcher_string() {
        let hooks = vec![DiscoveredHook {
            plugin_name: "test".into(),
            plugin_root: PathBuf::from("/test"),
            event: "PostToolUse".into(),
            matcher: Some("".into()),
            hook_type: "command".into(),
            command: Some("echo test".into()),
            prompt: None,
            timeout: None,
        }];

        // Empty matcher with a tool name: the split produces [""], which does not match "Bash"
        let matched = find_matching_hooks(&hooks, "PostToolUse", Some("Bash"));
        assert_eq!(matched.len(), 0);

        // Empty matcher with no tool name: matcher is Some but tool_name is None => no match
        let matched = find_matching_hooks(&hooks, "PostToolUse", None);
        assert_eq!(matched.len(), 0);
    }

    #[test]
    fn test_find_matching_hooks_no_hooks() {
        let hooks: Vec<DiscoveredHook> = Vec::new();
        let matched = find_matching_hooks(&hooks, "Stop", None);
        assert!(matched.is_empty());
    }

    #[test]
    fn test_find_matching_hooks_wrong_event() {
        let hooks = vec![DiscoveredHook {
            plugin_name: "test".into(),
            plugin_root: PathBuf::from("/test"),
            event: "Stop".into(),
            matcher: None,
            hook_type: "command".into(),
            command: Some("echo test".into()),
            prompt: None,
            timeout: None,
        }];

        let matched = find_matching_hooks(&hooks, "SessionStart", None);
        assert!(matched.is_empty());
    }
}
