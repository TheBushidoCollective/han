//! Immutable, nonce-keyed Windows supervisor authority records.
//! Stored in <dataDir>/runtime/supervisor.authority.<nonce>.json.
//! Persists the supervisor's full ProcessIdentity independently of the canonical claim.
#![cfg(windows)]

use std::{ffi::OsStr, io};
use serde::{Deserialize, Serialize};
use crate::runtime::Descriptor;
use crate::windows_process_identity::{self as processes, ProcessIdentity};
use crate::windows_secure_fs::{RecordGuard, RecordSnapshot};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Owner {
    pub(crate) version: u32,
    pub(crate) nonce: String,
    pub(crate) process: ProcessIdentity,
}

fn invalid(message: &'static str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

fn uuid(s: &str) -> bool {
    uuid::Uuid::parse_str(s).is_ok_and(|id| id.hyphenated().to_string() == s)
}

pub(crate) fn authority_name(nonce: &str) -> io::Result<String> {
    if !uuid(nonce) {
        return Err(invalid("invalid authority nonce"));
    }
    Ok(format!("supervisor.authority.{nonce}.json"))
}

pub(crate) fn parse_owner(bytes: &[u8]) -> io::Result<Owner> {
    let owner: Owner = serde_json::from_slice(bytes).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    if owner.version != 1 || !uuid(&owner.nonce) {
        return Err(invalid("invalid owner record"));
    }
    processes::validate_identity(&owner.process)?;
    Ok(owner)
}

pub(crate) fn list_authorities(guard: &RecordGuard<'_>) -> io::Result<Vec<(String, RecordSnapshot, Owner)>> {
    let path = guard.directory_path();
    let mut names = Vec::new();
    for entry in std::fs::read_dir(path)? {
        let name = entry?.file_name().into_string().map_err(|_| invalid("invalid authority filename"))?;
        if !name.starts_with("supervisor.authority.") || !name.ends_with(".json") {
            continue;
        }
        let nonce = name
            .strip_prefix("supervisor.authority.")
            .and_then(|s| s.strip_suffix(".json"))
            .ok_or_else(|| invalid("invalid authority name structure"))?;
        if !uuid(nonce) {
            return Err(invalid("non-UUID authority nonce in filename"));
        }
        if names.len() >= 256 {
            return Err(invalid("authority record count exceeds bound"));
        }
        names.push(name);
    }
    names.sort();
    let mut result = Vec::with_capacity(names.len());
    let mut total_bytes = 0usize;
    for name in names {
        let snapshot = guard.read(OsStr::new(&name))?.ok_or_else(|| invalid("authority missing"))?;
        total_bytes = total_bytes.saturating_add(snapshot.bytes.len());
        if total_bytes > 128 * 1024 {
            return Err(invalid("total authority records exceed 128 KiB envelope bound"));
        }
        let owner = parse_owner(&snapshot.bytes)?;
        let nonce = name
            .strip_prefix("supervisor.authority.")
            .and_then(|s| s.strip_suffix(".json"))
            .unwrap();
        if owner.nonce != nonce {
            return Err(invalid("authority record nonce disagrees with filename"));
        }
        result.push((name, snapshot, owner));
    }
    Ok(result)
}

pub(crate) fn ensure_authority(guard: &RecordGuard<'_>, owner: &Owner) -> io::Result<()> {
    if owner.version != 1 || !uuid(&owner.nonce) {
        return Err(invalid("invalid owner for authority"));
    }
    processes::validate_identity(&owner.process)?;
    let name = authority_name(&owner.nonce)?;
    if let Some(existing) = guard.read(OsStr::new(&name))? {
        let parsed = parse_owner(&existing.bytes)?;
        if parsed != *owner {
            return Err(invalid("authority record conflict with existing record"));
        }
        return Ok(());
    }
    let existing_list = list_authorities(guard)?;
    if existing_list.len() >= 256 {
        return Err(invalid("authority count limit exceeded"));
    }
    let bytes = serde_json::to_vec(owner).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    match guard.create_if_absent(OsStr::new(&name), &bytes) {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {
            let record = guard.read(OsStr::new(&name))?.ok_or_else(|| invalid("authority missing on race"))?;
            let parsed = parse_owner(&record.bytes)?;
            if parsed != *owner {
                return Err(invalid("authority record conflict after race"));
            }
            Ok(())
        }
        Err(e) => Err(e),
    }
}

pub(crate) fn resolve_supervisor<'a>(
    descriptor: Option<&Descriptor>,
    claim_owner: Option<&'a Owner>,
    authorities: &'a [(String, RecordSnapshot, Owner)],
) -> io::Result<Option<&'a ProcessIdentity>> {
    if let Some(d) = descriptor {
        if let Some(binding) = &d.supervisor {
            if let Some((_, _, auth)) = authorities
                .iter()
                .find(|(_, _, a)| a.nonce == binding.nonce && a.process.pid == binding.pid)
            {
                return Ok(Some(&auth.process));
            }
            if let Some(owner) = claim_owner {
                if owner.nonce == binding.nonce && owner.process.pid == binding.pid {
                    return Ok(Some(&owner.process));
                }
            }
            return Err(invalid("unresolved supervisor identity for descriptor binding"));
        } else {
            return Ok(None);
        }
    }
    if let Some(owner) = claim_owner {
        Ok(Some(&owner.process))
    } else {
        Ok(None)
    }
}
