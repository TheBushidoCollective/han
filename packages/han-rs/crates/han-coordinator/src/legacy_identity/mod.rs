use std::ffi::OsString;
use std::net::IpAddr;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Listener {
    pub addr: IpAddr,
    pub port: u16,
    pub owners: Vec<u32>,
    pub socket_uid: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct Facts {
    pub pid: u32,
    pub same_user: bool,
    pub exe: PathBuf,
    pub argv: Vec<OsString>,
    pub start_time: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Escalation {
    Term,
    Kill,
}

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub use linux::*;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::*;

#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub use windows::*;

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
mod stub {
    use super::*;

    pub(crate) struct Pinned;

    pub(crate) fn listeners(_port: u16) -> io::Result<Vec<Listener>> {
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "legacy identity unsupported on this platform",
        ))
    }

    pub(crate) fn pin(_pid: u32) -> io::Result<Pinned> {
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "legacy identity unsupported on this platform",
        ))
    }

    pub(crate) fn facts(_p: &Pinned) -> io::Result<Facts> {
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "legacy identity unsupported on this platform",
        ))
    }

    pub(crate) fn confirm(_p: &Pinned, _f: &Facts) -> io::Result<bool> {
        Ok(false)
    }

    pub(crate) fn wait_exit(_p: &Pinned, _t: Duration) -> io::Result<bool> {
        Ok(true)
    }
}
#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
pub(crate) use stub::*;
