//! Windows handle primitives for the secure local transport.
//!
//! Cooperating readers serialize with publication. Raw filesystem reads can
//! see absence between retirement and installation, including after a crash.
//! Absence is not evidence of process death or permission to steal a claim.

#![cfg(windows)]

use std::ffi::OsStr;
use std::io;
use std::mem::{size_of, zeroed};
use std::io::{Read, Seek, SeekFrom, Write};
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use std::path::{Component, Path, Prefix};
use std::ptr::{null, null_mut};

use windows_sys::Wdk::Foundation::OBJECT_ATTRIBUTES;
use windows_sys::Wdk::Storage::FileSystem::{
    NtCreateFile, NtSetInformationFile, FILE_CREATE, FILE_DIRECTORY_FILE, FILE_NON_DIRECTORY_FILE, FILE_OPEN,
    FILE_OPEN_REPARSE_POINT, FILE_SYNCHRONOUS_IO_NONALERT, FILE_RENAME_INFORMATION, FileRenameInformation,
};
use windows_sys::Win32::Foundation::{RtlNtStatusToDosError, INVALID_HANDLE_VALUE, OBJ_CASE_INSENSITIVE, UNICODE_STRING};
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, GetDriveTypeW, GetFileInformationByHandleEx, GetVolumeInformationByHandleW,
    LockFileEx, SetFileInformationByHandle, UnlockFileEx, FileAttributeTagInfo,
    FileDispositionInfo, FileIdInfo, FileStandardInfo,
    FILE_ATTRIBUTE_REPARSE_POINT, FILE_ATTRIBUTE_TAG_INFO, FILE_DISPOSITION_INFO,
    FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_ID_INFO, FILE_READ_ATTRIBUTES,
    FILE_SHARE_READ, FILE_SHARE_WRITE, FILE_STANDARD_INFO, FILE_TRAVERSE,
    LOCKFILE_EXCLUSIVE_LOCK, OPEN_EXISTING, READ_CONTROL, SYNCHRONIZE,
};

use windows_sys::Win32::Foundation::LocalFree;
use windows_sys::Win32::Security::{
    EqualSid, GetAce, GetAclInformation, GetSecurityDescriptorControl,
    GetSecurityDescriptorDacl, GetTokenInformation, IsValidAcl, IsValidSid, IsWellKnownSid,
    AclSizeInformation, ACL, ACL_SIZE_INFORMATION, ACCESS_ALLOWED_ACE,
    DACL_SECURITY_INFORMATION, INHERITED_ACE, WinBuiltinAdministratorsSid, WinLocalSystemSid,
    OWNER_SECURITY_INFORMATION, SE_DACL_PROTECTED, TOKEN_QUERY, TOKEN_USER, TokenUser,
};
use windows_sys::Win32::Security::Authorization::{
    ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW,
    ConvertStringSidToSidW, GetSecurityInfo, SE_FILE_OBJECT, SDDL_REVISION_1,
};
use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
use windows_sys::Win32::System::IO::{IO_STATUS_BLOCK, OVERLAPPED};

/// Stable identity of an opened object. Never truncate the 128-bit file ID.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct FileIdentity {
    pub(crate) volume_serial: u64,
    pub(crate) file_id: [u8; 16],
}


/// An opened local data directory whose entire ancestor chain remains pinned.
pub(crate) struct PinnedDirectory {
    handles: Vec<OwnedHandle>,
}

impl PinnedDirectory {
    pub(crate) fn open_data_directory(path: &Path) -> io::Result<Self> {
        let mut parts = path.components();
        let drive = match parts.next() {
            Some(Component::Prefix(prefix)) => match prefix.kind() {
                Prefix::Disk(letter) if letter.is_ascii_alphabetic() => letter,
                _ => return Err(invalid("only local drive paths are supported")),
            },
            _ => return Err(invalid("absolute drive path required")),
        };
        if !matches!(parts.next(), Some(Component::RootDir)) {
            return Err(invalid("absolute drive path required"));
        }
        let root = [drive as u16, b':' as u16, b'\\' as u16, 0];
        // DRIVE_FIXED. Reject network, removable, unknown and optical volumes.
        if unsafe { GetDriveTypeW(root.as_ptr()) } != 3 {
            return Err(invalid("unsupported Windows drive type"));
        }
        let raw = unsafe {
            CreateFileW(root.as_ptr(), FILE_READ_ATTRIBUTES | FILE_TRAVERSE | READ_CONTROL,
                FILE_SHARE_READ | FILE_SHARE_WRITE, null(), OPEN_EXISTING,
                FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, null_mut())
        };
        if raw == INVALID_HANDLE_VALUE { return Err(io::Error::last_os_error()); }
        let root_handle = unsafe { OwnedHandle::from_raw_handle(raw as _) };
        reject_reparse(&root_handle)?;
        verify_ancestor_acl(&root_handle)?;
        let mut flags = 0u32;
        let mut filesystem = [0u16; 32];
        if unsafe {
            GetVolumeInformationByHandleW(root_handle.as_raw_handle() as _, null_mut(), 0,
                null_mut(), null_mut(), &mut flags, filesystem.as_mut_ptr(), filesystem.len() as u32)
        } == 0 {
            return Err(io::Error::last_os_error());
        }
        let length = filesystem.iter().position(|&ch| ch == 0).unwrap_or(filesystem.len());
        // Restrict the initial implementation to NTFS with persistent ACLs
        // and open-by-file-ID support; unfamiliar filesystem semantics fail.
        if &filesystem[..length] != [b'N' as u16, b'T' as u16, b'F' as u16, b'S' as u16]
            || flags & (0x8 | 0x0100_0000) != (0x8 | 0x0100_0000) {
            return Err(invalid("unsupported filesystem"));
        }
        let mut handles = vec![root_handle];
        let mut parts = parts.peekable();
        while let Some(part) = parts.next() {
            let name = match part {
                Component::Normal(name) => name,
                _ => return Err(invalid("invalid path component")),
            };
            let mut access = FILE_READ_ATTRIBUTES | FILE_TRAVERSE | READ_CONTROL;
            if parts.peek().is_none() {
                access |= windows_sys::Win32::Storage::FileSystem::FILE_ADD_FILE
                    | windows_sys::Win32::Storage::FileSystem::FILE_ADD_SUBDIRECTORY;
            }
            let next = open_child(handles.last().unwrap(), name, true, access)?;
            if parts.peek().is_some() { verify_ancestor_acl(&next)?; }
            handles.push(next);
        }
        if handles.len() == 1 { return Err(invalid("drive root is not a private data directory")); }
        verify_acl(handles.last().unwrap(), false)?;
        Ok(Self { handles })
    }

    fn handle(&self) -> &OwnedHandle {
        self.handles.last().expect("directory chain is nonempty")
    }

