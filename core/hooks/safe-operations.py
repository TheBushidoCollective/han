#!/usr/bin/env python3
"""
PreToolUse safety hook for Claude Code.

Multi-tiered protection against dangerous operations:
1. Blocks Write/Edit operations outside project directory
2. Blocks dangerous Bash patterns (rm -rf /, system file modifications, etc.)
3. Blocks bash file write workarounds (cat/echo/tee redirects) outside project
4. Provides clear feedback to Claude about why operations were blocked

Note: Due to known Claude Code bugs, Write/Edit blocking may not work reliably.
This hook provides defense-in-depth and Claude-facing feedback regardless.
"""

import json
import os
import re
import sys
from pathlib import Path


# Dangerous bash patterns - operations that could harm the system
DANGEROUS_BASH_PATTERNS = [
    # Destructive operations on root/system paths
    (r'\brm\s+(-[rRfiv]+\s+)*/', "Cannot delete files with absolute paths starting from root"),
    (r'\brm\s+(-[rRfiv]+\s+)*~/', "Cannot delete files in home directory via rm"),
    (r'\brm\s+.*\.\.[/\s]', "Cannot use .. in rm commands - potential path traversal"),

    # System directory modifications
    (r'>\s*/etc/', "Cannot redirect output to /etc/"),
    (r'>\s*/usr/', "Cannot redirect output to /usr/"),
    (r'>\s*/var/', "Cannot redirect output to /var/"),
    (r'>\s*/bin/', "Cannot redirect output to /bin/"),
    (r'>\s*/sbin/', "Cannot redirect output to /sbin/"),
    (r'>\s*/lib/', "Cannot redirect output to /lib/"),
    (r'>\s*/boot/', "Cannot redirect output to /boot/"),
    (r'>\s*/sys/', "Cannot redirect output to /sys/"),
    (r'>\s*/proc/', "Cannot redirect output to /proc/"),
    (r'>\s*/root/', "Cannot redirect output to /root/"),

    # Permission changes on system files
    (r'\bchmod\s+.*\s+/(?:etc|usr|var|bin|sbin|lib|boot)', "Cannot chmod system directories"),
    (r'\bchown\s+.*\s+/(?:etc|usr|var|bin|sbin|lib|boot)', "Cannot chown system directories"),

    # Dangerous operations
    (r'\bdd\s+.*of=/dev/', "Cannot write directly to devices with dd"),
    (r'\bmkfs\b', "Cannot create filesystems"),
    (r'\bfdisk\b', "Cannot modify disk partitions"),
    (r'\bparted\b', "Cannot modify disk partitions"),

    # Process/service manipulation
    (r'\bkillall\s+-9\s+', "Cannot use killall -9"),
    (r'\bpkill\s+-9\s+', "Cannot use pkill -9"),
    (r'\bsystemctl\s+(stop|disable|mask)\s+', "Cannot stop/disable system services"),
    (r'\blaunchctl\s+(unload|remove)\s+', "Cannot unload system services (macOS)"),

    # Network security
    (r'\biptables\s+.*-F', "Cannot flush firewall rules"),
    (r'\bufw\s+disable', "Cannot disable firewall"),

    # Sudo with dangerous commands
    (r'\bsudo\s+rm\s+', "Cannot use sudo rm"),
    (r'\bsudo\s+chmod\s+', "Cannot use sudo chmod"),
    (r'\bsudo\s+chown\s+', "Cannot use sudo chown"),

    # Recursive operations on root
    (r'\bchmod\s+-[rR]\s+/', "Cannot recursive chmod from root"),
    (r'\bchown\s+-[rR]\s+/', "Cannot recursive chown from root"),
    (r'\bfind\s+/\s+.*-delete', "Cannot use find / with -delete"),
    (r'\bfind\s+/\s+.*-exec\s+rm', "Cannot use find / with -exec rm"),
]

