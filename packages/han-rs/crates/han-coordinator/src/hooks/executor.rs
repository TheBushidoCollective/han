//! Hook command execution with streaming output.
//!
//! Executes hook commands as child processes via `tokio::process::Command`,
//! streaming stdout/stderr lines in real-time.

use std::path::Path;
use std::time::Duration;
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;

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
    Complete { exit_code: i32, duration_ms: u64 },
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
    #[cfg(windows)]
    cmd.creation_flags(windows_sys::Win32::System::Threading::CREATE_NO_WINDOW);

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

    #[tokio::test]
    async fn test_execute_invalid_command() {
        let (tx, mut rx) = mpsc::channel(100);

        // Use a command that does not exist; bash -c will return exit code 127
        let result = execute_hook(
            "totally_nonexistent_command_xyz_12345",
            None,
            &[],
            Some(5000),
            tx,
        )
        .await;

        assert!(result.is_ok());
        let exit_code = result.unwrap();
        assert_ne!(exit_code, 0); // bash returns 127 for command not found

        let mut got_complete = false;
        let mut stderr_lines = Vec::new();
        while let Ok(msg) = rx.try_recv() {
            match msg {
                HookOutputLine::Complete { exit_code, .. } => {
                    assert_ne!(exit_code, 0);
                    got_complete = true;
                }
                HookOutputLine::Stderr(line) => stderr_lines.push(line),
                _ => {}
            }
        }
        assert!(got_complete);
        // bash should emit a "not found" message on stderr
        assert!(
            stderr_lines.iter().any(|l| l.contains("not found")),
            "Expected 'not found' in stderr, got: {:?}",
            stderr_lines
        );
    }

    #[tokio::test]
    async fn test_execute_multiline_output() {
        let (tx, mut rx) = mpsc::channel(100);

        let result = execute_hook(
            "printf 'line1\\nline2\\nline3\\n'",
            None,
            &[],
            Some(5000),
            tx,
        )
        .await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 0);

        let mut stdout_lines = Vec::new();
        while let Ok(msg) = rx.try_recv() {
            if let HookOutputLine::Stdout(line) = msg {
                stdout_lines.push(line);
            }
        }

        assert_eq!(stdout_lines, vec!["line1", "line2", "line3"]);
    }

    #[cfg(windows)]
    #[test]
    fn windows_console_probe_fixture() {
        if std::env::var_os("HAN_TEST_CONSOLE_PROBE").is_none() {
            return;
        }
        let nonce = std::env::var("HAN_TEST_NONCE").unwrap_or_default();
        unsafe {
            let cp = windows_sys::Win32::System::Console::GetConsoleCP();
            let hwnd = windows_sys::Win32::System::Console::GetConsoleWindow();
            let mut pids = [0u32; 16];
            let count = windows_sys::Win32::System::Console::GetConsoleProcessList(
                pids.as_mut_ptr(),
                pids.len() as u32,
            );
            println!("PROBE:{}:{}:{}:{}", nonce, cp, hwnd as isize, count);
        }
    }

    #[cfg(windows)]
    #[test]
    fn windows_hook_spawn_creates_no_window() {
        use std::process::Command;
        use std::os::windows::process::CommandExt;

        if std::env::var_os("HAN_TEST_DETACHED_HARNESS").is_some() {
            // Running inside the detached harness.
            // Precondition 1: The detached harness must have no console (GetConsoleCP == 0).
            let harness_cp = unsafe { windows_sys::Win32::System::Console::GetConsoleCP() };
            assert_eq!(
                harness_cp, 0,
                "harness must be detached with no console, got cp {}",
                harness_cp
            );

            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();

            rt.block_on(async {
                let exe = std::env::current_exe().unwrap();
                let exe_str = exe.to_string_lossy().to_string();
                let git_bash_path = r"C:\Program Files\Git\bin";
                let path_env = match std::env::var("PATH") {
                    Ok(p) => format!("{};{}", git_bash_path, p),
                    Err(_) => git_bash_path.to_string(),
                };

                let probe_cmd = format!(
                    "\"{}\" --exact hooks::executor::tests::windows_console_probe_fixture --nocapture",
                    exe_str.replace('\\', "/")
                );

                // 1. Positive run: execute_hook uses CREATE_NO_WINDOW
                let pos_nonce = "pos-nonce-42";
                let pos_env = vec![
                    ("HAN_TEST_CONSOLE_PROBE".to_string(), "1".to_string()),
                    ("HAN_TEST_NONCE".to_string(), pos_nonce.to_string()),
                    ("PATH".to_string(), path_env.clone()),
                    ("MSYS2_ARG_CONV_EXCL".to_string(), "*".to_string()),
                ];

                let (tx, mut rx) = mpsc::channel(100);
                let pos_res = execute_hook(&probe_cmd, None, &pos_env, Some(10000), tx).await;
                let mut stdout_lines = Vec::new();
                let mut stderr_lines = Vec::new();
                while let Ok(msg) = rx.try_recv() {
                    match msg {
                        HookOutputLine::Stdout(l) => stdout_lines.push(l),
                        HookOutputLine::Stderr(l) => stderr_lines.push(l),
                        _ => {}
                    }
                }

                assert_eq!(
                    pos_res.as_ref().copied().unwrap_or(-1),
                    0,
                    "positive execute_hook failed: res={:?}, stderr={:?}",
                    pos_res,
                    stderr_lines
                );

                let pos_prefix = format!("PROBE:{}:", pos_nonce);
                let pos_line = stdout_lines
                    .iter()
                    .find_map(|l| {
                        l.find(&pos_prefix)
                            .map(|idx| &l[idx..])
                    })
                    .unwrap_or_else(|| {
                        panic!(
                            "missing positive probe line; stdout={:?}, stderr={:?}",
                            stdout_lines, stderr_lines
                        )
                    });

                let pos_parts: Vec<&str> = pos_line.split(':').collect();
                let pos_cp: u32 = pos_parts[2].parse().unwrap();
                let pos_hwnd: isize = pos_parts[3].parse().unwrap();
                let pos_procs: u32 = pos_parts[4].parse().unwrap();

                assert_ne!(pos_cp, 0, "hook must have a console (GetConsoleCP != 0)");
                assert_eq!(
                    pos_hwnd, 0,
                    "hook window must be NULL with CREATE_NO_WINDOW, got {}",
                    pos_hwnd
                );
                assert!(
                    pos_procs >= 2,
                    "hook console must have at least 2 processes (bash + probe), got {}",
                    pos_procs
                );

                // 2. Negative control: plain tokio Command::new("bash") without CREATE_NO_WINDOW
                let neg_nonce = "neg-nonce-99";
                let mut neg_cmd = tokio::process::Command::new("bash");
                neg_cmd.arg("-c").arg(&probe_cmd);
                neg_cmd.stdout(std::process::Stdio::piped());
                neg_cmd.stderr(std::process::Stdio::piped());
                neg_cmd.env("HAN_TEST_CONSOLE_PROBE", "1");
                neg_cmd.env("HAN_TEST_NONCE", neg_nonce);
                neg_cmd.env("PATH", &path_env);
                neg_cmd.env("MSYS2_ARG_CONV_EXCL", "*");

                let neg_child = neg_cmd.spawn().expect("failed to spawn negative bash control");
                let neg_output = neg_child
                    .wait_with_output()
                    .await
                    .expect("failed to wait on negative bash control");
                let neg_stdout = String::from_utf8_lossy(&neg_output.stdout);
                let neg_stderr = String::from_utf8_lossy(&neg_output.stderr);

                let neg_prefix = format!("PROBE:{}:", neg_nonce);
                let neg_line = neg_stdout
                    .lines()
                    .find_map(|l| {
                        l.find(&neg_prefix)
                            .map(|idx| &l[idx..])
                    })
                    .unwrap_or_else(|| {
                        panic!(
                            "missing negative probe line; stdout={}, stderr={}",
                            neg_stdout, neg_stderr
                        )
                    });

                let neg_parts: Vec<&str> = neg_line.split(':').collect();
                let neg_hwnd: isize = neg_parts[3].parse().unwrap();
                assert_ne!(
                    neg_hwnd, 0,
                    "negative control without CREATE_NO_WINDOW must have a non-NULL window"
                );
            });
                println!("HARNESS-INNER-OK");
            return;
        }

        // Parent harness launcher: spawn self with DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
        let exe = std::env::current_exe().unwrap();
        let mut harness = Command::new(exe);
        harness.args([
            "--exact",
            "hooks::executor::tests::windows_hook_spawn_creates_no_window",
            "--nocapture",
        ]);
        harness.env("HAN_TEST_DETACHED_HARNESS", "1");
        harness.stdout(std::process::Stdio::piped());
        harness.stderr(std::process::Stdio::piped());

        // DETACHED_PROCESS (0x00000008) | CREATE_NEW_PROCESS_GROUP (0x00000200)
        let detached_flags = 0x0000_0008 | 0x0000_0200;
        harness.creation_flags(detached_flags);

        let output = harness
            .output()
            .expect("failed to execute detached harness");

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        assert!(
            output.status.success(),
            "detached harness failed with status {:?}\nSTDOUT:\n{}\nSTDERR:\n{}",
            output.status,
            stdout,
            stderr
        );
        assert!(
            stdout.contains("HARNESS-INNER-OK"),
            "detached harness did not execute inner tests\nSTDOUT:\n{}\nSTDERR:\n{}",
            stdout,
            stderr
        );
    }
}