    /// Open an existing private child, or create it securely if explicitly
    /// requested. All ancestors remain pinned until the returned value drops.
    pub(crate) fn open_private_child(mut self, name: &OsStr, create: bool) -> io::Result<Self> {
        let access = FILE_READ_ATTRIBUTES | FILE_TRAVERSE | READ_CONTROL
            | windows_sys::Win32::Storage::FileSystem::FILE_ADD_FILE
            | windows_sys::Win32::Storage::FileSystem::FILE_ADD_SUBDIRECTORY;
        let (child, created) = match open_child(self.handle(), name, true, access) {
            Ok(handle) => (handle, false),
            Err(error) if create && error.kind() == io::ErrorKind::NotFound =>
                (create_private_child(self.handle(), name, true, access)?, true),
            Err(error) => return Err(error),
        };
        verify_private_acl(&child)?;
        self.handles.push(child);
        if created {
            use windows_sys::Win32::Storage::FileSystem::{FILE_READ_DATA, FILE_WRITE_DATA};
            let access = FILE_READ_ATTRIBUTES | FILE_READ_DATA | FILE_WRITE_DATA | READ_CONTROL;
            let lock = create_private_child_with_share(self.handle(), OsStr::new("descriptor-publication.lock"),
                false, access, FILE_SHARE_READ | FILE_SHARE_WRITE)?;
            regular_file_identity(&lock)?;
        }
        Ok(self)
    }
}
fn invalid(message: &'static str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

/// Reject ambiguous Win32 names, alternate streams, and DOS device aliases.
/// This validates a single component only, not a path or its security.
fn component(name: &OsStr) -> io::Result<Vec<u16>> {
    let name: Vec<u16> = name.encode_wide().collect();
    if name.is_empty() || name.len() > 255 || name.iter().any(|&c| {
        c < 32 || matches!(c, 34 | 42 | 47 | 58 | 60 | 62 | 63 | 92 | 124)
    }) || matches!(name.last(), Some(32 | 46)) {
        return Err(invalid("invalid Windows path component"));
    }
    let stem = name.split(|&c| c == 46).next().unwrap_or_default();
    let upper: Vec<u16> = stem.iter().map(|&c| {
        if (97..=122).contains(&c) { c - 32 } else { c }
    }).collect();
    let reserved = ["CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$"]
        .iter().any(|word| upper.iter().copied().eq(word.encode_utf16()));
    let numbered_device = upper.len() == 4
        && (upper[..3] == [67, 79, 77] || upper[..3] == [76, 80, 84])
        && ((49..=57).contains(&upper[3]) || matches!(upper[3], 0x00b9 | 0x00b2 | 0x00b3));
    if reserved || numbered_device {
        return Err(invalid("reserved Windows device name"));
    }
    Ok(name)
}

/// Open exactly one child relative to an already-open directory. The caller
/// must keep every validated ancestor open without delete sharing and must
/// establish the directory's security before using the returned handle.
/// The returned handle also denies delete sharing for its entire lifetime.
fn open_child(parent: &OwnedHandle, name: &OsStr, directory: bool, access: u32) -> io::Result<OwnedHandle> {
    let share = if directory { FILE_SHARE_READ | FILE_SHARE_WRITE } else { FILE_SHARE_READ };
    open_child_with_share(parent, name, directory, access, share)
}

fn open_child_with_share(parent: &OwnedHandle, name: &OsStr, directory: bool, access: u32, share: u32) -> io::Result<OwnedHandle> {
    let mut name = component(name)?;
    let byte_len = u16::try_from(name.len() * 2).map_err(|_| invalid("name too long"))?;
    let unicode = UNICODE_STRING { Length: byte_len, MaximumLength: byte_len, Buffer: name.as_mut_ptr() };
    let attributes = OBJECT_ATTRIBUTES {
        Length: size_of::<OBJECT_ATTRIBUTES>() as u32,
        RootDirectory: parent.as_raw_handle() as _,
        ObjectName: &unicode,
        Attributes: OBJ_CASE_INSENSITIVE,
        SecurityDescriptor: null(),
        SecurityQualityOfService: null(),
    };
    let mut handle = null_mut();
    let mut status: IO_STATUS_BLOCK = unsafe { zeroed() };
    // A relative open is the only operation on `name`; it is never re-opened
    // through a checked absolute path. OPEN_REPARSE_POINT inspects the link.
    let result = unsafe {
        NtCreateFile(
            &mut handle, access | SYNCHRONIZE, &attributes, &mut status, null(), 0,
            share, FILE_OPEN,
            FILE_OPEN_REPARSE_POINT | FILE_SYNCHRONOUS_IO_NONALERT |
                if directory { FILE_DIRECTORY_FILE } else { FILE_NON_DIRECTORY_FILE },
            null(), 0,
        )
    };
    if result < 0 {
        return Err(io::Error::from_raw_os_error(unsafe { RtlNtStatusToDosError(result) } as i32));
    }
    let handle = unsafe { OwnedHandle::from_raw_handle(handle as _) };
    reject_reparse(&handle)?;
    Ok(handle)
}

/// Create a new child with a protected DACL applied by the kernel at creation.
/// The parent must already be validated and held without delete sharing.
fn create_private_child(parent: &OwnedHandle, name: &OsStr, directory: bool, access: u32) -> io::Result<OwnedHandle> {
    let share = if directory { FILE_SHARE_READ | FILE_SHARE_WRITE } else { 0 };
    create_private_child_with_share(parent, name, directory, access, share)
}

fn create_private_child_with_share(parent: &OwnedHandle, name: &OsStr, directory: bool, access: u32, share: u32) -> io::Result<OwnedHandle> {
    let mut token_handle = null_mut();
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token_handle) } == 0 {
        return Err(io::Error::last_os_error());
    }
    let token = unsafe { OwnedHandle::from_raw_handle(token_handle as _) };
    let mut size = 0;
    unsafe { GetTokenInformation(token.as_raw_handle() as _, TokenUser, null_mut(), 0, &mut size); }
    if size < size_of::<TOKEN_USER>() as u32 {
        return Err(io::Error::last_os_error());
    }
    let mut token_data = vec![0usize; (size as usize + size_of::<usize>() - 1) / size_of::<usize>()];
    if unsafe { GetTokenInformation(token.as_raw_handle() as _, TokenUser, token_data.as_mut_ptr() as _, size, &mut size) } == 0 {
        return Err(io::Error::last_os_error());
    }
    let sid = unsafe { (*(token_data.as_ptr() as *const TOKEN_USER)).User.Sid };
    let mut sid_string = null_mut();
    if sid.is_null() || unsafe { ConvertSidToStringSidW(sid, &mut sid_string) } == 0 {
        return Err(io::Error::last_os_error());
    }
    let _sid_string = LocalAllocation(sid_string as _);
    let mut sid_len = 0usize;
    while unsafe { *sid_string.add(sid_len) } != 0 {
        sid_len += 1;
        if sid_len > 184 { return Err(invalid("oversized SID")); }
    }
    let sid_text = String::from_utf16(unsafe { std::slice::from_raw_parts(sid_string, sid_len) })
        .map_err(|_| invalid("invalid SID string"))?;
    let sddl = format!("O:{sid_text}D:P(A;OICI;FA;;;{sid_text})(A;OICI;FA;;;SY)");
    let sddl: Vec<u16> = sddl.encode_utf16().chain(Some(0)).collect();
    let mut descriptor = null_mut();
    if unsafe { ConvertStringSecurityDescriptorToSecurityDescriptorW(
        sddl.as_ptr(), SDDL_REVISION_1, &mut descriptor, null_mut()) } == 0 {
        return Err(io::Error::last_os_error());
    }
    let _descriptor = LocalAllocation(descriptor);
    let mut name = component(name)?;
    let length = (name.len() * 2) as u16;
    let unicode = UNICODE_STRING { Length: length, MaximumLength: length, Buffer: name.as_mut_ptr() };
    let attributes = OBJECT_ATTRIBUTES {
        Length: size_of::<OBJECT_ATTRIBUTES>() as u32,
        RootDirectory: parent.as_raw_handle() as _,
        ObjectName: &unicode,
        Attributes: OBJ_CASE_INSENSITIVE,
        SecurityDescriptor: descriptor as _,
        SecurityQualityOfService: null(),
    };
    let mut handle = null_mut();
    let mut status: IO_STATUS_BLOCK = unsafe { zeroed() };
    let result = unsafe { NtCreateFile(
        &mut handle, access | SYNCHRONIZE, &attributes, &mut status, null(), 0,
        share, FILE_CREATE,
        FILE_OPEN_REPARSE_POINT | FILE_SYNCHRONOUS_IO_NONALERT |
            if directory { FILE_DIRECTORY_FILE } else { FILE_NON_DIRECTORY_FILE }, null(), 0,
    ) };
    if result < 0 {
        return Err(io::Error::from_raw_os_error(unsafe { RtlNtStatusToDosError(result) } as i32));
    }
    let handle = unsafe { OwnedHandle::from_raw_handle(handle as _) };
    reject_reparse(&handle)?;
    verify_private_acl(&handle)?;
    Ok(handle)
}

