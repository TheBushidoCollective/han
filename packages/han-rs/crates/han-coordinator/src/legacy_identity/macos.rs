use super::{Facts, Listener};
use std::ffi::{OsStr, OsString};
use std::io;
use std::mem;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::os::unix::ffi::OsStrExt;
use std::path::PathBuf;
use std::time::{Duration, Instant};

pub struct Pinned {
    pub pid: u32,
    pub start_time: String,
    pub uid: u32,
}

const PROC_PIDTBSDINFO: libc::c_int = 3;
const PROC_PIDTBSDINFO_SIZE: usize = 136;

const PROC_ALL_PIDS: u32 = 1;
const PROC_PIDLISTFDS: libc::c_int = 1;
const PROX_FDTYPE_SOCKET: u32 = 2;

const PROC_PIDFDSOCKETINFO: libc::c_int = 3;
const PROC_PIDFDSOCKETINFO_SIZE: usize = 792;

const SOCKINFO_TCP: i32 = 2;
const TSI_S_LISTEN: i32 = 1;
const INI_IPV4: u8 = 0x1;
const INI_IPV6: u8 = 0x2;

#[repr(C)]
#[derive(Copy, Clone)]
struct ProcFdInfo {
    proc_fd: i32,
    proc_fdtype: u32,
}

extern "C" {
    fn proc_listpids(
        type_: u32,
        typeinfo: u32,
        buffer: *mut libc::c_void,
        buffersize: libc::c_int,
    ) -> libc::c_int;
    fn proc_pidinfo(
        pid: libc::c_int,
        flavor: libc::c_int,
        arg: u64,
        buffer: *mut libc::c_void,
        buffersize: libc::c_int,
    ) -> libc::c_int;
    fn proc_pidfdinfo(
        pid: libc::c_int,
        fd: libc::c_int,
        flavor: libc::c_int,
        buffer: *mut libc::c_void,
        buffersize: libc::c_int,
    ) -> libc::c_int;
    fn proc_pidpath(
        pid: libc::c_int,
        buffer: *mut libc::c_void,
        buffersize: u32,
    ) -> libc::c_int;
}

fn get_bsd_info(pid: u32) -> io::Result<(u32, u64, u64)> {
    let mut buf = [0u8; PROC_PIDTBSDINFO_SIZE];
    let ret = unsafe {
        proc_pidinfo(
            pid as libc::c_int,
            PROC_PIDTBSDINFO,
            0,
            buf.as_mut_ptr() as *mut libc::c_void,
            PROC_PIDTBSDINFO_SIZE as libc::c_int,
        )
    };
    if (ret as usize) < PROC_PIDTBSDINFO_SIZE {
        return Err(io::Error::last_os_error());
    }
    // offsets from Darwin SDK: pbi_uid at 20, pbi_start_tvsec at 120, pbi_start_tvusec at 128
    let uid = u32::from_ne_bytes(buf[20..24].try_into().unwrap());
    let tvsec = u64::from_ne_bytes(buf[120..128].try_into().unwrap());
    let tvusec = u64::from_ne_bytes(buf[128..136].try_into().unwrap());
    Ok((uid, tvsec, tvusec))
}

pub fn pin(pid: u32) -> io::Result<Pinned> {
    if pid == 0 || pid > i32::MAX as u32 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Invalid PID for pin",
        ));
    }
    let (uid, tvsec, tvusec) = get_bsd_info(pid)?;
    let start_time = format!("{tvsec}.{tvusec}");
    Ok(Pinned {
        pid,
        start_time,
        uid,
    })
}

pub fn confirm(p: &Pinned, f: &Facts) -> io::Result<bool> {
    let (uid, tvsec, tvusec) = match get_bsd_info(p.pid) {
        Ok(b) => b,
        Err(_) => return Ok(false),
    };
    let current_start = format!("{tvsec}.{tvusec}");
    Ok(current_start == f.start_time && uid == p.uid)
}

