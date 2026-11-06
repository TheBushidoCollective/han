//! Windows process identities. A PID alone is never authority to signal or reclaim.
//!
//! The caller must additionally validate the complete supervisor binding and nonce.
//! All observations are snapshots: callers must serialize ownership changes under
//! the publication lock, and must not turn an error or `Unknown` into `Gone`.

use std::io;
use std::mem::{size_of, zeroed};
use std::ptr::null_mut;

use serde::{Deserialize, Serialize};
use windows_sys::Win32::Foundation::{
    CloseHandle, LocalFree, ERROR_ACCESS_DENIED, ERROR_INSUFFICIENT_BUFFER,
    ERROR_INVALID_PARAMETER, FILETIME, HANDLE, INVALID_HANDLE_VALUE, WAIT_OBJECT_0,
    WAIT_TIMEOUT,
};
use windows_sys::Win32::Security::Authorization::{ConvertSidToStringSidW, ConvertStringSidToSidW};
use windows_sys::Win32::Security::{GetTokenInformation, TokenUser, TOKEN_QUERY, TOKEN_USER};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
    TH32CS_SNAPPROCESS,
};
use windows_sys::Win32::System::Threading::{
    GetCurrentProcessId, GetProcessId, GetProcessTimes, OpenProcess, OpenProcessToken,
    WaitForSingleObject, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE,
};

/// An identity captured from one open process handle, not from a PID lookup alone.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ProcessIdentity {
    pub(crate) pid: u32,
    /// Unsigned decimal count of 100-nanosecond intervals since the FILETIME epoch.
    pub(crate) creation_time: String,
    pub(crate) user_sid: String,
}

/// `Unknown` includes access denied. It must not authorize stale-owner cleanup.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Liveness {
    Alive,
    Gone,
    Unknown,
}

struct OwnedHandle(HANDLE);
impl Drop for OwnedHandle {
    fn drop(&mut self) {
        unsafe { CloseHandle(self.0); }
    }
}

struct LocalAllocation(*mut core::ffi::c_void);
impl Drop for LocalAllocation {
    fn drop(&mut self) {
        unsafe { LocalFree(self.0); }
    }
}

fn invalid(message: &'static str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

fn open_process(pid: u32) -> io::Result<OwnedHandle> {
    if pid == 0 {
        return Err(invalid("zero process ID"));
    }
    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE, 0, pid) };
    if handle.is_null() {
        Err(io::Error::last_os_error())
    } else {
        Ok(OwnedHandle(handle))
    }
}

fn creation_time(handle: HANDLE) -> io::Result<u64> {
    let (mut created, mut exited, mut kernel, mut user) = (FILETIME::default(), FILETIME::default(), FILETIME::default(), FILETIME::default());
    if unsafe { GetProcessTimes(handle, &mut created, &mut exited, &mut kernel, &mut user) } == 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(((created.dwHighDateTime as u64) << 32) | created.dwLowDateTime as u64)
}

fn sid_string(sid: *mut core::ffi::c_void) -> io::Result<String> {
    let mut text = null_mut();
    if unsafe { ConvertSidToStringSidW(sid, &mut text) } == 0 {
        return Err(io::Error::last_os_error());
    }
    let _allocation = LocalAllocation(text.cast());
    if text.is_null() {
        return Err(invalid("SID conversion returned null"));
    }
    // A Windows SID's textual form fits well within this bound.
    let mut len = 0;
    while len < 256 && unsafe { *text.add(len) } != 0 { len += 1; }
    if len == 256 {
        return Err(invalid("unterminated SID"));
    }
    String::from_utf16(unsafe { std::slice::from_raw_parts(text, len) })
        .map_err(|_| invalid("invalid SID text"))
}