struct LocalAllocation(*mut core::ffi::c_void);

impl Drop for LocalAllocation {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { LocalFree(self.0); }
        }
    }
}

/// Inspect the opened object's owner and DACL, rejecting unknown ACE forms.
/// Private objects allow only explicit user and LocalSystem grants. A data
/// directory may also grant administrators rights and others read-only rights.
fn verify_private_acl(handle: &OwnedHandle) -> io::Result<()> {
    verify_acl_mode(handle, true, false)
}

fn verify_ancestor_acl(handle: &OwnedHandle) -> io::Result<()> {
    verify_acl_mode(handle, false, true)
}

fn verify_acl(handle: &OwnedHandle, private: bool) -> io::Result<()> {
    verify_acl_mode(handle, private, false)
}

fn verify_acl_mode(handle: &OwnedHandle, private: bool, ancestor: bool) -> io::Result<()> {
    let mut raw_token = null_mut();
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut raw_token) } == 0 {
        return Err(io::Error::last_os_error());
    }
    let token = unsafe { OwnedHandle::from_raw_handle(raw_token as _) };
    let mut bytes = 0u32;
    unsafe { GetTokenInformation(token.as_raw_handle() as _, TokenUser, null_mut(), 0, &mut bytes); }
    if bytes < size_of::<TOKEN_USER>() as u32 {
        return Err(io::Error::last_os_error());
    }
    let mut token_data = vec![0usize; (bytes as usize + size_of::<usize>() - 1) / size_of::<usize>()];
    if unsafe {
        GetTokenInformation(token.as_raw_handle() as _, TokenUser, token_data.as_mut_ptr() as _, bytes, &mut bytes)
    } == 0 {
        return Err(io::Error::last_os_error());
    }
    let user = unsafe { (*(token_data.as_ptr() as *const TOKEN_USER)).User.Sid };
    if user.is_null() || unsafe { IsValidSid(user) } == 0 {
        return Err(invalid("invalid token user SID"));
    }
    // The Windows servicing identity owns protected system ancestors on normal
    // installations. It is privileged like SYSTEM, not an untrusted user.
    let mut trusted_installer = null_mut();
    let trusted_installer_sid = if ancestor {
        let value: Vec<u16> = "S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464"
            .encode_utf16().chain(Some(0)).collect();
        if unsafe { ConvertStringSidToSidW(value.as_ptr(), &mut trusted_installer) } == 0 {
            return Err(io::Error::last_os_error());
        }
        Some(LocalAllocation(trusted_installer))
    } else {
        None
    };
    let is_trusted_installer = |sid| trusted_installer_sid.as_ref()
        .is_some_and(|trusted| unsafe { EqualSid(sid, trusted.0) } != 0);

    let mut owner = null_mut();
    let mut dacl: *mut ACL = null_mut();
    let mut descriptor = null_mut();
    let status = unsafe {
        GetSecurityInfo(handle.as_raw_handle() as _, SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
            &mut owner, null_mut(), &mut dacl, null_mut(), &mut descriptor)
    };
    if status != 0 {
        return Err(io::Error::from_raw_os_error(status as i32));
    }
    let _descriptor = LocalAllocation(descriptor);
    if owner.is_null() || unsafe { IsValidSid(owner) } == 0
        || (unsafe { EqualSid(owner, user) } == 0
            && !(ancestor && (unsafe { IsWellKnownSid(owner, WinLocalSystemSid) } != 0
                || unsafe { IsWellKnownSid(owner, WinBuiltinAdministratorsSid) } != 0
                || is_trusted_installer(owner)))) {
        let mut text = null_mut();
        if !owner.is_null() && unsafe { IsValidSid(owner) } != 0
            && unsafe { ConvertSidToStringSidW(owner, &mut text) } != 0
        {
            let _text = LocalAllocation(text as _);
            let mut len = 0usize;
            while len < 184 && unsafe { *text.add(len) } != 0 { len += 1; }
            let sid = String::from_utf16_lossy(unsafe { std::slice::from_raw_parts(text, len) });
            return Err(io::Error::new(io::ErrorKind::InvalidData, format!("protected object has unexpected owner {sid}, ancestor={ancestor}")));
        }
        return Err(invalid("protected object has unexpected owner"));
    }
    let mut control = 0u16;
    let mut revision = 0u32;
    if unsafe { GetSecurityDescriptorControl(descriptor, &mut control, &mut revision) } == 0 {
        return Err(io::Error::last_os_error());
    }
    let mut present = 0;
    let mut defaulted = 0;
    let mut actual_dacl = null_mut();
    if unsafe { GetSecurityDescriptorDacl(descriptor, &mut present, &mut actual_dacl, &mut defaulted) } == 0 {
        return Err(io::Error::last_os_error());
    }
    if present == 0 || actual_dacl.is_null() || actual_dacl != dacl
        || (private && control & SE_DACL_PROTECTED == 0) || unsafe { IsValidAcl(dacl) } == 0 {
        return Err(invalid("missing or unprotected DACL"));
    }
    let mut info = ACL_SIZE_INFORMATION::default();
    if unsafe {
        GetAclInformation(dacl, &mut info as *mut _ as _, size_of::<ACL_SIZE_INFORMATION>() as u32, AclSizeInformation)
    } == 0 {
        return Err(io::Error::last_os_error());
    }
    let mut user_allowed = false;
    let mut system_allowed = false;
    for index in 0..info.AceCount {
        let mut raw_ace = null_mut();
        if unsafe { GetAce(dacl, index, &mut raw_ace) } == 0 {
            return Err(io::Error::last_os_error());
        }
        let ace = unsafe { &*(raw_ace as *const ACCESS_ALLOWED_ACE) };
        // SID starts at byte 8. Check the variable-length SID stays inside ACE.
        if ace.Header.AceType != 0 || ace.Header.AceSize < 16
            || (private && (ace.Header.AceFlags as u32 & INHERITED_ACE != 0 || ace.Header.AceFlags & !3 != 0))
            || (!private && ace.Header.AceFlags & !31 != 0) {
            return Err(invalid("unexpected private DACL ACE"));
        }
        let sid = &ace.SidStart as *const u32 as *mut core::ffi::c_void;
        let count = unsafe { *((sid as *const u8).add(1)) } as usize;
        if 8usize + 8 + count * 4 > ace.Header.AceSize as usize || unsafe { IsValidSid(sid) } == 0 {
            return Err(invalid("invalid ACE SID"));
        }
        if unsafe { EqualSid(sid, user) } != 0 {
            user_allowed = true;
        } else if unsafe { IsWellKnownSid(sid, WinLocalSystemSid) } != 0 {
            system_allowed = true;
        } else if private {
            return Err(invalid("untrusted private DACL grant"));
        } else if unsafe { IsWellKnownSid(sid, WinBuiltinAdministratorsSid) } == 0
            && !(ancestor && is_trusted_installer(sid)) {
            if ancestor {
                // DELETE_CHILD, DELETE, WRITE_DAC, WRITE_OWNER, GENERIC_WRITE,
                // and GENERIC_ALL can remove or replace a descendant.
                const MUTATION: u32 = 0x40 | 0x0001_0000 | 0x0004_0000
                    | 0x0008_0000 | 0x4000_0000 | 0x1000_0000;
                if ace.Mask & MUTATION != 0 {
                    let mut text = null_mut();
                    if unsafe { ConvertSidToStringSidW(sid, &mut text) } != 0 {
                        let _text = LocalAllocation(text as _);
                        let mut len = 0usize;
                        while len < 184 && unsafe { *text.add(len) } != 0 { len += 1; }
                        let value = String::from_utf16_lossy(unsafe { std::slice::from_raw_parts(text, len) });
                        return Err(io::Error::new(io::ErrorKind::InvalidData, format!("untrusted ancestor deletion grant sid={value} mask={:#x} flags={:#x}", ace.Mask, ace.Header.AceFlags)));
                    }
                    return Err(invalid("untrusted ancestor deletion grant"));
                }
            } else {
                use windows_sys::Win32::Storage::FileSystem::{FILE_GENERIC_EXECUTE, FILE_GENERIC_READ};
                use windows_sys::Win32::Foundation::{GENERIC_EXECUTE, GENERIC_READ};
                let read_only = FILE_GENERIC_READ | FILE_GENERIC_EXECUTE | GENERIC_READ | GENERIC_EXECUTE;
                if ace.Mask & !read_only != 0 {
                    return Err(invalid("untrusted data directory mutation grant"));
                }
            }
        }
    }
    if private && (!user_allowed || !system_allowed) {
        return Err(invalid("private DACL missing required principal"));
    }
    Ok(())
}