# Patterns for file writing via bash (cat, echo, printf, tee with redirection)
# These need project directory checking, handled separately
BASH_WRITE_PATTERNS = [
    (r'>\s*([^\s;|&><]+)', "redirect output"),  # > file
    (r'>>\s*([^\s;|&><]+)', "append output"),   # >> file
    (r'\btee\s+(?:-a\s+)?([^\s;|&><]+)', "tee"),  # tee file
]

# Patterns for file copy/move operations that need project boundary checking
# cp and mv can both read from and write to outside project
BASH_COPY_PATTERNS = [
    # cp source dest - need to check both paths
    r'\bcp\s+(?:-[a-zA-Z]+\s+)*([^\s;|&><]+)\s+([^\s;|&><]+)',
    # mv source dest - need to check both paths
    r'\bmv\s+(?:-[a-zA-Z]+\s+)*([^\s;|&><]+)\s+([^\s;|&><]+)',
]

# Protected directories that files should not be written to
PROTECTED_DIRECTORIES = [
    '/etc',
    '/usr',
    '/var',
    '/bin',
    '/sbin',
    '/lib',
    '/lib64',
    '/boot',
    '/sys',
    '/proc',
    '/dev',
    '/root',
    '/System',  # macOS
    '/Library',  # macOS system Library
    '/Applications',  # macOS
]


def get_project_root() -> str:
    """Get the project root from CLAUDE_PROJECT_DIR environment variable.
    Falls back to cwd only if CLAUDE_PROJECT_DIR is not set.
    """
    return os.environ.get('CLAUDE_PROJECT_DIR') or os.getcwd()


def is_path_outside_project(file_path: str, project_root: str) -> bool:
    """Check if a file path is outside the project directory."""
    try:
        # Resolve to absolute paths
        abs_file = os.path.abspath(os.path.expanduser(file_path))
        abs_project = os.path.abspath(project_root)

        # Allow writes to Claude Config directory (plan files, settings, etc.)
        claude_config_dir = os.path.expanduser(
            os.environ.get('CLAUDE_CONFIG_DIR', '~/.claude')
        )
        abs_claude_config = os.path.abspath(claude_config_dir)
        if abs_file.startswith(abs_claude_config + os.sep) or abs_file == abs_claude_config:
            return False

        # Allow writes to temp directories (standard temp locations - safe)
        if abs_file.startswith('/tmp/') or abs_file.startswith('/private/tmp/'):
            return False

        # Check if file is within project
        return not abs_file.startswith(abs_project + os.sep) and abs_file != abs_project
    except Exception:
        # If we can't resolve the path, be safe and allow it
        # (Claude Code will handle any actual errors)
        return False


def is_protected_path(file_path: str) -> tuple[bool, str]:
    """Check if a file path is in a protected system directory."""
    try:
        abs_path = os.path.abspath(os.path.expanduser(file_path))

        for protected_dir in PROTECTED_DIRECTORIES:
            if abs_path.startswith(protected_dir + os.sep) or abs_path == protected_dir:
                return True, f"Cannot modify files in protected directory: {protected_dir}"

        return False, ""
    except Exception:
        return False, ""


def check_bash_command(command: str) -> tuple[bool, str]:
    """
    Check if a bash command matches any dangerous patterns.
    Returns (is_dangerous, reason).
    """
    for pattern, reason in DANGEROUS_BASH_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return True, reason
    return False, ""


def check_bash_write_paths(command: str, project_root: str) -> tuple[bool, str]:
    """
    Check if a bash command writes to files outside the project directory.
    Returns (is_blocked, reason).
    """
    for pattern, desc in BASH_WRITE_PATTERNS:
        for match in re.finditer(pattern, command, re.IGNORECASE):
            target_path = match.group(1)
            # Skip /dev/null and other /dev paths (allowed for discarding output)
            if target_path.startswith('/dev/'):
                continue
            # Skip /tmp and /private/tmp (standard temp directories - safe)
            if target_path.startswith('/tmp/') or target_path.startswith('/private/tmp/'):
                continue
            # Skip if not an absolute path (relative paths are within project)
            if not target_path.startswith('/'):
                continue
            # Check for protected paths
            is_protected, reason = is_protected_path(target_path)
            if is_protected:
                return True, f"Cannot {desc} to protected path: {target_path}"
            # Check if outside project
            if is_path_outside_project(target_path, project_root):
                return True, f"Cannot {desc} to '{target_path}' - path is outside project directory"
    return False, ""


