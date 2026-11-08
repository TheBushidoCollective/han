use super::{Escalation, Facts, Listener};
use crate::windows_process_identity::{current_identity, identity_for_pid};
use std::ffi::OsString;
use std::io;
use std::mem;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::os::windows::ffi::OsStringExt;
use std::path::PathBuf;
use std::ptr;
use std::time::Duration;
use windows_sys::Win32::Foundation::{
    CloseHandle, LocalFree, HANDLE, INVALID_HANDLE_VALUE, WAIT_OBJECT_0, WAIT_TIMEOUT,
};
use windows_sys::Win32::NetworkManagement::IpHelper::{
    GetExtendedTcpTable, TCP_TABLE_OWNER_PID_LISTENER,
};
use windows_sys::Win32::Networking::WinSock::{AF_INET, AF_INET6};
use windows_sys::Win32::System::Threading::{
    GetProcessId, OpenProcess, QueryFullProcessImageNameW, TerminateProcess,
    WaitForSingleObject, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE,
    PROCESS_TERMINATE,
};
use windows_sys::Win32::UI::Shell::CommandLineToArgvW;

pub struct Pinned {
    pub pid: u32,
    pub(crate) handle: HANDLE,
}

impl Drop for Pinned {
    fn drop(&mut self) {
        if !self.handle.is_null() && self.handle != INVALID_HANDLE_VALUE {
            unsafe { CloseHandle(self.handle) };
        }
    }
}

pub fn pin(pid: u32) -> io::Result<Pinned> {
    if pid == 0 || pid > i32::MAX as u32 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Invalid PID for pin",
        ));
    }
    let desired_access =
        PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE | PROCESS_TERMINATE;
    let handle = unsafe { OpenProcess(desired_access, 0, pid) };
    if handle.is_null() || handle == INVALID_HANDLE_VALUE {
        return Err(io::Error::last_os_error());
    }

    let actual_pid = unsafe { GetProcessId(handle) };
    if actual_pid != pid {
        unsafe { CloseHandle(handle) };
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "Handle PID mismatch",
        ));
    }

    let wait_res = unsafe { WaitForSingleObject(handle, 0) };
    if wait_res != WAIT_TIMEOUT {
        unsafe { CloseHandle(handle) };
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "Process already terminated",
        ));
    }

    Ok(Pinned { pid, handle })
}

pub fn signal(p: &Pinned, _e: Escalation) -> io::Result<()> {
    let wait_res = unsafe { WaitForSingleObject(p.handle, 0) };
    if wait_res == WAIT_TIMEOUT {
        let ret = unsafe { TerminateProcess(p.handle, 1) };
        if ret == 0 {
            return Err(io::Error::last_os_error());
        }
    }
    Ok(())
}

pub fn wait_exit(p: &Pinned, timeout: Duration) -> io::Result<bool> {
    let ms = timeout.as_millis().min(u32::MAX as u128) as u32;
    let res = unsafe { WaitForSingleObject(p.handle, ms) };
    Ok(res == WAIT_OBJECT_0)
}

pub fn facts(p: &Pinned) -> io::Result<Facts> {
    let pid = p.pid;
    let proc_identity = identity_for_pid(pid)?;
    let my_identity = current_identity()?;
    let same_user = proc_identity.user_sid == my_identity.user_sid;

    let mut path_buf = vec![0u16; 1024];
    let mut size = path_buf.len() as u32;
    let ok = unsafe { QueryFullProcessImageNameW(p.handle, 0, path_buf.as_mut_ptr(), &mut size) };
    if ok == 0 {
        return Err(io::Error::last_os_error());
    }
    path_buf.truncate(size as usize);
    let exe = PathBuf::from(OsString::from_wide(&path_buf));

    let argv = get_process_cmdline(p.handle).unwrap_or_default();

    Ok(Facts {
        pid,
        same_user,
        exe,
        argv,
        start_time: proc_identity.creation_time,
    })
}

fn get_process_cmdline(handle: HANDLE) -> io::Result<Vec<OsString>> {
    #[repr(C)]
    struct UnicodeString {
        length: u16,
        maximum_length: u16,
        buffer: *mut u16,
    }
    #[link(name = "ntdll")]
    extern "system" {
        fn NtQueryInformationProcess(
            process_handle: HANDLE,
            process_information_class: u32,
            process_information: *mut libc::c_void,
            process_information_length: u32,
            return_length: *mut u32,
        ) -> i32;
    }

    const PROCESS_COMMAND_LINE_INFORMATION: u32 = 60;
    let mut len: u32 = 0;
    unsafe {
        NtQueryInformationProcess(
            handle,
            PROCESS_COMMAND_LINE_INFORMATION,
            ptr::null_mut(),
            0,
            &mut len,
        );
    }
    if len == 0 {
        return Ok(Vec::new());
    }
    let mut buf = vec![0u8; len as usize];
    let status = unsafe {
        NtQueryInformationProcess(
            handle,
            PROCESS_COMMAND_LINE_INFORMATION,
            buf.as_mut_ptr() as *mut _,
            len,
            &mut len,
        )
    };
    if status != 0 {
        return Ok(Vec::new());
    }
    let us = unsafe { &*(buf.as_ptr() as *const UnicodeString) };
    if us.buffer.is_null() || us.length == 0 {
        return Ok(Vec::new());
    }
    let num_wchars = (us.length / 2) as usize;
    let wide_cmd = unsafe { std::slice::from_raw_parts(us.buffer, num_wchars) };
    let mut wide_vec: Vec<u16> = wide_cmd.to_vec();
    wide_vec.push(0);

    let mut argc: i32 = 0;
    let argv_ptr = unsafe { CommandLineToArgvW(wide_vec.as_ptr(), &mut argc) };
    if argv_ptr.is_null() {
        return Ok(Vec::new());
    }

    let mut result = Vec::new();
    for i in 0..(argc as usize) {
        let arg_p = unsafe { *argv_ptr.add(i) };
        if !arg_p.is_null() {
            let mut arg_len = 0;
            while unsafe { *arg_p.add(arg_len) } != 0 {
                arg_len += 1;
            }
            let slice = unsafe { std::slice::from_raw_parts(arg_p, arg_len) };
            result.push(OsString::from_wide(slice));
        }
    }
    unsafe { LocalFree(argv_ptr as *mut _) };
    Ok(result)
}