fn file_info<T: Default>(handle: &OwnedHandle, class: i32) -> io::Result<T> {
    let mut result = T::default();
    let ok = unsafe {
        GetFileInformationByHandleEx(handle.as_raw_handle() as _, class,
            &mut result as *mut T as _, size_of::<T>() as u32)
    };
    if ok == 0 { Err(io::Error::last_os_error()) } else { Ok(result) }
}

/// Reject reparse points on the opened object itself.
fn reject_reparse(handle: &OwnedHandle) -> io::Result<()> {
    let info: FILE_ATTRIBUTE_TAG_INFO = file_info(handle, FileAttributeTagInfo)?;
    if info.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
        return Err(invalid("reparse point in protected path"));
    }
    Ok(())
}

/// Inspect a held regular-file handle and reject multiple links and deletion.
/// This does not verify the object's owner, DACL, or containing filesystem.
fn regular_file_identity(handle: &OwnedHandle) -> io::Result<FileIdentity> {
    reject_reparse(handle)?;
    if unsafe { windows_sys::Win32::Storage::FileSystem::GetFileType(handle.as_raw_handle() as _) }
        != windows_sys::Win32::Storage::FileSystem::FILE_TYPE_DISK {
        return Err(invalid("protected record is not a disk file"));
    }
    let info: FILE_STANDARD_INFO = file_info(handle, FileStandardInfo)?;
    if info.Directory || info.DeletePending || info.NumberOfLinks != 1 {
        return Err(invalid("protected record is not a singly linked regular file"));
    }
    let id: FILE_ID_INFO = file_info(handle, FileIdInfo)?;
    Ok(FileIdentity { volume_serial: id.VolumeSerialNumber, file_id: id.FileId.Identifier })
}

/// Delete the held file itself, not a subsequent lookup of its name. The
/// caller must hold the publication lock, validate its ACL and directory, and
/// compare the identity and complete record before calling this primitive.
fn delete_opened(handle: &OwnedHandle, expected: FileIdentity) -> io::Result<()> {
    if regular_file_identity(handle)? != expected {
        return Err(invalid("protected record identity changed"));
    }
    let info = FILE_DISPOSITION_INFO { DeleteFile: true };
    let ok = unsafe {
        SetFileInformationByHandle(handle.as_raw_handle() as _, FileDispositionInfo,
            &info as *const _ as _, size_of::<FILE_DISPOSITION_INFO>() as u32)
    };
    if ok == 0 { Err(io::Error::last_os_error()) } else { Ok(()) }
}

/// Rename the held file relative to the held directory, never replacing a
/// target. The same security and lock preconditions as `delete_opened` apply.
fn rename_opened_no_replace(handle: &OwnedHandle, expected: FileIdentity,
                            directory: &OwnedHandle, name: &OsStr) -> io::Result<()> {
    if regular_file_identity(handle)? != expected {
        return Err(invalid("protected record identity changed"));
    }
    let name = component(name)?;
    // Vec<usize> ensures the structure's native pointer alignment.
    let offset = std::mem::offset_of!(FILE_RENAME_INFORMATION, FileName);
    let bytes = offset.checked_add(name.len() * 2).ok_or_else(|| invalid("name too long"))?
        .max(size_of::<FILE_RENAME_INFORMATION>());
    let mut storage = vec![0usize; (bytes + size_of::<usize>() - 1) / size_of::<usize>()];
    let info = storage.as_mut_ptr() as *mut FILE_RENAME_INFORMATION;
    unsafe {
        (*info).Anonymous.ReplaceIfExists = false;
        (*info).RootDirectory = directory.as_raw_handle() as _;
        (*info).FileNameLength = (name.len() * 2) as u32;
        std::ptr::copy_nonoverlapping(name.as_ptr(), (*info).FileName.as_mut_ptr(), name.len());
        let mut status_block: IO_STATUS_BLOCK = zeroed();
        let status = NtSetInformationFile(handle.as_raw_handle() as _, &mut status_block,
            info as _, bytes as u32, FileRenameInformation);
        if status < 0 {
            return Err(io::Error::from_raw_os_error(RtlNtStatusToDosError(status) as i32));
        }
    }
    Ok(())
}