pub fn wait_exit(p: &Pinned, timeout: Duration) -> io::Result<bool> {
    let start = Instant::now();
    while start.elapsed() < timeout {
        match get_bsd_info(p.pid) {
            Err(_) => return Ok(true),
            Ok((_, tvsec, tvusec)) => {
                let current_start = format!("{tvsec}.{tvusec}");
                if current_start != p.start_time {
                    return Ok(true);
                }
            }
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    Ok(false)
}

pub fn facts(p: &Pinned) -> io::Result<Facts> {
    let pid = p.pid;
    let (uid_before, tvsec_before, tvusec_before) = get_bsd_info(pid)?;
    let start_before = format!("{tvsec_before}.{tvusec_before}");
    if start_before != p.start_time {
        return Err(io::Error::new(io::ErrorKind::NotFound, "PID reused before facts"));
    }

    let current_euid = unsafe { libc::geteuid() };
    let same_user = uid_before == current_euid;

    let mut path_buf = vec![0u8; 4096];
    let path_len = unsafe {
        proc_pidpath(
            pid as libc::c_int,
            path_buf.as_mut_ptr() as *mut libc::c_void,
            path_buf.len() as u32,
        )
    };
    if path_len <= 0 {
        return Err(io::Error::last_os_error());
    }
    path_buf.truncate(path_len as usize);
    let exe = PathBuf::from(OsStr::from_bytes(&path_buf));

    let mut mib = [libc::CTL_KERN, libc::KERN_PROCARGS2, pid as libc::c_int];
    let mut size: libc::size_t = 0;
    unsafe {
        libc::sysctl(
            mib.as_mut_ptr(),
            3,
            std::ptr::null_mut(),
            &mut size,
            std::ptr::null_mut(),
            0,
        );
    }
    if size == 0 {
        return Err(io::Error::last_os_error());
    }
    let mut procargs = vec![0u8; size];
    let ret = unsafe {
        libc::sysctl(
            mib.as_mut_ptr(),
            3,
            procargs.as_mut_ptr() as *mut libc::c_void,
            &mut size,
            std::ptr::null_mut(),
            0,
        )
    };
    if ret != 0 {
        return Err(io::Error::last_os_error());
    }

    let mut argv = Vec::new();
    if procargs.len() >= 4 {
        let argc = u32::from_ne_bytes(procargs[0..4].try_into().unwrap()) as usize;
        let mut idx = 4;
        while idx < procargs.len() && procargs[idx] != 0 {
            idx += 1;
        }
        while idx < procargs.len() && procargs[idx] == 0 {
            idx += 1;
        }
        for _ in 0..argc {
            if idx >= procargs.len() {
                break;
            }
            let start = idx;
            while idx < procargs.len() && procargs[idx] != 0 {
                idx += 1;
            }
            let slice = &procargs[start..idx];
            argv.push(OsString::from(OsStr::from_bytes(slice)));
            idx += 1;
        }
    }

    let (uid_after, tvsec_after, tvusec_after) = get_bsd_info(pid)?;
    let start_after = format!("{tvsec_after}.{tvusec_after}");
    if start_after != p.start_time || uid_after != uid_before {
        return Err(io::Error::new(io::ErrorKind::NotFound, "Process changed during facts"));
    }

    Ok(Facts {
        pid,
        same_user,
        exe,
        argv,
        start_time: start_before,
    })
}

pub fn listeners(port: u16) -> io::Result<Vec<Listener>> {
    let mut num_pids = unsafe { proc_listpids(PROC_ALL_PIDS, 0, std::ptr::null_mut(), 0) };
    if num_pids <= 0 {
        return Err(io::Error::last_os_error());
    }
    let mut pids = vec![0i32; (num_pids as usize) + 64];
    num_pids = unsafe {
        proc_listpids(
            PROC_ALL_PIDS,
            0,
            pids.as_mut_ptr() as *mut libc::c_void,
            (pids.len() * mem::size_of::<i32>()) as libc::c_int,
        )
    };
    if num_pids <= 0 {
        return Err(io::Error::last_os_error());
    }
    let actual_count = (num_pids as usize) / mem::size_of::<i32>();
    pids.truncate(actual_count);

    let mut result_map: std::collections::HashMap<(IpAddr, u16), (Vec<u32>, Option<u32>)> =
        std::collections::HashMap::new();

    for pid in pids {
        if pid <= 0 {
            continue;
        }
        let (uid, _, _) = match get_bsd_info(pid as u32) {
            Ok(b) => b,
            Err(_) => continue,
        };

        let fd_size = unsafe {
            proc_pidinfo(
                pid,
                PROC_PIDLISTFDS,
                0,
                std::ptr::null_mut(),
                0,
            )
        };
        if fd_size <= 0 {
            continue;
        }
        let num_fds = (fd_size as usize) / mem::size_of::<ProcFdInfo>();
        let mut fds = vec![ProcFdInfo { proc_fd: 0, proc_fdtype: 0 }; num_fds];
        let ret = unsafe {
            proc_pidinfo(
                pid,
                PROC_PIDLISTFDS,
                0,
                fds.as_mut_ptr() as *mut libc::c_void,
                fd_size,
            )
        };
        if ret <= 0 {
            continue;
        }

        for fd in fds {
            if fd.proc_fdtype == PROX_FDTYPE_SOCKET {
                let mut buf = [0u8; PROC_PIDFDSOCKETINFO_SIZE];
                let actual_size = unsafe {
                    proc_pidfdinfo(
                        pid,
                        fd.proc_fd,
                        PROC_PIDFDSOCKETINFO,
                        buf.as_mut_ptr() as *mut libc::c_void,
                        PROC_PIDFDSOCKETINFO_SIZE as libc::c_int,
                    )
                };
                if actual_size <= 0 {
                    continue;
                }
                if (actual_size as usize) < PROC_PIDFDSOCKETINFO_SIZE {
                    return Err(io::Error::new(
                        io::ErrorKind::Unsupported,
                        "kernel returned different socket_fdinfo size than expected",
                    ));
                }

                // Check TCP socket
                let soi_kind = i32::from_ne_bytes(buf[256..260].try_into().unwrap());
                if soi_kind != SOCKINFO_TCP {
                    continue;
                }

                let tcpsi_state = i32::from_ne_bytes(buf[344..348].try_into().unwrap());
                if tcpsi_state != TSI_S_LISTEN {
                    continue;
                }

                let raw_port = i32::from_ne_bytes(buf[268..272].try_into().unwrap());
                let lport = u16::from_be(raw_port as u16);
                if lport == port {
                    let vflag = buf[288];
                    let addr = if (vflag & INI_IPV4) != 0 {
                        let ip_bytes: [u8; 4] = buf[324..328].try_into().unwrap();
                        IpAddr::V4(Ipv4Addr::from(ip_bytes))
                    } else if (vflag & INI_IPV6) != 0 {
                        let ip_bytes: [u8; 16] = buf[312..328].try_into().unwrap();
                        IpAddr::V6(Ipv6Addr::from(ip_bytes))
                    } else {
                        continue;
                    };

                    let entry = result_map.entry((addr, lport)).or_insert_with(|| (Vec::new(), Some(uid)));
                    if !entry.0.contains(&(pid as u32)) {
                        entry.0.push(pid as u32);
                    }
                }
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