pub(crate) fn validate_identity(identity: &ProcessIdentity) -> io::Result<()> {
    if identity.pid == 0 || identity.creation_time.is_empty() || identity.creation_time.len() > 20 {
        return Err(invalid("invalid process identity"));
    }
    let created = identity.creation_time.parse::<u64>().map_err(|_| invalid("invalid creation time"))?;
    if created == 0 || created.to_string() != identity.creation_time {
        return Err(invalid("noncanonical creation time"));
    }
    if identity.user_sid.is_empty() || identity.user_sid.len() > 256 || identity.user_sid.contains('\0') {
        return Err(invalid("invalid user SID"));
    }
    let text: Vec<u16> = identity.user_sid.encode_utf16().chain(std::iter::once(0)).collect();
    let mut sid = null_mut();
    if unsafe { ConvertStringSidToSidW(text.as_ptr(), &mut sid) } == 0 {
        return Err(invalid("invalid user SID"));
    }
    let _allocation = LocalAllocation(sid);
    if sid_string(sid)? != identity.user_sid {
        return Err(invalid("noncanonical user SID"));
    }
    Ok(())
}

fn user_sid(handle: HANDLE) -> io::Result<String> {
    let mut token = null_mut();
    if unsafe { OpenProcessToken(handle, TOKEN_QUERY, &mut token) } == 0 {
        return Err(io::Error::last_os_error());
    }
    let token = OwnedHandle(token);
    let mut needed = 0;
    let result = unsafe { GetTokenInformation(token.0, TokenUser, null_mut(), 0, &mut needed) };
    if result != 0 || io::Error::last_os_error().raw_os_error() != Some(ERROR_INSUFFICIENT_BUFFER as i32)
        || needed < size_of::<TOKEN_USER>() as u32 || needed > 65536 {
        return Err(invalid("invalid token user buffer size"));
    }
    // usize storage provides the alignment TOKEN_USER and its pointers require.
    let mut buffer = vec![0usize; (needed as usize + size_of::<usize>() - 1) / size_of::<usize>()];
    if unsafe { GetTokenInformation(token.0, TokenUser, buffer.as_mut_ptr().cast(), needed, &mut needed) } == 0 {
        return Err(io::Error::last_os_error());
    }
    let token_user = unsafe { &*(buffer.as_ptr().cast::<TOKEN_USER>()) };
    sid_string(token_user.User.Sid)
}

fn identity_from_handle(handle: HANDLE) -> io::Result<ProcessIdentity> {
    let pid = unsafe { GetProcessId(handle) };
    if pid == 0 { return Err(io::Error::last_os_error()); }
    let identity = ProcessIdentity { pid, creation_time: creation_time(handle)?.to_string(), user_sid: user_sid(handle)? };
    validate_identity(&identity)?;
    Ok(identity)
}

/// Opens `pid` with limited query and synchronize rights and identifies that exact object.
pub(crate) fn identity_for_pid(pid: u32) -> io::Result<ProcessIdentity> {
    let process = open_process(pid)?;
    let identity = identity_from_handle(process.0)?;
    if identity.pid != pid { return Err(invalid("process handle PID mismatch")); }
    Ok(identity)
}

/// Identifies the current process through an owned process handle.
pub(crate) fn current_identity() -> io::Result<ProcessIdentity> {
    identity_for_pid(unsafe { GetCurrentProcessId() })
}

fn parent_pid(pid: u32) -> io::Result<u32> {
    let raw = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if raw == INVALID_HANDLE_VALUE { return Err(io::Error::last_os_error()); }
    let snapshot = OwnedHandle(raw);
    let mut entry: PROCESSENTRY32W = unsafe { zeroed() };
    entry.dwSize = size_of::<PROCESSENTRY32W>() as u32;
    if unsafe { Process32FirstW(snapshot.0, &mut entry) } == 0 { return Err(io::Error::last_os_error()); }
    loop {
        if entry.th32ProcessID == pid {
            if entry.th32ParentProcessID == 0 { return Err(invalid("process has no parent")); }
            return Ok(entry.th32ParentProcessID);
        }
        if unsafe { Process32NextW(snapshot.0, &mut entry) } == 0 {
            return Err(io::Error::new(io::ErrorKind::NotFound, "current process missing from snapshot"));
        }
    }
}