/// A lock over a permanent, previously verified private lock file. The
/// retained handle denies delete sharing so the locked inode cannot be swapped
/// while this guard exists. The caller must pin and verify the parent too.
struct PublicationGuard<'a> {
    handle: OwnedHandle,
    _directory: &'a PinnedDirectory,
}

impl<'a> PublicationGuard<'a> {
    fn open(directory: &'a PinnedDirectory, create: bool) -> io::Result<Self> {
        use windows_sys::Win32::Storage::FileSystem::{FILE_READ_DATA, FILE_WRITE_DATA};
        let name = OsStr::new("descriptor-publication.lock");
        let access = FILE_READ_ATTRIBUTES | FILE_READ_DATA | FILE_WRITE_DATA | READ_CONTROL;
        let opened = || open_child_with_share(directory.handle(), name, false, access, FILE_SHARE_READ | FILE_SHARE_WRITE);
        let handle = match opened() {
            Ok(handle) => handle,
            Err(error) if create && error.kind() == io::ErrorKind::NotFound => {
                match create_private_child_with_share(directory.handle(), name, false, access, FILE_SHARE_READ | FILE_SHARE_WRITE) {
                    Ok(created) => drop(created),
                    Err(error) if error.kind() == io::ErrorKind::AlreadyExists => (),
                    Err(error) => return Err(error),
                }
                opened()?
            }
            Err(error) => return Err(error),
        };
        Self::acquire(handle, directory)
    }

    fn acquire(handle: OwnedHandle, directory: &'a PinnedDirectory) -> io::Result<Self> {
        regular_file_identity(&handle)?;
        verify_private_acl(&handle)?;
        let mut overlapped: OVERLAPPED = unsafe { zeroed() };
        if unsafe { LockFileEx(handle.as_raw_handle() as _, LOCKFILE_EXCLUSIVE_LOCK, 0, 1, 0, &mut overlapped) } == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(Self { handle, _directory: directory })
    }
}