def check_bash_copy_operations(command: str, project_root: str) -> tuple[bool, str]:
    """
    Check if cp/mv commands access files outside the project directory.
    Blocks both reading from and writing to paths outside the project.
    Returns (is_blocked, reason).
    """
    for pattern in BASH_COPY_PATTERNS:
        for match in re.finditer(pattern, command, re.IGNORECASE):
            source_path = match.group(1)
            dest_path = match.group(2)

            # Expand ~ to home directory for checking
            source_expanded = os.path.expanduser(source_path)
            dest_expanded = os.path.expanduser(dest_path)

            # Check source path (reading from outside project)
            if source_path.startswith('~') or source_path.startswith('/'):
                # Skip /tmp paths
                if source_expanded.startswith('/tmp/') or source_expanded.startswith('/private/tmp/'):
                    pass
                elif is_path_outside_project(source_expanded, project_root):
                    return True, f"Cannot copy/move from '{source_path}' - source is outside project directory"

            # Check destination path (writing to outside project)
            if dest_path.startswith('~') or dest_path.startswith('/'):
                # Skip /tmp paths
                if dest_expanded.startswith('/tmp/') or dest_expanded.startswith('/private/tmp/'):
                    pass
                # Check for protected paths
                elif is_protected_path(dest_expanded)[0]:
                    return True, f"Cannot copy/move to protected path: {dest_path}"
                elif is_path_outside_project(dest_expanded, project_root):
                    return True, f"Cannot copy/move to '{dest_path}' - destination is outside project directory"

    return False, ""


def deny_tool(reason: str) -> None:
    """Output JSON to deny the tool execution."""
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason
        }
    }
    print(json.dumps(output))
    sys.exit(0)


def allow_tool() -> None:
    """Exit without blocking - allow normal permission flow."""
    sys.exit(0)


def main():
    # Read input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        # Can't parse input - allow normal flow
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    # Prioritize CLAUDE_PROJECT_DIR over input cwd for accurate project boundary
    env_project_dir = os.environ.get('CLAUDE_PROJECT_DIR')
    project_root = env_project_dir or input_data.get("cwd") or os.getcwd()

    # Check Write/Edit tools for path safety
    if tool_name in ("Write", "Edit"):
        file_path = tool_input.get("file_path", "")

        if not file_path:
            allow_tool()

        # Check for protected system directories
        is_protected, reason = is_protected_path(file_path)
        if is_protected:
            deny_tool(f"🛡️ BLOCKED: {reason}")

        # Check if outside project directory
        if is_path_outside_project(file_path, project_root):
            deny_tool(
                f"🛡️ BLOCKED: Cannot write to '{file_path}' - "
                f"path is outside project directory '{project_root}'"
            )

    # Check Bash commands for dangerous patterns
    if tool_name == "Bash":
        command = tool_input.get("command", "")

        if not command:
            allow_tool()

        is_dangerous, reason = check_bash_command(command)
        if is_dangerous:
            deny_tool(f"🛡️ BLOCKED: {reason}\nCommand: {command}")

        # Check for bash write operations outside project
        is_blocked, reason = check_bash_write_paths(command, project_root)
        if is_blocked:
            deny_tool(f"🛡️ BLOCKED: {reason}\nCommand: {command}")

        # Check for cp/mv operations outside project
        is_blocked, reason = check_bash_copy_operations(command, project_root)
        if is_blocked:
            deny_tool(f"🛡️ BLOCKED: {reason}\nCommand: {command}")

    # All checks passed - allow normal permission flow
    allow_tool()


if __name__ == "__main__":
    main()
