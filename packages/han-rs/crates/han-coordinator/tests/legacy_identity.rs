use han_coordinator::legacy_identity::*;
use std::net::TcpListener;
use std::process::Command;
use std::time::Duration;

#[test]
fn test_legacy_identity_listener_attribution() {
    // 1. Bind a TCP listener on 0.0.0.0 (dynamic port)
    let listener = TcpListener::bind("0.0.0.0:0").expect("Failed to bind test listener");
    let port = listener.local_addr().expect("local_addr").port();

    // 2. Discover listeners for port
    let discovered = listeners(port).expect("Failed to discover listeners");
    assert!(!discovered.is_empty(), "Expected to find listener on port {}", port);

    let my_pid = std::process::id();
    let found = discovered.iter().any(|l| l.port == port && l.owners.contains(&my_pid));
    assert!(found, "Discovered listeners should include current process PID");

    // 3. Pin current process
    let pinned = pin(my_pid).expect("Failed to pin current process");
    let f = facts(&pinned).expect("Failed to get facts for current process");
    assert_eq!(f.pid, my_pid);
    assert!(f.same_user, "Current process must be same user");
    assert!(!f.start_time.is_empty(), "Start time must not be empty");

    // 4. Confirm facts match pinned process
    let ok = confirm(&pinned, &f).expect("Failed to confirm facts");
    assert!(ok, "Confirm should return true for live matching process");

    drop(listener);
}

#[test]
fn test_legacy_identity_pin_child_lifecycle() {
    // Spawn a short-lived child process
    #[cfg(unix)]
    let mut child = Command::new("sleep")
        .arg("2")
        .spawn()
        .expect("Failed to spawn child");

    #[cfg(windows)]
    let mut child = Command::new("ping")
        .args(&["127.0.0.1", "-n", "3"])
        .spawn()
        .expect("Failed to spawn child");

    let child_pid = child.id();
    let pinned = pin(child_pid).expect("Failed to pin child process");
    let f = facts(&pinned).expect("Failed to read child facts");
    assert_eq!(f.pid, child_pid);

    let confirmed = confirm(&pinned, &f).expect("Confirm live child");
    assert!(confirmed, "Child must be confirmed while alive");

    // Kill and reap child
    let _ = child.kill();
    let _ = child.wait();

    let exit_seen = wait_exit(&pinned, Duration::from_secs(3)).expect("wait_exit");
    assert!(exit_seen, "wait_exit should report true after process termination");

    let confirmed_after = confirm(&pinned, &f).expect("Confirm dead child");
    assert!(!confirmed_after, "confirm must return false after child exits");
}