impl Drop for PublicationGuard<'_> {
    fn drop(&mut self) {
        let mut overlapped: OVERLAPPED = unsafe { zeroed() };
        unsafe { UnlockFileEx(self.handle.as_raw_handle() as _, 0, 1, 0, &mut overlapped); }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, OpenOptions};
    use std::os::windows::fs::OpenOptionsExt;
    use std::path::Path;
    use windows_sys::Win32::Storage::FileSystem::{
        DELETE, FILE_ADD_FILE, FILE_ADD_SUBDIRECTORY, FILE_FLAG_BACKUP_SEMANTICS, FILE_READ_ATTRIBUTES,
        FILE_READ_DATA, FILE_WRITE_DATA, LOCKFILE_FAIL_IMMEDIATELY, READ_CONTROL,
    };

    fn dir(path: &Path) -> OwnedHandle {
        OpenOptions::new().read(true)
            .access_mode(FILE_READ_ATTRIBUTES | FILE_ADD_FILE | FILE_ADD_SUBDIRECTORY | READ_CONTROL | SYNCHRONIZE)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
            .custom_flags(FILE_FLAG_BACKUP_SEMANTICS)
            .open(path).unwrap().into()
    }

    #[test]
    fn rejects_device_aliases_and_stream_names() {
        for name in ["CON", "nul.txt", "COM1.foo", "LPT²", "a:b", "..", "trailing.", "name "] {
            assert!(component(OsStr::new(name)).is_err(), "{name}");
        }
        assert!(component(OsStr::new("descriptor.json")).is_ok());
    }

    #[test]
    fn rejects_hard_linked_secret_by_open_handle() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(temp.path().join("secret"), b"secret").unwrap();
        fs::hard_link(temp.path().join("secret"), temp.path().join("alias")).unwrap();
        let parent = dir(temp.path());
        let file = open_child(&parent, OsStr::new("secret"), false, FILE_READ_ATTRIBUTES | FILE_READ_DATA).unwrap();
        assert!(regular_file_identity(&file).is_err());
    }

    #[test]
    fn rejects_opened_file_symlink() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(temp.path().join("target"), b"secret").unwrap();
        std::os::windows::fs::symlink_file(temp.path().join("target"), temp.path().join("link"))
            .expect("native runner must allow creation of test symlinks");
        let parent = dir(temp.path());
        assert!(open_child(&parent, OsStr::new("link"), false, FILE_READ_ATTRIBUTES | FILE_READ_DATA).is_err());
    }

    #[test]
    fn rejects_inherited_dacl_on_file() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(temp.path().join("inherited"), b"record").unwrap();
        let parent = dir(temp.path());
        let file = open_child(&parent, OsStr::new("inherited"), false,
            FILE_READ_ATTRIBUTES | READ_CONTROL).unwrap();
        assert!(verify_private_acl(&file).is_err());
    }

    #[test]
    fn private_creation_and_handle_identity() {
        let temp = tempfile::tempdir().unwrap();
        let parent = dir(temp.path());
        let file = create_private_child(&parent, OsStr::new("private"), false,
            FILE_READ_ATTRIBUTES | FILE_READ_DATA | FILE_WRITE_DATA | READ_CONTROL | DELETE).unwrap();
        verify_private_acl(&file).unwrap();
        let id = regular_file_identity(&file).unwrap();
        assert_eq!(id, regular_file_identity(&file).unwrap());
        assert!(create_private_child(&parent, OsStr::new("private"), false,
            FILE_READ_ATTRIBUTES | READ_CONTROL).is_err());
    }

    #[test]
    fn rename_does_not_replace_and_delete_checks_identity() {
        let temp = tempfile::tempdir().unwrap();
        let parent = dir(temp.path());
        let file = create_private_child(&parent, OsStr::new("first"), false,
            FILE_READ_ATTRIBUTES | READ_CONTROL | DELETE).unwrap();
        let id = regular_file_identity(&file).unwrap();
        let other = create_private_child(&parent, OsStr::new("second"), false,
            FILE_READ_ATTRIBUTES | READ_CONTROL | DELETE).unwrap();
        let other_id = regular_file_identity(&other).unwrap();
        drop(other);
        assert!(rename_opened_no_replace(&file, id, &parent, OsStr::new("second")).is_err());
        assert!(delete_opened(&file, other_id).is_err());
        assert_eq!(id, regular_file_identity(&file).unwrap());
        rename_opened_no_replace(&file, id, &parent, OsStr::new("third")).unwrap();
        delete_opened(&file, id).unwrap();
        drop(file);
        assert!(!temp.path().join("third").exists());
        assert!(temp.path().join("second").exists());
    }

    #[test]
    fn publication_lock_serializes_open_handles() {
        let temp = tempfile::tempdir().unwrap();
        let parent = dir(temp.path());
        let access = FILE_READ_ATTRIBUTES | FILE_TRAVERSE | FILE_ADD_FILE | FILE_ADD_SUBDIRECTORY | READ_CONTROL;
        let private = create_private_child(&parent, OsStr::new("private"), true, access).unwrap();
        let pinned = PinnedDirectory { handles: vec![parent, private] };
        let first = PublicationGuard::open(&pinned, true).unwrap();
        let lock = open_child_with_share(pinned.handle(), OsStr::new("descriptor-publication.lock"), false,
            FILE_READ_ATTRIBUTES | FILE_READ_DATA | FILE_WRITE_DATA | READ_CONTROL,
            FILE_SHARE_READ | FILE_SHARE_WRITE).unwrap();
        let mut overlapped: OVERLAPPED = unsafe { zeroed() };
        let flags = LOCKFILE_EXCLUSIVE_LOCK | LOCKFILE_FAIL_IMMEDIATELY;
        assert_eq!(unsafe { LockFileEx(lock.as_raw_handle() as _, flags, 0, 1, 0, &mut overlapped) }, 0);
        drop(first);
        assert_ne!(unsafe { LockFileEx(lock.as_raw_handle() as _, flags, 0, 1, 0, &mut overlapped) }, 0);
        assert_ne!(unsafe { UnlockFileEx(lock.as_raw_handle() as _, 0, 1, 0, &mut overlapped) }, 0);
    }

    #[test]
    fn pinned_traversal_keeps_directory_in_place() {
        let temp = tempfile::tempdir().unwrap();
        let parent = dir(temp.path());
        let access = FILE_READ_ATTRIBUTES | FILE_TRAVERSE | FILE_ADD_FILE | FILE_ADD_SUBDIRECTORY | READ_CONTROL;
        let private = create_private_child(&parent, OsStr::new("private"), true, access).unwrap();
        drop(private);
        drop(parent);
        let pinned = PinnedDirectory::open_data_directory(&temp.path().join("private")).unwrap();
        assert!(fs::rename(temp.path().join("private"), temp.path().join("moved")).is_err());
        drop(pinned);
        fs::rename(temp.path().join("private"), temp.path().join("moved")).unwrap();
    }

    #[test]
    fn bounded_record_reads_reject_oversized_bytes() {
        let temp = tempfile::tempdir().unwrap();
        let parent = dir(temp.path());
        let access = FILE_READ_ATTRIBUTES | FILE_TRAVERSE | FILE_ADD_FILE | FILE_ADD_SUBDIRECTORY | READ_CONTROL;
        let private = create_private_child(&parent, OsStr::new("private"), true, access).unwrap();
        let pinned = PinnedDirectory { handles: vec![parent, private] };
        let (name, mut record) = PrivateRecord::create_temp(&pinned, b"payload").unwrap();
        assert_eq!(record.read().unwrap(), b"payload");
        assert!(PrivateRecord::create_temp(&pinned, &vec![0; PrivateRecord::LIMIT + 1]).is_err());
        drop(record);
        let mut reopened = PrivateRecord::open(&pinned, OsStr::new(&name), false).unwrap();
        assert_eq!(reopened.read().unwrap(), b"payload");
    }

    #[test]
    fn lifetime_and_publication_ranges_are_distinct() {
        let temp = tempfile::tempdir().unwrap();
        let parent = dir(temp.path());
        let access = FILE_READ_ATTRIBUTES | FILE_TRAVERSE | FILE_ADD_FILE | FILE_ADD_SUBDIRECTORY | READ_CONTROL;
        let private = create_private_child(&parent, OsStr::new("private"), true, access).unwrap();
        let pinned = PinnedDirectory { handles: vec![parent, private] };
        drop(PublicationGuard::open(&pinned, true).unwrap());
        let lease = CoordinatorLease::acquire(&pinned).unwrap();
        assert!(CoordinatorLease::acquire(&pinned).is_err());
        drop(lease.guard().unwrap());
        drop(lease);
        assert!(CoordinatorLease::acquire(&pinned).is_ok());
    }

    #[test]
    fn exact_generation_controls_publication_withdrawal_and_cleanup() {
        let temp = tempfile::tempdir().unwrap();
        let parent = dir(temp.path());
        let access = FILE_READ_ATTRIBUTES | FILE_TRAVERSE | FILE_ADD_FILE | FILE_ADD_SUBDIRECTORY | READ_CONTROL;
        let private = create_private_child(&parent, OsStr::new("private"), true, access).unwrap();
        let pinned = PinnedDirectory { handles: vec![parent, private] };
        drop(PublicationGuard::open(&pinned, true).unwrap());
        let lease = CoordinatorLease::acquire(&pinned).unwrap();
        let guard = lease.guard().unwrap();
        let (_, binding_record) = PrivateRecord::create_temp(&pinned, b"binding").unwrap();
        let binding_id = binding_record.identity;
        let binding_handle: OwnedHandle = binding_record.file.into();
        rename_opened_no_replace(&binding_handle, binding_id, pinned.handle(), OsStr::new("binding")).unwrap();
        drop(binding_handle);
        let binding = guard.read(OsStr::new("binding")).unwrap().unwrap();
        drop(guard);
        let first = lease.publish(OsStr::new("binding"), &binding, OsStr::new("coordinator.json"), None, b"first").unwrap();
        assert!(first.retirement_cleanup_error.is_none());
        let mut wrong = first.snapshot.clone();
        wrong.bytes = b"forged".to_vec();
        assert!(lease.publish(OsStr::new("binding"), &binding, OsStr::new("coordinator.json"), Some(&wrong), b"wrong").is_err());
        let second = lease.publish(OsStr::new("binding"), &binding, OsStr::new("coordinator.json"), Some(&first.snapshot), b"second").unwrap();
        assert!(second.retirement_cleanup_error.is_none());
        let guard = lease.guard().unwrap();
        assert!(guard.remove(OsStr::new("coordinator.json"), &first.snapshot).is_err());
        assert!(guard.withdraw(OsStr::new("coordinator.json"), &first.snapshot, OsStr::new("stopping")).is_err());
        assert_eq!(guard.read(OsStr::new("coordinator.json")).unwrap(), Some(second.snapshot.clone()));
        guard.withdraw(OsStr::new("coordinator.json"), &second.snapshot, OsStr::new("stopping")).unwrap();
        assert!(guard.read(OsStr::new("coordinator.json")).unwrap().is_none());
        guard.remove(OsStr::new("stopping"), &second.snapshot).unwrap();
    }

    #[test]
    fn no_replace_install_and_stopping_collision_leave_occupants_intact() {
        let temp = tempfile::tempdir().unwrap();
        let parent = dir(temp.path());
        let access = FILE_READ_ATTRIBUTES | FILE_TRAVERSE | FILE_ADD_FILE | FILE_ADD_SUBDIRECTORY | READ_CONTROL;
        let private = create_private_child(&parent, OsStr::new("private"), true, access).unwrap();
        let pinned = PinnedDirectory { handles: vec![parent, private] };
        drop(PublicationGuard::open(&pinned, true).unwrap());
        let guard = RecordGuard::open(&pinned).unwrap();
        let active = guard.create_if_absent(OsStr::new("active"), b"active").unwrap();
        let occupant = guard.create_if_absent(OsStr::new("stopping"), b"occupant").unwrap();
        assert!(guard.create_if_absent(OsStr::new("active"), b"replacement").is_err());
        assert!(guard.withdraw(OsStr::new("active"), &active, OsStr::new("stopping")).is_err());
        assert_eq!(guard.read(OsStr::new("active")).unwrap(), Some(active));
        assert_eq!(guard.read(OsStr::new("stopping")).unwrap(), Some(occupant));
    }

    #[test]
    fn missing_permanent_lock_is_not_recreated_by_reader_or_lease() {
        let temp = tempfile::tempdir().unwrap();
        let parent = dir(temp.path());
        let access = FILE_READ_ATTRIBUTES | FILE_TRAVERSE | FILE_ADD_FILE | FILE_ADD_SUBDIRECTORY | READ_CONTROL;
        let private = create_private_child(&parent, OsStr::new("private"), true, access).unwrap();
        let pinned = PinnedDirectory { handles: vec![parent, private] };
        assert!(RecordGuard::open(&pinned).is_err());
        assert!(CoordinatorLease::acquire(&pinned).is_err());
        assert!(!temp.path().join("private").join("descriptor-publication.lock").exists());
    }

    #[test]
    fn interrupted_retirement_is_absence_not_authority_to_replace() {
        let temp = tempfile::tempdir().unwrap();
        let parent = dir(temp.path());
        let access = FILE_READ_ATTRIBUTES | FILE_TRAVERSE | FILE_ADD_FILE | FILE_ADD_SUBDIRECTORY | READ_CONTROL;
        let private = create_private_child(&parent, OsStr::new("private"), true, access).unwrap();
        let pinned = PinnedDirectory { handles: vec![parent, private] };
        drop(PublicationGuard::open(&pinned, true).unwrap());
        let guard = RecordGuard::open(&pinned).unwrap();
        let old = guard.create_if_absent(OsStr::new("active"), b"old").unwrap();
        let record = guard.checked(OsStr::new("active"), &old).unwrap();
        let handle: OwnedHandle = record.file.into();
        rename_opened_no_replace(&handle, old.identity, pinned.handle(), OsStr::new(".han-retired-test.tmp")).unwrap();
        drop(handle);
        drop(guard);
        let guard = RecordGuard::open(&pinned).unwrap();
        assert!(guard.read(OsStr::new("active")).unwrap().is_none());
        let new = guard.create_if_absent(OsStr::new("active"), b"new").unwrap();
        assert!(guard.withdraw(OsStr::new(".han-retired-test.tmp"), &old, OsStr::new("active")).is_err());
        assert_eq!(guard.read(OsStr::new("active")).unwrap(), Some(new));
    }
}