pub fn confirm(p: &Pinned, f: &Facts) -> io::Result<bool> {
    let actual_pid = unsafe { GetProcessId(p.handle) };
    if actual_pid != p.pid {
        return Ok(false);
    }
    let proc_identity = match identity_for_pid(p.pid) {
        Ok(id) => id,
        Err(_) => return Ok(false),
    };
    Ok(proc_identity.creation_time == f.start_time)
}

#[repr(C)]
struct MibTcpRowOwnerPid {
    dw_state: u32,
    dw_local_addr: u32,
    dw_local_port: u32,
    dw_remote_addr: u32,
    dw_remote_port: u32,
    dw_owning_pid: u32,
}

#[repr(C)]
struct MibTcpTableOwnerPid {
    dw_num_entries: u32,
    table: [MibTcpRowOwnerPid; 1],
}

#[repr(C)]
struct MibTcp6RowOwnerPid {
    uc_local_addr: [u8; 16],
    dw_local_scope_id: u32,
    dw_local_port: u32,
    uc_remote_addr: [u8; 16],
    dw_remote_scope_id: u32,
    dw_remote_port: u32,
    dw_state: u32,
    dw_owning_pid: u32,
}

#[repr(C)]
struct MibTcp6TableOwnerPid {
    dw_num_entries: u32,
    table: [MibTcp6RowOwnerPid; 1],
}

const MIB_TCP_STATE_LISTEN: u32 = 2;

pub fn listeners(port: u16) -> io::Result<Vec<Listener>> {
    let mut result_map: std::collections::HashMap<(IpAddr, u16), Vec<u32>> =
        std::collections::HashMap::new();

    // 1. IPv4 TCP Table
    let mut size: u32 = 0;
    unsafe {
        GetExtendedTcpTable(
            ptr::null_mut(),
            &mut size,
            0,
            AF_INET as u32,
            TCP_TABLE_OWNER_PID_LISTENER,
            0,
        );
    }
    if size > 0 {
        let mut buf = vec![0u8; size as usize];
        let ret = unsafe {
            GetExtendedTcpTable(
                buf.as_mut_ptr() as *mut _,
                &mut size,
                0,
                AF_INET as u32,
                TCP_TABLE_OWNER_PID_LISTENER,
                0,
            )
        };
        if ret == 0 {
            let table = unsafe { &*(buf.as_ptr() as *const MibTcpTableOwnerPid) };
            let entries = table.dw_num_entries as usize;
            let rows_ptr = buf.as_ptr().wrapping_add(mem::size_of::<u32>()) as *const MibTcpRowOwnerPid;
            for i in 0..entries {
                let row = unsafe { &*rows_ptr.add(i) };
                if row.dw_state == MIB_TCP_STATE_LISTEN {
                    let lport = u16::from_be(row.dw_local_port as u16);
                    if lport == port {
                        let laddr = IpAddr::V4(Ipv4Addr::from(row.dw_local_addr.to_ne_bytes()));
                        let owners = result_map.entry((laddr, lport)).or_default();
                        if !owners.contains(&row.dw_owning_pid) {
                            owners.push(row.dw_owning_pid);
                        }
                    }
                }
            }
        }
    }

    // 2. IPv6 TCP Table
    let mut size6: u32 = 0;
    unsafe {
        GetExtendedTcpTable(
            ptr::null_mut(),
            &mut size6,
            0,
            AF_INET6 as u32,
            TCP_TABLE_OWNER_PID_LISTENER,
            0,
        );
    }
    if size6 > 0 {
        let mut buf6 = vec![0u8; size6 as usize];
        let ret = unsafe {
            GetExtendedTcpTable(
                buf6.as_mut_ptr() as *mut _,
                &mut size6,
                0,
                AF_INET6 as u32,
                TCP_TABLE_OWNER_PID_LISTENER,
                0,
            )
        };
        if ret == 0 {
            let table6 = unsafe { &*(buf6.as_ptr() as *const MibTcp6TableOwnerPid) };
            let entries = table6.dw_num_entries as usize;
            let rows_ptr = buf6.as_ptr().wrapping_add(mem::size_of::<u32>()) as *const MibTcp6RowOwnerPid;
            for i in 0..entries {
                let row = unsafe { &*rows_ptr.add(i) };
                if row.dw_state == MIB_TCP_STATE_LISTEN {
                    let lport = u16::from_be(row.dw_local_port as u16);
                    if lport == port {
                        let laddr = IpAddr::V6(Ipv6Addr::from(row.uc_local_addr));
                        let owners = result_map.entry((laddr, lport)).or_default();
                        if !owners.contains(&row.dw_owning_pid) {
                            owners.push(row.dw_owning_pid);
                        }
                    }
                }
            }
        }
    }

    let listeners = result_map
        .into_iter()
        .map(|((addr, lport), owners)| Listener {
            addr,
            port: lport,
            owners,
            socket_uid: None,
        })
        .collect();

    Ok(listeners)
}
