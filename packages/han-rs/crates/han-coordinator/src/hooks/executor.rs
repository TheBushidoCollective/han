//! Hook command execution with streaming output.
//!
//! Executes hook commands as child processes via `tokio::process::Command`,
//! streaming stdout/stderr lines in real-time.

use std::path::Path;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;
use thiserror::Error;

const DEFAULT_TIMEOUT_MS: u64 = 30_000;

#[derive(Error, Debug)]
pub enum ExecutorError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Hook timed out after {0}ms")]
    Timeout(u64),
    #[error("Hook exited with code {0}")]
    NonZeroExit(i32),
}

/// Output line from a hook execution.
#[derive(Debug, Clone)]
pub enum HookOutputLine {
    Stdout(String),
    Stderr(String),
    Complete {
        exit_code: i32,
        duration_ms: u64,
    },
    Error(String),
}

/// Execute a hook command with streaming output.
///
/// Sends `HookOutputLine` messages through the channel as stdout/stderr lines arrive.
/// The final message is always a `Complete` or `Error`.
pub async fn execute_hook(
    command: &str,
    cwd: Option<&Path>,
    env: &[(String, String)],
    timeout_ms: Option<u64>,
    output_tx: mpsc::Sender<HookOutputLine>,
) -> Result<i32, ExecutorError> {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));
    let start = std::time::Instant::now();

    let mut cmd = Command::new("bash");
    cmd.arg("-c").arg(command);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    for (key, value) in env {
        cmd.env(key, value);
    }

    let mut child = cmd.spawn()?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let stdout_tx = output_tx.clone();
    let stderr_tx = output_tx.clone();

    // Stream stdout
    let stdout_handle = tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if stdout_tx.send(HookOutputLine::Stdout(line)).await.is_err() {
                break;
            }
        }
    });

    // Stream stderr
    let stderr_handle = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if stderr_tx.send(HookOutputLine::Stderr(line)).await.is_err() {
                break;
            }
        }
    });

    // Wait for process with timeout
    let result = tokio::time::timeout(timeout, child.wait()).await;

    let duration_ms = start.elapsed().as_millis() as u64;

    match result {
        Ok(Ok(status)) => {
            // Wait for stream handles to finish
            let _ = stdout_handle.await;
            let _ = stderr_handle.await;

            let exit_code = status.code().unwrap_or(-1);
            let _ = output_tx
                .send(HookOutputLine::Complete {
                    exit_code,
                    duration_ms,
                })
                .await;
            Ok(exit_code)
        }
        Ok(Err(e)) => {
            let _ = output_tx
                .send(HookOutputLine::Error(format!("Process error: {}", e)))
                .await;
            Err(ExecutorError::Io(e))
        }
        Err(_) => {
            // Timeout - kill the process
            let _ = child.kill().await;
            let _ = output_tx
                .send(HookOutputLine::Error(format!(
                    "Timed out after {}ms",
                    timeout.as_millis()
                )))
                .await;
            Err(ExecutorError::Timeout(timeout.as_millis() as u64))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;

    #[tokio::test]
    async fn test_execute_simple_command() {
        let (tx, mut rx) = mpsc::channel(100);

        let result = execute_hook("echo hello", None, &[], Some(5000), tx).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 0);

        let mut stdout_lines = Vec::new();
        let mut got_complete = false;

        while let Ok(msg) = rx.try_recv() {
            match msg {
                HookOutputLine::Stdout(line) => stdout_lines.push(line),
                HookOutputLine::Complete { exit_code, .. } => {
                    assert_eq!(exit_code, 0);
                    got_complete = true;
                }
                _ => {}
            }
        }

        assert!(got_complete);
        assert_eq!(stdout_lines, vec!["hello"]);
    }

    #[tokio::test]
    async fn test_execute_failing_command() {
        let (tx, mut rx) = mpsc::channel(100);

        let result = execute_hook("exit 42", None, &[], Some(5000), tx).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);

        let mut got_complete = false;
        while let Ok(msg) = rx.try_recv() {
            if let HookOutputLine::Complete { exit_code, .. } = msg {
                assert_eq!(exit_code, 42);
                got_complete = true;
            }
        }
        assert!(got_complete);
    }

    #[tokio::test]
    async fn test_execute_stderr() {
        let (tx, mut rx) = mpsc::channel(100);

        let result = execute_hook("echo error >&2", None, &[], Some(5000), tx).await;
        assert!(result.is_ok());

        let mut stderr_lines = Vec::new();
        while let Ok(msg) = rx.try_recv() {
            if let HookOutputLine::Stderr(line) = msg {
                stderr_lines.push(line);
            }
        }

        assert_eq!(stderr_lines, vec!["error"]);
    }

    #[tokio::test]
    async fn test_execute_timeout() {
        let (tx, _rx) = mpsc::channel(100);

        let result = execute_hook("sleep 30", None, &[], Some(100), tx).await;
        assert!(matches!(result, Err(ExecutorError::Timeout(_))));
    }

    #[tokio::test]
    async fn test_execute_with_env() {
        let (tx, mut rx) = mpsc::channel(100);

        let env = vec![("MY_VAR".to_string(), "test_value".to_string())];
        let result = execute_hook("echo $MY_VAR", None, &env, Some(5000), tx).await;
        assert!(result.is_ok());

        let mut stdout_lines = Vec::new();
        while let Ok(msg) = rx.try_recv() {
            if let HookOutputLine::Stdout(line) = msg {
                stdout_lines.push(line);
            }
        }
        assert_eq!(stdout_lines, vec!["test_value"]);
    }

    #[tokio::test]
    async fn test_execute_with_cwd() {
        let dir = tempfile::TempDir::new().unwrap();
        let (tx, mut rx) = mpsc::channel(100);

        let result = execute_hook("pwd", Some(dir.path()), &[], Some(5000), tx).await;
        assert!(result.is_ok());

        let mut stdout_lines = Vec::new();
        while let Ok(msg) = rx.try_recv() {
            if let HookOutputLine::Stdout(line) = msg {
                stdout_lines.push(line);
            }
        }

        // The output should contain our temp dir path
        assert!(!stdout_lines.is_empty());
    }
}