/// A held record handle. These primitives are intentionally not exported to
/// the dispatcher until path, ACL and publication-lock policy is complete.
struct PrivateRecord {
    file: std::fs::File,
    identity: FileIdentity,
}

impl PrivateRecord {
    const LIMIT: usize = 64 * 1024;

    fn open(directory: &PinnedDirectory, name: &OsStr, mutate: bool) -> io::Result<Self> {
        use windows_sys::Win32::Storage::FileSystem::{FILE_READ_DATA, DELETE};
        let access = FILE_READ_ATTRIBUTES | FILE_READ_DATA | READ_CONTROL | if mutate { DELETE } else { 0 };
        let share = if mutate { 0 } else { FILE_SHARE_READ };
        let handle = open_child_with_share(directory.handle(), name, false, access, share)?;
        verify_private_acl(&handle)?;
        let identity = regular_file_identity(&handle)?;
        Ok(Self { file: handle.into(), identity })
    }

    fn read(&mut self) -> io::Result<Vec<u8>> {
        self.file.seek(SeekFrom::Start(0))?;
        let mut data = Vec::new();
        (&mut self.file).take(Self::LIMIT as u64 + 1).read_to_end(&mut data)?;
        if data.len() > Self::LIMIT { return Err(invalid("record exceeds size limit")); }
        Ok(data)
    }

    fn create_temp(directory: &PinnedDirectory, data: &[u8]) -> io::Result<(String, Self)> {
        use windows_sys::Win32::Storage::FileSystem::{FILE_READ_DATA, FILE_WRITE_DATA, DELETE};
        if data.len() > Self::LIMIT { return Err(invalid("record exceeds size limit")); }
        let name = format!(".han-{}.tmp", uuid::Uuid::new_v4());
        let handle = create_private_child(directory.handle(), OsStr::new(&name), false,
            FILE_READ_ATTRIBUTES | FILE_READ_DATA | FILE_WRITE_DATA | READ_CONTROL | DELETE)?;
        let identity = regular_file_identity(&handle)?;
        let mut file = std::fs::File::from(handle);
        if let Err(write_error) = file.write_all(data).and_then(|()| file.sync_all()) {
            let handle: OwnedHandle = file.into();
            if let Err(cleanup_error) = delete_opened(&handle, identity) {
                return Err(io::Error::other(format!("temporary write failed: {write_error}; cleanup failed: {cleanup_error}")));
            }
            return Err(write_error);
        }
        Ok((name, Self { file, identity }))
    }
}

/// Snapshot of the complete validated record and its native file identity.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct RecordSnapshot {
    pub(crate) identity: FileIdentity,
    pub(crate) bytes: Vec<u8>,
}

/// Holds byte 1 until coordinator teardown. Never acquired under byte 0.
pub(crate) struct CoordinatorLease<'a> {
    directory: &'a PinnedDirectory,
    handle: OwnedHandle,
}

impl<'a> CoordinatorLease<'a> {
    pub(crate) fn acquire(directory: &'a PinnedDirectory) -> io::Result<Self> {
        use windows_sys::Win32::Storage::FileSystem::{FILE_READ_DATA, FILE_WRITE_DATA, LOCKFILE_FAIL_IMMEDIATELY};
        let access = FILE_READ_ATTRIBUTES | FILE_READ_DATA | FILE_WRITE_DATA | READ_CONTROL;
        let handle = open_child_with_share(directory.handle(), OsStr::new("descriptor-publication.lock"),
            false, access, FILE_SHARE_READ | FILE_SHARE_WRITE)?;
        regular_file_identity(&handle)?;
        verify_private_acl(&handle)?;
        let mut offset: OVERLAPPED = unsafe { zeroed() };
        unsafe { offset.Anonymous.Anonymous.Offset = 1; }
        if unsafe { LockFileEx(handle.as_raw_handle() as _, LOCKFILE_EXCLUSIVE_LOCK | LOCKFILE_FAIL_IMMEDIATELY,
            0, 1, 0, &mut offset) } == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(Self { directory, handle })
    }

