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

#[repr(C)]
struct ProcBsdInfo {
    pbi_flags: u32,
    pbi_status: u32,
    pbi_xstatus: u32,
    pbi_pid: u32,
    pbi_ppid: u32,
    pbi_uid: u32,
    pbi_gid: u32,
    pbi_ruid: u32,
    pbi_rgid: u32,
    pbi_svuid: u32,
    pbi_svgid: u32,
    rfu_1: u32,
    pbi_comm: [u8; 16],
    pbi_name: [u8; 32],
    pbi_nfiles: u32,
    pbi_pgid: u32,
    pbi_pjobc: u32,
    rfu_2: u32,
    pbi_start_tvsec: u64,
    pbi_start_tvusec: u64,
}

const PROC_PIDTBSDINFO: libc::c_int = 3;
const PROC_ALL_PIDS: u32 = 1;
const PROC_PIDLISTFDS: libc::c_int = 1;
const PROX_FDTYPE_SOCKET: u32 = 2;
const PROC_PIDFDSOCKETINFO: libc::c_int = 3;

#[repr(C)]
#[derive(Copy, Clone)]
struct ProcFdInfo {
    proc_fd: i32,
    proc_fdtype: u32,
}

#[repr(C)]
#[derive(Copy, Clone)]
struct InSockAddr {
    sin_len: u8,
    sin_family: u8,
    sin_port: u16,
    sin_addr: [u8; 4],
    sin_zero: [u8; 8],
}

#[repr(C)]
#[derive(Copy, Clone)]
struct In6SockAddr {
    sin6_len: u8,
    sin6_family: u8,
    sin6_port: u16,
    sin6_flowinfo: u32,
    sin6_addr: [u8; 16],
    sin6_scope_id: u32,
}

#[repr(C)]
#[derive(Copy, Clone)]
union SockAddrInUnion {
    ina_46: InSockAddr,
    ina_6: In6SockAddr,
}

#[repr(C)]
struct SocketFdInfo {
    pfi: [u8; 56], // vinfo_stat
    psi: SocketInfo,
}

#[repr(C)]
struct SocketInfo {
    soi_stat: [u8; 64],
    soi_so: u64,
    soi_pcb: u64,
    soi_type: i32,
    soi_family: i32,
    soi_protocol: i32,
    soi_options: i16,
    soi_linger: i16,
    soi_state: i16,
    soi_qlen: i16,
    soi_incqlen: i16,
    soi_qlimit: i16,
    soi_timeo: i16,
    soi_error: u16,
    soi_oobmark: u32,
    soi_rcv: [u8; 32],
    soi_snd: [u8; 32],
    soi_kind: i32,
    rfu_1: u32,
    proto: InSockInfo,
}

#[repr(C)]
struct InSockInfo {
    insi_fport: i32,
    insi_lport: i32,
    insi_gencnt: u64,
    insi_flags: u32,
    insi_flow: u32,
    insi_vflag: u8,
    insi_ip_ttl: u8,
    rfu_1: u32,
    insi_faddr: SockAddrInUnion,
    insi_laddr: SockAddrInUnion,
    tcp_info: [u8; 256],
}

extern "C" {
    fn proc_listpids(type_: u32, typeinfo: u32, buffer: *mut libc::c_void, buffersize: libc::c_int) -> libc::c_int;
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
    fn proc_pidpath(pid: libc::c_int, buffer: *mut libc::c_void, buffersize: u32) -> libc::c_int;
}

fn get_bsd_info(pid: u32) -> io::Result<ProcBsdInfo> {
    let mut info: ProcBsdInfo = unsafe { mem::zeroed() };
    let size = mem::size_of::<ProcBsdInfo>() as libc::c_int;
    let ret = unsafe {
        proc_pidinfo(
            pid as libc::c_int,
            PROC_PIDTBSDINFO,
            0,
            &mut info as *mut _ as *mut libc::c_void,
            size,
        )
    };
    if ret < size {
        return Err(io::Error::last_os_error());
    }
    Ok(info)
}

pub fn pin(pid: u32) -> io::Result<Pinned> {
    if pid == 0 || pid > i32::MAX as u32 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Invalid PID for pin",
        ));
    }
    let bsd = get_bsd_info(pid)?;
    let start_time = format!("{}.{}", bsd.pbi_start_tvsec, bsd.pbi_start_tvusec);
    Ok(Pinned {
        pid,
        start_time,
        uid: bsd.pbi_uid,
    })
}

pub fn confirm(p: &Pinned, f: &Facts) -> io::Result<bool> {
    let bsd = match get_bsd_info(p.pid) {
        Ok(b) => b,
        Err(_) => return Ok(false),
    };
    let current_start = format!("{}.{}", bsd.pbi_start_tvsec, bsd.pbi_start_tvusec);
    Ok(current_start == f.start_time && bsd.pbi_uid == p.uid)
}

pub fn wait_exit(p: &Pinned, timeout: Duration) -> io::Result<bool> {
    let start = Instant::now();
    while start.elapsed() < timeout {
        match get_bsd_info(p.pid) {
            Err(_) => return Ok(true),
            Ok(bsd) => {
                let current_start = format!("{}.{}", bsd.pbi_start_tvsec, bsd.pbi_start_tvusec);
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
    let bsd_before = get_bsd_info(pid)?;
    let start_before = format!("{}.{}", bsd_before.pbi_start_tvsec, bsd_before.pbi_start_tvusec);
    if start_before != p.start_time {
        return Err(io::Error::new(io::ErrorKind::NotFound, "PID reused before facts"));
    }

    let current_euid = unsafe { libc::geteuid() };
    let same_user = bsd_before.pbi_uid == current_euid;

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

    let bsd_after = get_bsd_info(pid)?;
    let start_after = format!("{}.{}", bsd_after.pbi_start_tvsec, bsd_after.pbi_start_tvusec);
    if start_after != p.start_time || bsd_after.pbi_uid != bsd_before.pbi_uid {
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
        let bsd = match get_bsd_info(pid as u32) {
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
                let mut sock_info: SocketFdInfo = unsafe { mem::zeroed() };
                let expected_size = mem::size_of::<SocketFdInfo>() as libc::c_int;
                let actual_size = unsafe {
                    proc_pidfdinfo(
                        pid,
                        fd.proc_fd,
                        PROC_PIDFDSOCKETINFO,
                        &mut sock_info as *mut _ as *mut libc::c_void,
                        expected_size,
                    )
                };
                if actual_size <= 0 {
                    continue;
                }
                if actual_size < expected_size {
                    return Err(io::Error::new(
                        io::ErrorKind::Unsupported,
                        "kernel returned different socket_fdinfo size than expected",
                    ));
                }

                let lport = u16::from_be(sock_info.psi.proto.insi_lport as u16);
                if lport == port {
                    let addr = if sock_info.psi.soi_family == libc::AF_INET {
                        let raw_addr = unsafe { sock_info.psi.proto.insi_laddr.ina_46.sin_addr };
                        IpAddr::V4(Ipv4Addr::from(raw_addr))
                    } else if sock_info.psi.soi_family == libc::AF_INET6 {
                        let raw_addr = unsafe { sock_info.psi.proto.insi_laddr.ina_6.sin6_addr };
                        IpAddr::V6(Ipv6Addr::from(raw_addr))
                    } else {
                        continue;
                    };

                    let entry = result_map.entry((addr, lport)).or_insert_with(|| (Vec::new(), Some(bsd.pbi_uid)));
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
