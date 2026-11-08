use super::{Escalation, Facts, Listener};
use std::ffi::OsString;
use std::fs;
use std::io;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
use std::os::unix::ffi::OsStringExt;
use std::path::PathBuf;
use std::time::{Duration, Instant};

pub struct Pinned {
    pub pid: u32,
    fd: OwnedFd,
}

pub fn pin(pid: u32) -> io::Result<Pinned> {
    if pid == 0 || pid > i32::MAX as u32 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Invalid PID for pin",
        ));
    }
    let res = unsafe { libc::syscall(libc::SYS_pidfd_open, pid, 0) };
    if res < 0 {
        return Err(io::Error::last_os_error());
    }
    let fd = unsafe { OwnedFd::from_raw_fd(res as i32) };
    Ok(Pinned { pid, fd })
}

pub fn signal(p: &Pinned, e: Escalation) -> io::Result<()> {
    let sig = match e {
        Escalation::Term => libc::SIGTERM,
        Escalation::Kill => libc::SIGKILL,
    };
    let res = unsafe {
        libc::syscall(
            libc::SYS_pidfd_send_signal,
            p.fd.as_raw_fd(),
            sig,
            std::ptr::null::<libc::siginfo_t>(),
            0,
        )
    };
    if res != 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(())
}

pub fn wait_exit(p: &Pinned, timeout: Duration) -> io::Result<bool> {
    let mut pfd = libc::pollfd {
        fd: p.fd.as_raw_fd(),
        events: libc::POLLIN,
        revents: 0,
    };
    let start = Instant::now();
    loop {
        let elapsed = start.elapsed();
        if elapsed >= timeout {
            return Ok(false);
        }
        let remaining_ms = (timeout - elapsed).as_millis().min(i32::MAX as u128) as i32;
        let ret = unsafe { libc::poll(&mut pfd, 1, remaining_ms) };
        if ret < 0 {
            let err = io::Error::last_os_error();
            if err.kind() == io::ErrorKind::Interrupted {
                continue;
            }
            return Err(err);
        }
        if ret > 0 && (pfd.revents & libc::POLLIN) != 0 {
            return Ok(true);
        }
        return Ok(false);
    }
}

fn get_boot_id() -> String {
    fs::read_to_string("/proc/sys/kernel/random/boot_id")
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| "boot".to_string())
}

fn get_start_ticks(pid: u32) -> io::Result<String> {
    let stat = fs::read_to_string(format!("/proc/{pid}/stat"))?;
    let rparen = stat
        .rfind(')')
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Malformed /proc/<pid>/stat"))?;
    let rest = &stat[rparen + 1..];
    let fields: Vec<&str> = rest.split_whitespace().collect();
    let ticks = fields
        .get(19)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Missing starttime in stat"))?;
    Ok((*ticks).to_string())
}

pub fn facts(p: &Pinned) -> io::Result<Facts> {
    let pid = p.pid;
    let proc_dir = format!("/proc/{pid}");
    let metadata = fs::metadata(&proc_dir)?;
    use std::os::unix::fs::MetadataExt;
    let proc_uid = metadata.uid();
    let current_euid = unsafe { libc::geteuid() };
    let same_user = proc_uid == current_euid;

    let exe = fs::read_link(format!("/proc/{pid}/exe"))?;
    let cmdline_bytes = fs::read(format!("/proc/{pid}/cmdline"))?;
    let argv: Vec<OsString> = cmdline_bytes
        .split(|&b| b == 0)
        .filter(|slice| !slice.is_empty())
        .map(|slice| OsString::from_vec(slice.to_vec()))
        .collect();

    let boot_id = get_boot_id();
    let ticks = get_start_ticks(pid)?;
    let start_time = format!("{boot_id}/{ticks}");

    Ok(Facts {
        pid,
        same_user,
        exe,
        argv,
        start_time,
    })
}

pub fn confirm(p: &Pinned, f: &Facts) -> io::Result<bool> {
    let probe = unsafe {
        libc::syscall(
            libc::SYS_pidfd_send_signal,
            p.fd.as_raw_fd(),
            0,
            std::ptr::null::<libc::siginfo_t>(),
            0,
        )
    };
    if probe != 0 {
        return Ok(false);
    }
    let current_ticks = match get_start_ticks(p.pid) {
        Ok(t) => t,
        Err(_) => return Ok(false),
    };
    let boot_id = get_boot_id();
    let expected = format!("{boot_id}/{current_ticks}");
    Ok(expected == f.start_time)
}

fn parse_hex_port(hex: &str) -> Option<u16> {
    u16::from_str_radix(hex, 16).ok()
}