    /// Caller must validate the current ownership binding while holding this
    /// guard, then publish before dropping it. The lease alone is not ownership.
    pub(crate) fn guard(&self) -> io::Result<RecordGuard<'_>> {
        RecordGuard::open(self.directory)
    }
}

impl Drop for CoordinatorLease<'_> {
    fn drop(&mut self) {
        let mut offset: OVERLAPPED = unsafe { zeroed() };
        unsafe {
            offset.Anonymous.Anonymous.Offset = 1;
            UnlockFileEx(self.handle.as_raw_handle() as _, 0, 1, 0, &mut offset);
        }
    }
}

/// Exclusive byte-0 guard. Record handles never escape its lifetime.
pub(crate) struct RecordGuard<'a> {
    guard: PublicationGuard<'a>,
}

impl<'a> RecordGuard<'a> {
    pub(crate) fn open(directory: &'a PinnedDirectory) -> io::Result<Self> {
        Ok(Self { guard: PublicationGuard::open(directory, false)? })
    }

    pub(crate) fn read(&self, name: &OsStr) -> io::Result<Option<RecordSnapshot>> {
        let mut record = match PrivateRecord::open(self.guard._directory, name, false) {
            Ok(record) => record,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error),
        };
        Ok(Some(RecordSnapshot { identity: record.identity, bytes: record.read()? }))
    }

    /// Install a complete record only if its leaf is unoccupied.
    pub(crate) fn create_if_absent(&self, name: &OsStr, bytes: &[u8]) -> io::Result<RecordSnapshot> {
        let (_, record) = PrivateRecord::create_temp(self.guard._directory, bytes)?;
        let identity = record.identity;
        let handle: OwnedHandle = record.file.into();
        if let Err(error) = rename_opened_no_replace(&handle, identity, self.guard._directory.handle(), name) {
            if let Err(cleanup) = delete_opened(&handle, identity) {
                return Err(io::Error::other(format!("installation failed: {error}; temporary cleanup failed: {cleanup}")));
            }
            return Err(error);
        }
        Ok(RecordSnapshot { identity, bytes: bytes.to_vec() })
    }

    fn checked(&self, name: &OsStr, expected: &RecordSnapshot) -> io::Result<PrivateRecord> {
        let mut record = PrivateRecord::open(self.guard._directory, name, true)?;
        if record.identity != expected.identity || record.read()? != expected.bytes {
            return Err(invalid("record identity or contents changed"));
        }
        Ok(record)
    }

    /// Checks complete binding bytes and identity under the guard. The guard
    /// must remain held through the subsequent operation.
    pub(crate) fn matches(&self, name: &OsStr, expected: &RecordSnapshot) -> io::Result<bool> {
        Ok(self.read(name)?.as_ref() == Some(expected))
    }

    /// Rename a validated record to a generation-specific destination, never
    /// replacing an existing stopping intent or another generation's file.
    pub(crate) fn withdraw(&self, name: &OsStr, expected: &RecordSnapshot, stopping: &OsStr) -> io::Result<()> {
        let record = self.checked(name, expected)?;
        let handle: OwnedHandle = record.file.into();
        rename_opened_no_replace(&handle, record.identity, self.guard._directory.handle(), stopping)
    }

    /// Remove only the exact opened generation, including during delayed cleanup.
    pub(crate) fn remove(&self, name: &OsStr, expected: &RecordSnapshot) -> io::Result<()> {
        let record = self.checked(name, expected)?;
        let handle: OwnedHandle = record.file.into();
        delete_opened(&handle, record.identity)
    }
}

/// A successful installation can leave a private retired orphan if cleanup
/// fails. This result cannot be confused with a failed installation.
pub(crate) struct Publication {
    pub(crate) snapshot: RecordSnapshot,
    pub(crate) retirement_cleanup_error: Option<io::Error>,
}

impl CoordinatorLease<'_> {
    /// Verify the binding and exact predecessor before retiring the old handle.
    /// None means the active leaf must be absent, not that a PID is dead.
    pub(crate) fn publish(&self, binding_name: &OsStr, binding: &RecordSnapshot,
        active_name: &OsStr, predecessor: Option<&RecordSnapshot>, bytes: &[u8]) -> io::Result<Publication> {
        let guard = self.guard()?;
        self.publish_guarded(&guard, &[(binding_name, binding)], active_name, predecessor, bytes)
    }

    /// Compare every ownership record under one continuously held publication
    /// guard before retiring or installing any active record.
    pub(crate) fn publish_guarded(&self, guard: &RecordGuard<'_>,
        bindings: &[(&OsStr, &RecordSnapshot)], active_name: &OsStr,
        predecessor: Option<&RecordSnapshot>, bytes: &[u8]) -> io::Result<Publication> {
        if !std::ptr::eq(self.directory, guard.guard._directory) || bindings.is_empty() {
            return Err(invalid("publisher guard or bindings invalid"));
        }
        for (name, expected) in bindings {
            if !guard.matches(name, expected)? {
                return Err(invalid("publisher binding changed"));
            }
        }
        let (_, temporary) = PrivateRecord::create_temp(self.directory, bytes)?;
        let temp_id = temporary.identity;
        let temp_handle: OwnedHandle = temporary.file.into();
        let old = match predecessor {
            Some(expected) => match guard.checked(active_name, expected) {
                Ok(record) => Some(record),
                Err(error) => {
                    delete_opened(&temp_handle, temp_id)?;
                    return Err(error);
                }
            },
            None => None,
        };
        let retired = if let Some(record) = old {
            let id = record.identity;
            let handle: OwnedHandle = record.file.into();
            let retirement = format!(".han-retired-{}.tmp", uuid::Uuid::new_v4());
            if let Err(error) = rename_opened_no_replace(&handle, id, self.directory.handle(), OsStr::new(&retirement)) {
                delete_opened(&temp_handle, temp_id)?;
                return Err(error);
            }
            Some((handle, id))
        } else { None };
        if let Err(error) = rename_opened_no_replace(&temp_handle, temp_id, self.directory.handle(), active_name) {
            let cleanup = delete_opened(&temp_handle, temp_id);
            if let Err(cleanup_error) = cleanup {
                return Err(io::Error::other(format!("publication failed: {error}; temporary cleanup failed: {cleanup_error}")));
            }
            return Err(error);
        }
        let cleanup_error = retired.and_then(|(handle, id)| delete_opened(&handle, id).err());
        Ok(Publication {
            snapshot: RecordSnapshot { identity: temp_id, bytes: bytes.to_vec() },
            retirement_cleanup_error: cleanup_error,
        })
    }
}