/// Identifies this process's direct parent. Rejects a recycled parent PID by
/// requiring that the still-live parent predates the current process.
pub(crate) fn own_parent_identity() -> io::Result<ProcessIdentity> {
    let current = current_identity()?;
    let pid = parent_pid(current.pid)?;
    let parent = open_process(pid)?;
    let identity = identity_from_handle(parent.0)?;
    let parent_time = identity.creation_time.parse::<u64>().map_err(|_| invalid("invalid parent time"))?;
    let child_time = current.creation_time.parse::<u64>().map_err(|_| invalid("invalid child time"))?;
    if identity.pid != pid || parent_time >= child_time {
        return Err(invalid("parent PID was recycled or has ambiguous creation time"));
    }
    match unsafe { WaitForSingleObject(parent.0, 0) } {
        WAIT_TIMEOUT => Ok(identity),
        WAIT_OBJECT_0 => Err(invalid("parent has exited")),
        _ => Err(io::Error::last_os_error()),
    }
}

/// Checks both direct parenthood and the complete expected parent identity.
/// Binding and nonce checks remain the dispatcher's responsibility.
pub(crate) fn verify_parent(expected: &ProcessIdentity) -> io::Result<()> {
    validate_identity(expected)?;
    if own_parent_identity()? != *expected { return Err(invalid("supervisor is not the direct parent")); }
    Ok(())
}

/// Captures the helper parent's direct child while retaining the queried handle.
pub(crate) fn child_identity(pid: u32) -> io::Result<Option<ProcessIdentity>> {
    let parent = own_parent_identity()?;
    let child = match open_process(pid) {
        Ok(child) => child,
        Err(error) if error.raw_os_error() == Some(ERROR_INVALID_PARAMETER as i32) => return Ok(None),
        Err(error) => return Err(error),
    };
    match unsafe { WaitForSingleObject(child.0, 0) } {
        WAIT_OBJECT_0 => return Ok(None),
        WAIT_TIMEOUT => {},
        _ => return Err(io::Error::last_os_error()),
    }
    let identity = identity_from_handle(child.0)?;
    let child_time = identity.creation_time.parse::<u64>().map_err(|_| invalid("invalid child time"))?;
    let parent_time = parent.creation_time.parse::<u64>().map_err(|_| invalid("invalid parent time"))?;
    if identity.pid != pid || identity.user_sid != parent.user_sid || child_time <= parent_time || parent_pid(pid)? != parent.pid {
        return Err(invalid("process is not the expected child"));
    }
    if liveness(&parent)? != Liveness::Alive {
        return Err(invalid("parent identity is not alive"));
    }
    match unsafe { WaitForSingleObject(child.0, 0) } {
        WAIT_TIMEOUT => Ok(Some(identity)),
        WAIT_OBJECT_0 => Ok(None),
        _ => Err(io::Error::last_os_error()),
    }
}

fn open_failure_state(error: io::Error) -> io::Result<Liveness> {
    match error.raw_os_error() {
        Some(code) if code == ERROR_ACCESS_DENIED as i32 => Ok(Liveness::Unknown),
        Some(code) if code == ERROR_INVALID_PARAMETER as i32 => Ok(Liveness::Gone),
        _ => Err(error),
    }
}