fn parse_ipv4_addr(hex: &str) -> Option<Ipv4Addr> {
    let num = u32::from_str_radix(hex, 16).ok()?;
    Some(Ipv4Addr::from(num.to_ne_bytes()))
}

fn parse_ipv6_addr(hex: &str) -> Option<Ipv6Addr> {
    if hex.len() != 32 {
        return None;
    }
    let mut bytes = [0u8; 16];
    for i in 0..4 {
        let chunk = &hex[i * 8..(i + 1) * 8];
        let word = u32::from_str_radix(chunk, 16).ok()?;
        let word_bytes = word.to_ne_bytes();
        bytes[i * 4..(i + 1) * 4].copy_from_slice(&word_bytes);
    }
    Some(Ipv6Addr::from(bytes))
}

pub fn listeners(port: u16) -> io::Result<Vec<Listener>> {
    let mut socket_map: std::collections::HashMap<u64, (IpAddr, u16, Option<u32>)> =
        std::collections::HashMap::new();

    // 1. Read /proc/net/tcp
    if let Ok(content) = fs::read_to_string("/proc/net/tcp") {
        for line in content.lines().skip(1) {
            let fields: Vec<&str> = line.split_whitespace().collect();
            if fields.len() < 10 {
                continue;
            }
            if fields[3] != "0A" {
                continue;
            }
            let mut addr_parts = fields[1].split(':');
            let addr_hex = addr_parts.next().unwrap_or("");
            let port_hex = addr_parts.next().unwrap_or("");
            if let (Some(laddr), Some(lport)) = (parse_ipv4_addr(addr_hex), parse_hex_port(port_hex)) {
                if lport == port {
                    let uid = fields[7].parse::<u32>().ok();
                    let inode = fields[9].parse::<u64>().unwrap_or(0);
                    if inode > 0 {
                        socket_map.insert(inode, (IpAddr::V4(laddr), lport, uid));
                    }
                }
            }
        }
    }

    // 2. Read /proc/net/tcp6
    if let Ok(content) = fs::read_to_string("/proc/net/tcp6") {
        for line in content.lines().skip(1) {
            let fields: Vec<&str> = line.split_whitespace().collect();
            if fields.len() < 10 {
                continue;
            }
            if fields[3] != "0A" {
                continue;
            }
            let mut addr_parts = fields[1].split(':');
            let addr_hex = addr_parts.next().unwrap_or("");
            let port_hex = addr_parts.next().unwrap_or("");
            if let (Some(laddr), Some(lport)) = (parse_ipv6_addr(addr_hex), parse_hex_port(port_hex)) {
                if lport == port {
                    let uid = fields[7].parse::<u32>().ok();
                    let inode = fields[9].parse::<u64>().unwrap_or(0);
                    if inode > 0 {
                        socket_map.insert(inode, (IpAddr::V6(laddr), lport, uid));
                    }
                }
            }
        }
    }

    if socket_map.is_empty() {
        return Ok(Vec::new());
    }

    // 3. Scan /proc/[pid]/fd to map sockets to PIDs
    let mut inode_owners: std::collections::HashMap<u64, Vec<u32>> =
        std::collections::HashMap::new();

    if let Ok(entries) = fs::read_dir("/proc") {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let pid_str = name.to_string_lossy();
            if let Ok(pid) = pid_str.parse::<u32>() {
                let fd_dir = format!("/proc/{pid}/fd");
                if let Ok(fds) = fs::read_dir(&fd_dir) {
                    for fd_entry in fds.flatten() {
                        if let Ok(link) = fs::read_link(fd_entry.path()) {
                            let link_str = link.to_string_lossy();
                            if link_str.starts_with("socket:[") && link_str.ends_with(']') {
                                let inode_str = &link_str[8..link_str.len() - 1];
                                if let Ok(inode) = inode_str.parse::<u64>() {
                                    if socket_map.contains_key(&inode) {
                                        let owners = inode_owners.entry(inode).or_default();
                                        if !owners.contains(&pid) {
                                            owners.push(pid);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let mut result_map: std::collections::HashMap<(IpAddr, u16), (Vec<u32>, Option<u32>)> =
        std::collections::HashMap::new();

    for (inode, (addr, lport, uid)) in socket_map {
        let owners = inode_owners.remove(&inode).unwrap_or_default();
        let entry = result_map.entry((addr, lport)).or_insert_with(|| (Vec::new(), uid));
        for owner in owners {
            if !entry.0.contains(&owner) {
                entry.0.push(owner);
            }
        }
    }

    let listeners = result_map
        .into_iter()
        .map(|((addr, lport), (owners, socket_uid))| Listener {
            addr,
            port: lport,
            owners,
            socket_uid,
        })
        .collect();

    Ok(listeners)
}