/// Reports state of the exact identity. Access denial is unknown, never gone.
/// A recycled PID with a different creation time means the original is gone;
/// a SID mismatch at the same creation time is a corrupt claim and is an error.
pub(crate) fn liveness(expected: &ProcessIdentity) -> io::Result<Liveness> {
    validate_identity(expected)?;
    let process = match open_process(expected.pid) {
        Ok(process) => process,
        Err(error) => return open_failure_state(error),
    };
    match unsafe { WaitForSingleObject(process.0, 0) } {
        WAIT_OBJECT_0 => return Ok(Liveness::Gone),
        WAIT_TIMEOUT => {},
        _ => return Err(io::Error::last_os_error()),
    }
    let created = creation_time(process.0)?.to_string();
    if created != expected.creation_time { return Ok(Liveness::Gone); }
    let sid = match user_sid(process.0) {
        Ok(sid) => sid,
        Err(error) if error.raw_os_error() == Some(ERROR_ACCESS_DENIED as i32) => return Ok(Liveness::Unknown),
        Err(error) => return Err(error),
    };
    if sid != expected.user_sid { return Err(invalid("process SID mismatch")); }
    Ok(Liveness::Alive)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::process::{Command, Stdio};

    #[test]
    fn access_denied_is_unknown_and_other_errors_are_not_gone() {
        assert_eq!(open_failure_state(io::Error::from_raw_os_error(ERROR_ACCESS_DENIED as i32)).unwrap(), Liveness::Unknown);
        assert!(open_failure_state(io::Error::from_raw_os_error(6)).is_err());
    }

    #[test]
    fn current_process_and_recycled_identity() {
        let identity = current_identity().unwrap();
        assert_eq!(identity.pid, std::process::id());
        assert_eq!(liveness(&identity).unwrap(), Liveness::Alive);
        let json = serde_json::to_value(&identity).unwrap();
        assert_eq!(json["creationTime"], identity.creation_time);
        assert_eq!(json["userSid"], identity.user_sid);
        assert!(json.get("user_sid").is_none());
        let mut recycled = identity.clone();
        recycled.creation_time = (identity.creation_time.parse::<u64>().unwrap() + 1).to_string();
        assert_eq!(liveness(&recycled).unwrap(), Liveness::Gone);
        let mut wrong_sid = identity.clone();
        wrong_sid.user_sid = "S-1-0-0".to_string();
        if wrong_sid.user_sid != identity.user_sid { assert!(liveness(&wrong_sid).is_err()); }
        let mut invalid = identity;
        invalid.creation_time = "01".into();
        assert!(liveness(&invalid).is_err());
    }

    #[test]
    fn child_fixture() {
        if std::env::var_os("HAN_TEST_PROCESS_CHILD").is_none() { return; }
        let parent = own_parent_identity().unwrap();
        let expected: ProcessIdentity = serde_json::from_str(&std::env::var("HAN_TEST_PARENT_IDENTITY").unwrap()).unwrap();
        assert_eq!(parent, expected);
        verify_parent(&expected).unwrap();
        let mut wrong = parent;
        wrong.creation_time = (wrong.creation_time.parse::<u64>().unwrap() + 1).to_string();
        assert!(verify_parent(&wrong).is_err());
        std::io::stdout().write_all(b"child-ready\n").unwrap();
        std::io::stdout().flush().unwrap();
        let _ = std::io::stdin().read(&mut [0u8; 1]);
    }

    #[test]
    fn direct_child_has_parent_and_exit_state() {
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "windows_process_identity::tests::child_fixture", "--nocapture"])
            .env("HAN_TEST_PROCESS_CHILD", "1")
            .env("HAN_TEST_PARENT_IDENTITY", serde_json::to_string(&current_identity().unwrap()).unwrap())
            .stdin(Stdio::piped()).stdout(Stdio::piped()).spawn().unwrap();
        let mut output = child.stdout.take().unwrap();
        let mut observed = Vec::new();
        let mut byte = [0];
        while !observed.ends_with(b"child-ready\n") {
            assert_eq!(output.read(&mut byte).unwrap(), 1, "child exited before reporting parent");
            observed.push(byte[0]);
            assert!(observed.len() < 65536);
        }
        let identity = identity_for_pid(child.id()).unwrap();
        assert_eq!(liveness(&identity).unwrap(), Liveness::Alive);
        drop(child.stdin.take());
        assert!(child.wait().unwrap().success());
        assert_eq!(liveness(&identity).unwrap(), Liveness::Gone);
    }
}
