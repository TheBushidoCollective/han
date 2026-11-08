//! Bounded, one-request Windows local-runtime helper. The pipe is the only
//! channel carrying descriptor credentials or launcher tokens.
#![cfg(windows)]

use std::{ffi::OsStr, io::{self, Read, Write}, path::{Path, PathBuf}};
use std::future::Future;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use crate::runtime::{Descriptor, SupervisorBinding};
use crate::windows_process_identity::{self as processes, Liveness, ProcessIdentity};
use crate::windows_secure_fs::{FileIdentity, PinnedDirectory, RecordGuard, RecordSnapshot};
use crate::windows_secure_fs::CoordinatorLease;
use crate::windows_supervisor_authority::{self as authorities, Owner};

const MAX_MESSAGE: usize = 128 * 1024;

fn invalid() -> io::Error { io::Error::new(io::ErrorKind::InvalidData, "invalid local-runtime request or record") }

thread_local! {
    static STAGE: std::cell::Cell<&'static str> = const { std::cell::Cell::new("input_read") };
}

fn stage(value: &'static str) { STAGE.with(|current| current.set(value)); }

fn error_kind(error: &io::Error) -> &'static str {
    match error.kind() {
        io::ErrorKind::InvalidData | io::ErrorKind::InvalidInput => "invalid_data",
        io::ErrorKind::NotFound => "not_found",
        io::ErrorKind::PermissionDenied => "permission_denied",
        io::ErrorKind::AlreadyExists => "already_exists",
        io::ErrorKind::TimedOut => "timed_out",
        _ => "other",
    }
}

fn failure(error: &io::Error) -> Value {
    json!({"version":1, "ok":false, "error":{
        "stage":STAGE.with(|current| current.get()),
        "kind":error_kind(error),
        "win32Code":error.raw_os_error()
    }})
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Request {
    version: u32,
    data_dir: PathBuf,
    op: String,
    target: Option<Target>,
    claim: Option<Claim>,
    binding: Option<SupervisorBinding>,
    child_pid: Option<u32>,
    descriptor: Option<Descriptor>,
    origin: Option<String>,
    token: Option<String>,
    name: Option<String>,
    identity: Option<AnyIdentity>,
    process: Option<ProcessIdentity>,
    snapshot: Option<RecoverySnapshot>,
    port: Option<u16>,
    escalate: Option<bool>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
enum AnyIdentity {
    Wire(WireFileIdentity),
    Legacy(crate::legacy_ops::LegacyIdentity),
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
enum Target { Active, Stopping { binding: SupervisorBinding } }

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WireFileIdentity { volume_serial: String, file_id: String }

impl WireFileIdentity {
    fn from_native(id: FileIdentity) -> Self {
        Self { volume_serial: format!("{:016x}", id.volume_serial),
            file_id: id.file_id.iter().map(|b| format!("{b:02x}")).collect() }
    }
    fn validate(&self) -> io::Result<()> {
        if self.volume_serial.len() != 16 || self.file_id.len() != 32 ||
            !self.volume_serial.bytes().chain(self.file_id.bytes()).all(|b| b.is_ascii_hexdigit()) {
            return Err(invalid());
        }
        Ok(())
    }
    fn matches(&self, id: FileIdentity) -> bool {
        let other = Self::from_native(id);
        self.volume_serial.eq_ignore_ascii_case(&other.volume_serial) && self.file_id.eq_ignore_ascii_case(&other.file_id)
    }
}
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RecoveryRecord {
    identity: WireFileIdentity,
    bytes: String,
}

impl RecoveryRecord {
    fn from_native(record: &RecordSnapshot) -> Self {
        Self { identity: WireFileIdentity::from_native(record.identity), bytes: STANDARD.encode(&record.bytes) }
    }
}
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
struct StoppingRecord { name: String, record: RecoveryRecord }
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct AuthorityRecord { name: String, record: RecoveryRecord }


#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RecoverySnapshot {
    platform: String,
    target: Target,
    active: Option<RecoveryRecord>,
    selected: Option<RecoveryRecord>,
    reservation: Option<RecoveryRecord>,
    owner_file: Option<RecoveryRecord>,
    pid_file: Option<RecoveryRecord>,
    stopping_names: Vec<String>,
    stopping: Vec<StoppingRecord>,
    authorities: Vec<AuthorityRecord>,
}


#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Claim {
    nonce: String,
    process: ProcessIdentity,
    reservation: WireFileIdentity,
    owner_file: WireFileIdentity,
    pid_file: WireFileIdentity,
}



fn uuid(s: &str) -> bool { uuid::Uuid::parse_str(s).is_ok_and(|id| id.hyphenated().to_string() == s) }
fn binding(b: &SupervisorBinding) -> io::Result<()> {
    SupervisorBinding::validate(b.pid, b.nonce.clone(), b.generation_id.clone()).map(|_| ())
}
fn token(s: &str) -> bool {
    s.len() == 43 && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}
fn descriptor(d: &Descriptor) -> io::Result<()> {
    if d.transport_version != 1 || d.instance_id.is_empty() || d.pid == 0 || d.https_port == 0 ||
        d.grpc_port == Some(0) || !d.certificate_pem.contains("-----BEGIN CERTIFICATE-----") || !token(&d.bearer_token) {
        return Err(invalid());
    }
    if d.process.pid != d.pid { return Err(invalid()); }
    processes::validate_identity(&d.process)?;
    if let Some(b) = &d.supervisor { binding(b)?; }
    Ok(())
}
fn valid_claim(c: &Claim) -> io::Result<()> {
    if !uuid(&c.nonce) { return Err(invalid()); }
    c.reservation.validate()?; c.owner_file.validate()?; c.pid_file.validate()?;
    // liveness validates the complete identity even when the process is gone.
    processes::liveness(&c.process)?;
    Ok(())
}

fn directory(path: &Path, create: bool) -> io::Result<PinnedDirectory> {
    stage("data_directory");
    let data = if create {
        PinnedDirectory::prepare_data_directory(path)?
    } else {
        PinnedDirectory::open_data_directory(path)?
    };
    stage("runtime_directory");
    data.open_private_child(OsStr::new("runtime"), create)
}
fn read_directory(path: &Path) -> io::Result<Option<PinnedDirectory>> {
    match directory(path, false) {
        Ok(dir) => Ok(Some(dir)),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}
fn names(kind: &str) -> (&'static str, &'static str, &'static str) {
    if kind == "supervisor" { ("supervisor.reservation.json", "supervisor.owner.json", "supervisor.pid") }
    else { ("spawn.reservation.json", "spawn.owner.json", "spawn.pid") }
}
struct Records { reservation: RecordSnapshot, owner_file: RecordSnapshot, pid_file: RecordSnapshot, owner: Owner }
fn records(guard: &RecordGuard<'_>, kind: &str) -> io::Result<Option<Records>> {
    let (r, o, p) = names(kind);
    let (r, o, p) = (guard.read(OsStr::new(r))?, guard.read(OsStr::new(o))?, guard.read(OsStr::new(p))?);
    match (r, o, p) {
        (None, None, None) => Ok(None),
        (Some(reservation), Some(owner_file), Some(pid_file)) => {
            let owner: Owner = serde_json::from_slice(&owner_file.bytes).map_err(|_| invalid())?;
            let other: Owner = serde_json::from_slice(&reservation.bytes).map_err(|_| invalid())?;
            if owner != other || reservation.bytes != owner_file.bytes || owner.version != 1 ||
                !uuid(&owner.nonce) || pid_file.bytes != owner.process.pid.to_string().as_bytes() {
                return Err(invalid());
            }
            if matches!(processes::liveness(&owner.process)?, Liveness::Unknown) { return Err(invalid()); }
            Ok(Some(Records { reservation, owner_file, pid_file, owner }))
        }
        _ => Err(invalid()),
    }
}
fn record_claim(r: &Records) -> Claim {
    Claim { nonce: r.owner.nonce.clone(), process: r.owner.process.clone(),
        reservation: WireFileIdentity::from_native(r.reservation.identity),
        owner_file: WireFileIdentity::from_native(r.owner_file.identity),
        pid_file: WireFileIdentity::from_native(r.pid_file.identity) }
}
fn same_claim(r: &Records, c: &Claim) -> bool {
    r.owner.nonce == c.nonce && r.owner.process == c.process &&
    c.reservation.matches(r.reservation.identity) && c.owner_file.matches(r.owner_file.identity) && c.pid_file.matches(r.pid_file.identity)
}
fn remove_records(guard: &RecordGuard<'_>, kind: &str, r: &Records) -> io::Result<()> {
    let (reservation, owner, pid) = names(kind);
    guard.remove(OsStr::new(pid), &r.pid_file)?;
    guard.remove(OsStr::new(owner), &r.owner_file)?;
    guard.remove(OsStr::new(reservation), &r.reservation)
}
struct PartialRecords {
    reservation: RecordSnapshot,
    owner_file: Option<RecordSnapshot>,
    pid_file: Option<RecordSnapshot>,
    owner: Owner,
    liveness: Liveness,
}

// Inspection never mutates. The reservation is the required authority anchor.
fn incomplete(guard: &RecordGuard<'_>, kind: &str) -> io::Result<Option<PartialRecords>> {
    let (reservation_name, owner_name, pid_name) = names(kind);
    let reservation = guard.read(OsStr::new(reservation_name))?;
    let owner_file = guard.read(OsStr::new(owner_name))?;
    let pid_file = guard.read(OsStr::new(pid_name))?;
    let count = [reservation.is_some(), owner_file.is_some(), pid_file.is_some()].into_iter().filter(|present| *present).count();
    if count == 0 || count == 3 { return Ok(None); }
    let reservation = reservation.ok_or_else(invalid)?;
    let owner: Owner = serde_json::from_slice(&reservation.bytes).map_err(|_| invalid())?;
    if owner.version != 1 || !uuid(&owner.nonce) { return Err(invalid()); }
    if owner_file.as_ref().is_some_and(|file| file.bytes != reservation.bytes)
        || pid_file.as_ref().is_some_and(|file| file.bytes != owner.process.pid.to_string().as_bytes()) {
        return Err(invalid());
    }
    let liveness = processes::liveness(&owner.process)?;
    if liveness == Liveness::Unknown { return Err(invalid()); }
    Ok(Some(PartialRecords { reservation, owner_file, pid_file, owner, liveness }))
}

fn remove_incomplete(guard: &RecordGuard<'_>, kind: &str, partial: &PartialRecords) -> io::Result<()> {
    let (reservation, owner, pid) = names(kind);
    if let Some(file) = &partial.pid_file { guard.remove(OsStr::new(pid), file)?; }
    if let Some(file) = &partial.owner_file { guard.remove(OsStr::new(owner), file)?; }
    guard.remove(OsStr::new(reservation), &partial.reservation)
}

fn target_name(target: &Target) -> io::Result<String> {
    match target {
        Target::Active => Ok("coordinator.json".into()),
        Target::Stopping { binding: b } => { binding(b)?; Ok(format!("coordinator.stopping.{}.{}.json", b.nonce, b.generation_id)) }
    }
}

fn stopping_names(path: &Path, guard: &RecordGuard<'_>) -> io::Result<Vec<String>> {
    let mut result = Vec::new();
    for entry in std::fs::read_dir(path.join("runtime"))? {
        let name = entry?.file_name().into_string().map_err(|_| invalid())?;
        if !name.starts_with("coordinator.stopping.") { continue; }
        let rest = name.strip_prefix("coordinator.stopping.").and_then(|s| s.strip_suffix(".json")).ok_or_else(invalid)?;
        let (nonce, generation) = rest.split_once('.').ok_or_else(invalid)?;
        if !uuid(nonce) || !uuid(generation) { return Err(invalid()); }
        if result.len() == 256 { return Err(invalid()); }
        let Some(record) = guard.read(OsStr::new(&name))? else { return Err(invalid()); };
        let d = crate::windows_coordinator_runtime::parse_descriptor(&record.bytes)?;
        descriptor(&d)?;
        let b = d.supervisor.as_ref().ok_or_else(invalid)?;
        if b.nonce != nonce || b.generation_id != generation { return Err(invalid()); }
        result.push(name);
    }
    result.sort();
    Ok(result)
}

fn is_authority_referenced(
    nonce: &str,
    active: Option<&Descriptor>,
    stopping_descriptors: &[Descriptor],
    claim_owner: Option<&Owner>,
) -> bool {
    if let Some(d) = active {
        if d.supervisor.as_ref().is_some_and(|b| b.nonce == nonce) {
            return true;
        }
    }
    for d in stopping_descriptors {
        if d.supervisor.as_ref().is_some_and(|b| b.nonce == nonce) {
            return true;
        }
    }
    if let Some(claim) = claim_owner {
        if claim.nonce == nonce {
            return true;
        }
    }
    false
}

fn clean_unreferenced_authorities(
    guard: &RecordGuard<'_>,
    active: Option<&Descriptor>,
    stopping_descriptors: &[Descriptor],
    claim_owner: Option<&Owner>,
) -> io::Result<()> {
    let auth_list = authorities::list_authorities(guard)?;
    for (name, snapshot, owner) in auth_list {
        if !is_authority_referenced(&owner.nonce, active, stopping_descriptors, claim_owner) {
            if processes::liveness(&owner.process)? == Liveness::Gone {
                guard.remove(OsStr::new(&name), &snapshot)?;
            }
        }
    }
    Ok(())
}

fn acquire(path: &Path, kind: &str) -> io::Result<Value> {
    stage("parent_identity");
    let parent = processes::own_parent_identity()?;
    if parent.user_sid != processes::current_identity()?.user_sid { return Err(invalid()); }
    let dir = directory(path, true)?;
    stage("publication_lock");
    let guard = RecordGuard::open(&dir)?;
    stage("claim_acquisition");
    if kind == "supervisor" {
        let active_snap = guard.read(OsStr::new("coordinator.json"))?;
        let active_desc = active_snap.as_ref().map(|r| crate::windows_coordinator_runtime::parse_descriptor(&r.bytes)).transpose()?;
        if let Some(d) = &active_desc { descriptor(d)?; }
        let stopping_names_list = stopping_names(path, &guard)?;
        let mut stopping_descriptors = Vec::new();
        for name in &stopping_names_list {
            let record = guard.read(OsStr::new(name))?.ok_or_else(invalid)?;
            let d = crate::windows_coordinator_runtime::parse_descriptor(&record.bytes)?;
            descriptor(&d)?;
            stopping_descriptors.push(d);
        }
        let auth_list = authorities::list_authorities(&guard)?;
        let (partial_claim, full_claim) = match incomplete(&guard, kind)? {
            Some(partial) => (Some(partial), None),
            None => (None, records(&guard, kind)?),
        };
        let claim_owner = full_claim.as_ref().map(|r| &r.owner).or_else(|| partial_claim.as_ref().map(|p| &p.owner));

        // 1. Verify descriptors have resolvable supervisor authority and dead processes BEFORE any deletion
        if let Some(d) = &active_desc {
            if state(&d.process)? != "gone" {
                return Ok(json!({"status":"blocked", "ownerPid":d.pid}));
            }
            if let Some(b) = &d.supervisor {
                let sup_proc = authorities::resolve_supervisor(Some(d), claim_owner, &auth_list)?
                    .ok_or_else(invalid)?;
                if state(sup_proc)? != "gone" {
                    return Ok(json!({"status":"blocked", "ownerPid":b.pid}));
                }
            }
        }
        for d in &stopping_descriptors {
            if state(&d.process)? != "gone" {
                return Ok(json!({"status":"blocked", "ownerPid":d.pid}));
            }
            if let Some(b) = &d.supervisor {
                let sup_proc = authorities::resolve_supervisor(Some(d), claim_owner, &auth_list)?
                    .ok_or_else(invalid)?;
                if state(sup_proc)? != "gone" {
                    return Ok(json!({"status":"blocked", "ownerPid":b.pid}));
                }
            }
        }

        // 2. Validate claim liveness and preserve authority if referenced BEFORE removing claim
        if let Some(partial) = &partial_claim {
            if partial.liveness == Liveness::Alive {
                return Ok(json!({"status":"blocked", "ownerPid":partial.owner.process.pid}));
            }
            if is_authority_referenced(&partial.owner.nonce, active_desc.as_ref(), &stopping_descriptors, None) {
                authorities::ensure_authority(&guard, &partial.owner)?;
            }
        }
        if let Some(existing) = &full_claim {
            match processes::liveness(&existing.owner.process)? {
                Liveness::Alive => return Ok(json!({"status":"blocked", "ownerPid":existing.owner.process.pid})),
                Liveness::Unknown => return Err(invalid()),
                Liveness::Gone => {
                    if is_authority_referenced(&existing.owner.nonce, active_desc.as_ref(), &stopping_descriptors, None) {
                        authorities::ensure_authority(&guard, &existing.owner)?;
                    }
                }
            }
        }

        // 3. Now that entire inventory is validated, perform deletions
        if let Some(partial) = &partial_claim {
            remove_incomplete(&guard, kind, partial)?;
        }
        if let Some(existing) = &full_claim {
            remove_records(&guard, kind, existing)?;
        }
        clean_unreferenced_authorities(&guard, active_desc.as_ref(), &stopping_descriptors, None)?;
    } else {
        if let Some(partial) = incomplete(&guard, kind)? {
            if partial.liveness == Liveness::Alive {
                return Ok(json!({"status":"blocked", "ownerPid":partial.owner.process.pid}));
            }
            remove_incomplete(&guard, kind, &partial)?;
        } else if let Some(existing) = records(&guard, kind)? {
            match processes::liveness(&existing.owner.process)? {
                Liveness::Alive => return Ok(json!({"status":"blocked", "ownerPid":existing.owner.process.pid})),
                Liveness::Unknown => return Err(invalid()),
                Liveness::Gone => remove_records(&guard, kind, &existing)?,
            }
        }
    }
    let owner = Owner { version: 1, nonce: uuid::Uuid::new_v4().to_string(), process: parent };
    let bytes = serde_json::to_vec(&owner).map_err(|_| invalid())?;
    let (r, o, p) = names(kind);
    let reservation = guard.create_if_absent(OsStr::new(r), &bytes)?;
    let owner_file = guard.create_if_absent(OsStr::new(o), &bytes)?;
    let pid_file = guard.create_if_absent(OsStr::new(p), owner.process.pid.to_string().as_bytes())?;
    let r = Records { reservation, owner_file, pid_file, owner };
    Ok(json!({"status":"owned", "claim":record_claim(&r)}))
}

fn claim_operation(path: &Path, kind: &str, claim: &Claim, release: bool) -> io::Result<Value> {
    valid_claim(claim)?;
    processes::verify_parent(&claim.process)?;
    let Some(dir) = read_directory(path)? else { return Ok(json!({"status":"absent"})); };
    let guard = RecordGuard::open(&dir)?;
    let Some(r) = records(&guard, kind)? else { return Ok(json!({"status":"absent"})); };
    if !same_claim(&r, claim) { return Ok(json!({"status":"changed"})); }
    if release {
        if kind == "supervisor" {
            let active = guard.read(OsStr::new("coordinator.json"))?;
            let active_desc = active.as_ref().map(|rec| crate::windows_coordinator_runtime::parse_descriptor(&rec.bytes)).transpose()?;
            let stopping_names_list = stopping_names(path, &guard)?;
            let mut stopping_descriptors = Vec::new();
            for name in &stopping_names_list {
                let record = guard.read(OsStr::new(name))?.ok_or_else(invalid)?;
                let d = crate::windows_coordinator_runtime::parse_descriptor(&record.bytes)?;
                descriptor(&d)?;
                stopping_descriptors.push(d);
            }
            let referenced = is_authority_referenced(&r.owner.nonce, active_desc.as_ref(), &stopping_descriptors, None);
            if referenced {
                authorities::ensure_authority(&guard, &r.owner)?;
            }
            remove_records(&guard, kind, &r)?;
            if !referenced {
                let auth_name = authorities::authority_name(&r.owner.nonce)?;
                if let Some(snap) = guard.read(OsStr::new(&auth_name))? {
                    guard.remove(OsStr::new(&auth_name), &snap)?;
                }
            }
        } else {
            remove_records(&guard, kind, &r)?;
        }
    }
    Ok(json!({"status": if release { "released" } else { "owned" }}))
}

fn read_descriptor(path: &Path, target: &Target) -> io::Result<Value> {
    let name = target_name(target)?;
    let Some(dir) = read_directory(path)? else { return Ok(Value::Null); };
    stage("publication_lock");
    let guard = RecordGuard::open(&dir)?;
    stage("descriptor_read");
    let Some(record) = guard.read(OsStr::new(&name))? else { return Ok(Value::Null); };
    let d = crate::windows_coordinator_runtime::parse_descriptor(&record.bytes)?;
    descriptor(&d)?;
    if let Target::Stopping { binding: b } = target {
        if d.supervisor.as_ref() != Some(b) { return Err(invalid()); }
    }
    Ok(json!({"descriptor":d, "identity":WireFileIdentity::from_native(record.identity)}))
}

fn recovery_snapshot(path: &Path, guard: &RecordGuard<'_>, target: &Target) -> io::Result<(RecoverySnapshot, Option<Descriptor>, Option<Owner>, Vec<(String, RecordSnapshot, Owner)>)> {
    let name = target_name(target)?;
    let active = guard.read(OsStr::new("coordinator.json"))?;
    let selected = if matches!(target, Target::Active) { active.clone() } else { guard.read(OsStr::new(&name))? };
    let mut parsed = None;
    for (record, is_selected) in [(active.as_ref(), matches!(target, Target::Active)), (selected.as_ref(), true)] {
        if let Some(record) = record {
            let d = crate::windows_coordinator_runtime::parse_descriptor(&record.bytes)?;
            descriptor(&d)?;
            if is_selected {
                if let Target::Stopping { binding: b } = target {
                    if d.supervisor.as_ref() != Some(b) { return Err(invalid()); }
                }
                parsed = Some(d);
            }
        }
    }
    let reservation = guard.read(OsStr::new("supervisor.reservation.json"))?;
    let owner_file = guard.read(OsStr::new("supervisor.owner.json"))?;
    let pid_file = guard.read(OsStr::new("supervisor.pid"))?;
    let owner = if reservation.is_none() && owner_file.is_none() && pid_file.is_none() {
        None
    } else if reservation.is_some() && owner_file.is_some() && pid_file.is_some() {
        Some(records(guard, "supervisor")?.ok_or_else(invalid)?.owner)
    } else {
        Some(incomplete(guard, "supervisor")?.ok_or_else(invalid)?.owner)
    };
    let wire = |r: &Option<RecordSnapshot>| r.as_ref().map(RecoveryRecord::from_native);
    let names = stopping_names(path, guard)?;
    let mut stopping = Vec::with_capacity(names.len());
    for name in &names {
        let record = guard.read(OsStr::new(name))?.ok_or_else(invalid)?;
        stopping.push(StoppingRecord { name: name.clone(), record: RecoveryRecord::from_native(&record) });
    }
    let auth_list = authorities::list_authorities(guard)?;
    let mut authorities_wire = Vec::with_capacity(auth_list.len());
    for (name, snap, _) in &auth_list {
        authorities_wire.push(AuthorityRecord { name: name.clone(), record: RecoveryRecord::from_native(snap) });
    }
    let snapshot = RecoverySnapshot {
        platform: "windows".into(),
        target: target.clone(),
        active: wire(&active),
        selected: wire(&selected),
        reservation: wire(&reservation),
        owner_file: wire(&owner_file),
        pid_file: wire(&pid_file),
        stopping_names: names,
        stopping,
        authorities: authorities_wire,
    };
    Ok((snapshot, parsed, owner, auth_list))
}

fn state(identity: &ProcessIdentity) -> io::Result<&'static str> {
    match processes::liveness(identity)? {
        Liveness::Alive => Ok("alive"),
        Liveness::Gone => Ok("gone"),
        Liveness::Unknown => Err(invalid()),
    }
}

fn recovery_inspect(path: &Path, target: &Target) -> io::Result<Value> {
    target_name(target)?;
    let Some(dir) = read_directory(path)? else {
        let snapshot = RecoverySnapshot {
            platform: "windows".into(),
            target: target.clone(),
            active: None,
            selected: None,
            reservation: None,
            owner_file: None,
            pid_file: None,
            stopping_names: Vec::new(),
            stopping: Vec::new(),
            authorities: Vec::new(),
        };
        return Ok(json!({
            "status": "absent",
            "snapshot": snapshot,
            "stoppingNames": [],
            "stoppingBindings": [],
            "descriptor": null,
            "childState": "absent",
            "supervisorState": "absent",
            "supervisorProcess": null,
            "claimState": "absent",
            "claimProcess": null,
        }));
    };
    let guard = RecordGuard::open(&dir)?;
    let (snapshot, selected, owner, auth_list) = recovery_snapshot(path, &guard, target)?;
    let resolved_supervisor = authorities::resolve_supervisor(selected.as_ref(), owner.as_ref(), &auth_list)?;
    let supervisor_state = match resolved_supervisor {
        Some(proc) => state(proc)?,
        None => "absent",
    };
    let supervisor_process = resolved_supervisor;
    let (claim_process, claim_state) = match &owner {
        Some(o) => (Some(&o.process), state(&o.process)?),
        None => (None, "absent"),
    };
    let child_state = match &selected {
        Some(d) => state(&d.process)?,
        None => "absent",
    };
    let mut stopping_bindings = Vec::new();
    for item in &snapshot.stopping {
        let d = crate::windows_coordinator_runtime::parse_descriptor(&STANDARD.decode(&item.record.bytes).map_err(|_| invalid())?)?;
        stopping_bindings.push(d.supervisor.ok_or_else(invalid)?);
    }
    Ok(json!({
        "status": if selected.is_some() { "present" } else { "absent" },
        "snapshot": snapshot,
        "descriptor": selected,
        "childState": child_state,
        "supervisorState": supervisor_state,
        "supervisorProcess": supervisor_process,
        "claimState": claim_state,
        "claimProcess": claim_process,
        "stoppingNames": snapshot.stopping_names,
        "stoppingBindings": stopping_bindings,
    }))
}

fn recovery_reclaim(path: &Path, expected: &RecoverySnapshot) -> io::Result<Value> {
    let Some(dir) = read_directory(path)? else { return Ok(json!({"status":"absent"})); };
    // Byte 1 must be acquired before byte 0, never the other way around.
    let _lease = if matches!(expected.target, Target::Active) {
        match CoordinatorLease::acquire(&dir) {
            Ok(lease) => Some(lease),
            Err(error) if error.raw_os_error() == Some(33) => return Ok(json!({"status":"busy"})),
            Err(error) => return Err(error),
        }
    } else { None };
    let guard = RecordGuard::open(&dir)?;
    let (current, selected, owner, auth_list) = recovery_snapshot(path, &guard, &expected.target)?;
    if &current != expected { return Ok(json!({"status":"changed"})); }
    if selected.is_none() && owner.is_none() && current.authorities.is_empty() {
        return Ok(json!({"status":"absent"}));
    }
    if let Some(d) = &selected {
        if state(&d.process)? != "gone" { return Ok(json!({"status":"busy"})); }
        let resolved_sup = authorities::resolve_supervisor(Some(d), owner.as_ref(), &auth_list)?;
        if let Some(proc) = resolved_sup {
            if state(proc)? != "gone" { return Ok(json!({"status":"busy"})); }
        }
    }
    if let Some(owner) = &owner {
        if state(&owner.process)? != "gone" { return Ok(json!({"status":"busy"})); }
    }
    // Never remove an anchor that another publication could still reference.
    let selected_name = target_name(&expected.target)?;
    if current.stopping_names.iter().any(|name| name != &selected_name) ||
        (!matches!(expected.target, Target::Active) && current.active.is_some()) {
        return Ok(json!({"status":"busy"}));
    }
    if let Some(record) = guard.read(OsStr::new(&selected_name))? {
        guard.remove(OsStr::new(&selected_name), &record)?;
    }
    if let Some(partial) = incomplete(&guard, "supervisor")? {
        remove_incomplete(&guard, "supervisor", &partial)?;
    } else if let Some(full) = records(&guard, "supervisor")? {
        remove_records(&guard, "supervisor", &full)?;
    }
    let active_now = guard.read(OsStr::new("coordinator.json"))?;
    let active_desc = active_now.as_ref().map(|rec| crate::windows_coordinator_runtime::parse_descriptor(&rec.bytes)).transpose()?;
    let stopping_names_now = stopping_names(path, &guard)?;
    let mut stopping_descriptors_now = Vec::new();
    for name in &stopping_names_now {
        let record = guard.read(OsStr::new(name))?.ok_or_else(invalid)?;
        let d = crate::windows_coordinator_runtime::parse_descriptor(&record.bytes)?;
        descriptor(&d)?;
        stopping_descriptors_now.push(d);
    }
    clean_unreferenced_authorities(&guard, active_desc.as_ref(), &stopping_descriptors_now, None)?;
    Ok(json!({"status":"removed"}))
}

fn remove_intent(path: &Path, b: &SupervisorBinding, child_pid: u32, expected: &Descriptor) -> io::Result<Value> {
    binding(b)?; descriptor(expected)?;
    if child_pid == 0 || expected.pid != child_pid || expected.supervisor.as_ref() != Some(b) { return Err(invalid()); }
    let parent = processes::own_parent_identity()?;
    if parent.user_sid != processes::current_identity()?.user_sid { return Err(invalid()); }
    if parent.pid != b.pid { return Err(invalid()); }
    let name = target_name(&Target::Stopping { binding: b.clone() })?;
    let Some(dir) = read_directory(path)? else { return Ok(json!({"status":"absent"})); };
    let guard = RecordGuard::open(&dir)?;
    let Some(owner) = records(&guard, "supervisor")? else { return Err(invalid()); };
    if owner.owner.nonce != b.nonce || owner.owner.process != parent { return Err(invalid()); }
    let Some(record) = guard.read(OsStr::new(&name))? else { return Ok(json!({"status":"absent"})); };
    let actual = crate::windows_coordinator_runtime::parse_descriptor(&record.bytes)?;
    descriptor(&actual)?;
    if &actual != expected { return Ok(json!({"status":"changed"})); }
    guard.remove(OsStr::new(&name), &record)?;
    Ok(json!({"status":"removed"}))
}
fn valid_launcher_name(name: &str) -> bool {
    name.strip_prefix("launcher-").and_then(|s| s.strip_suffix(".html"))
        .is_some_and(|s| !s.is_empty() && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-'))
}
fn launcher(path: &Path, origin: &str, launch_token: &str) -> io::Result<Value> {
    let port = origin.strip_prefix("http://127.0.0.1:").ok_or_else(invalid)?;
    if port.is_empty() || port.starts_with('0') || !port.bytes().all(|b| b.is_ascii_digit()) ||
        port.parse::<u16>().ok().filter(|p| *p > 0).is_none() || !token(launch_token) { return Err(invalid()); }
    let dir = directory(path, true)?;
    let guard = RecordGuard::open(&dir)?;
    let name = format!("launcher-{}.html", uuid::Uuid::new_v4());
    let url = format!("{origin}/#launchToken={launch_token}");
    let encoded = serde_json::to_string(&url).map_err(|_| invalid())?;
    let html = format!("<!doctype html><meta charset=\"utf-8\"><meta name=\"referrer\" content=\"no-referrer\"><script>location.replace({encoded})</script>");
    let record = guard.create_if_absent(OsStr::new(&name), html.as_bytes())?;
    Ok(json!({"name":name, "path":path.join("runtime").join(&name), "identity":WireFileIdentity::from_native(record.identity)}))
}
fn remove_launcher(path: &Path, name: &str, identity: &WireFileIdentity) -> io::Result<Value> {
    if !valid_launcher_name(name) { return Err(invalid()); }
    identity.validate()?;
    let Some(dir) = read_directory(path)? else { return Ok(json!({"status":"absent"})); };
    let guard = RecordGuard::open(&dir)?;
    let Some(record) = guard.read(OsStr::new(name))? else { return Ok(json!({"status":"absent"})); };
    if !identity.matches(record.identity) { return Ok(json!({"status":"changed"})); }
    guard.remove(OsStr::new(name), &record)?;
    Ok(json!({"status":"removed"}))
}
fn run_async<F: Future>(f: F) -> F::Output {
    if let Ok(handle) = tokio::runtime::Handle::try_current() {
        tokio::task::block_in_place(|| handle.block_on(f))
    } else {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("Failed to build tokio runtime")
            .block_on(f)
    }
}


fn dispatch(r: Request) -> io::Result<Value> {
    if r.version != 1 || !r.data_dir.is_absolute() { return Err(invalid()); }
    // Operation-irrelevant non-null fields are rejected here; run also rejects
    // explicit nulls and extraneous keys before dispatch.
    let fields = [r.target.is_some(), r.claim.is_some(), r.binding.is_some(), r.child_pid.is_some(),
        r.descriptor.is_some(), r.origin.is_some(), r.token.is_some(), r.name.is_some(), r.identity.is_some(), r.process.is_some(), r.snapshot.is_some()];
    let count = fields.iter().filter(|&&v| v).count();
    match r.op.as_str() {
        "legacy.inspect" => return crate::legacy_ops::inspect(&r.data_dir.to_string_lossy(), r.port.ok_or_else(invalid)?),
        "legacy.stop" => {
            let Some(AnyIdentity::Legacy(id)) = &r.identity else { return Err(invalid()); };
            return run_async(crate::legacy_ops::stop(&r.data_dir.to_string_lossy(), r.port.ok_or_else(invalid)?, id.clone(), r.escalate.unwrap_or(true)));
        }
        "legacy.retire" => return crate::legacy_ops::retire(&r.data_dir.to_string_lossy(), r.port.ok_or_else(invalid)?),
        _ => {}
    }
    match r.op.as_str() {
        "runtime.prepare" if count == 0 => {
            directory(&r.data_dir, true)?;
            Ok(json!({"status":"prepared"}))
        }
        "descriptor.read" if count == 1 && r.target.is_some() => {
            stage("descriptor_read");
            read_descriptor(&r.data_dir, r.target.as_ref().unwrap())
        },
        "recovery.inspect" if count == 1 && r.target.is_some() => recovery_inspect(&r.data_dir, r.target.as_ref().unwrap()),
        "recovery.reclaim" if count == 1 && r.snapshot.is_some() => recovery_reclaim(&r.data_dir, r.snapshot.as_ref().unwrap()),
        "supervisor.acquire" if count == 0 => acquire(&r.data_dir, "supervisor"),
        "spawn.acquire" if count == 0 => acquire(&r.data_dir, "spawn"),
        "supervisor.read" if count == 0 => {
            let Some(dir) = read_directory(&r.data_dir)? else { return Ok(json!({"status":"absent"})); };
            stage("publication_lock");
            let guard = RecordGuard::open(&dir)?;
            stage("claim_inspection");
            if let Some(partial) = incomplete(&guard, "supervisor")? {
                return if partial.liveness == Liveness::Gone {
                    Ok(json!({"status":"recoverable"}))
                } else { Err(invalid()) };
            }
            match records(&guard, "supervisor")? {
                None => Ok(json!({"status":"absent"})),
                Some(r) => Ok(json!({"status":"present", "pid":r.owner.process.pid, "nonce":r.owner.nonce, "process":r.owner.process})),
            }
        }
        "supervisor.check" if count == 1 && r.claim.is_some() => claim_operation(&r.data_dir, "supervisor", r.claim.as_ref().unwrap(), false),
        "supervisor.release" if count == 1 && r.claim.is_some() => claim_operation(&r.data_dir, "supervisor", r.claim.as_ref().unwrap(), true),
        "spawn.release" if count == 1 && r.claim.is_some() => claim_operation(&r.data_dir, "spawn", r.claim.as_ref().unwrap(), true),
        "intent.remove" if count == 3 && r.binding.is_some() && r.child_pid.is_some() && r.descriptor.is_some() =>
            remove_intent(&r.data_dir, r.binding.as_ref().unwrap(), r.child_pid.unwrap(), r.descriptor.as_ref().unwrap()),
        "launcher.create" if count == 2 && r.origin.is_some() && r.token.is_some() => launcher(&r.data_dir, r.origin.as_deref().unwrap(), r.token.as_deref().unwrap()),
        "launcher.remove" if count == 2 && r.name.is_some() && r.identity.is_some() => {
            let Some(AnyIdentity::Wire(id)) = &r.identity else { return Err(invalid()); };
            remove_launcher(&r.data_dir, r.name.as_deref().unwrap(), id)
        }

        "process.state" if count == 1 && r.process.is_some() => {
            stage("process_state");
            let state = match processes::liveness(r.process.as_ref().unwrap())? { Liveness::Alive => "alive", Liveness::Gone => "gone", Liveness::Unknown => "unknown" };
            Ok(json!({"status":state}))
        }
        _ => Err(invalid()),
    }
}

fn run_request() -> io::Result<()> {
    let mut input = Vec::new();
    io::stdin().lock().take((MAX_MESSAGE + 1) as u64).read_to_end(&mut input)?;
    stage("input_validation");
    if input.len() > MAX_MESSAGE { return Err(invalid()); }
    let raw: Value = serde_json::from_slice(&input).map_err(|_| invalid())?;
    let object = raw.as_object().ok_or_else(invalid)?;
    let op = object.get("op").and_then(Value::as_str).ok_or_else(invalid)?;
    let extras: &[&str] = match op {
        "descriptor.read" => &["target"],
        "recovery.inspect" => &["target"],
        "recovery.reclaim" => &["snapshot"],
        "runtime.prepare" | "supervisor.acquire" | "supervisor.read" | "spawn.acquire" => &[],
        "supervisor.check" | "supervisor.release" | "spawn.release" => &["claim"],
        "intent.remove" => &["binding", "childPid", "descriptor"],
        "launcher.create" => &["origin", "token"],
        "launcher.remove" => &["name", "identity"],
        "process.state" => &["process"],
        "legacy.inspect" | "legacy.retire" => &["port"],
        "legacy.stop" => &["port", "identity", "escalate"],
        _ => return Err(invalid()),
    };
    if object.len() != extras.len() + 3 || !["version", "dataDir", "op"].iter().chain(extras)
        .all(|key| object.get(*key).is_some_and(|value| !value.is_null())) {
        return Err(invalid());
    }
    let request: Request = serde_json::from_slice(&input).map_err(|_| invalid())?;
    let result = dispatch(request)?;
    let response = serde_json::to_vec(&json!({"version":1, "ok":true, "result":result})).map_err(|_| invalid())?;
    if response.len() > MAX_MESSAGE { return Err(invalid()); }
    stage("response_write");
    io::stdout().lock().write_all(&response)
}

pub(crate) fn run() -> io::Result<()> {
    stage("input_read");
    if let Err(error) = run_request() {
        let envelope = failure(&error);
        if let Ok(bytes) = serde_json::to_vec(&envelope) {
            let _ = io::stdout().lock().write_all(&bytes);
        }
        return Err(io::Error::new(io::ErrorKind::Other, "local-runtime request failed"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {

    #[test]
    fn diagnostic_never_serializes_error_messages() {
        stage("claim_inspection");
        let rendered = failure(&io::Error::new(io::ErrorKind::PermissionDenied, "secret-sentinel")).to_string();
        assert!(!rendered.contains("secret-sentinel"));
        assert!(rendered.contains("claim_inspection"));
        assert!(rendered.contains("permission_denied"));
    }

    #[test]
    fn all_anchored_dead_partial_shapes_are_read_only_until_removed() {
        for shape in 0..3 {
            let temp = tempfile::tempdir().unwrap();
            let dir = directory(&temp.path().join("data"), true).unwrap();
            let guard = RecordGuard::open(&dir).unwrap();
            let mut process = processes::current_identity().unwrap();
            process.creation_time = (process.creation_time.parse::<u64>().unwrap() + 1).to_string();
            let owner = Owner { version: 1, nonce: uuid::Uuid::new_v4().to_string(), process };
            let bytes = serde_json::to_vec(&owner).unwrap();
            let (r, o, p) = names("supervisor");
            guard.create_if_absent(OsStr::new(r), &bytes).unwrap();
            if shape == 1 { guard.create_if_absent(OsStr::new(o), &bytes).unwrap(); }
            if shape == 2 { guard.create_if_absent(OsStr::new(p), owner.process.pid.to_string().as_bytes()).unwrap(); }
            let partial = incomplete(&guard, "supervisor").unwrap().unwrap();
            assert_eq!(partial.liveness, Liveness::Gone);
            assert!(guard.read(OsStr::new(r)).unwrap().is_some());
            remove_incomplete(&guard, "supervisor", &partial).unwrap();
            assert!(guard.read(OsStr::new(r)).unwrap().is_none());
        }
    }

    #[test]
    fn unanchored_malformed_and_conflicting_partials_are_preserved() {
        for shape in 0..3 {
            let temp = tempfile::tempdir().unwrap();
            let dir = directory(&temp.path().join("data"), true).unwrap();
            let guard = RecordGuard::open(&dir).unwrap();
            let owner = Owner { version: 1, nonce: uuid::Uuid::new_v4().to_string(), process: processes::current_identity().unwrap() };
            let bytes = serde_json::to_vec(&owner).unwrap();
            let (r, o, _) = names("supervisor");
            match shape {
                0 => { guard.create_if_absent(OsStr::new(o), &bytes).unwrap(); }
                1 => { guard.create_if_absent(OsStr::new(r), b"{").unwrap(); }
                _ => {
                    guard.create_if_absent(OsStr::new(r), &bytes).unwrap();
                    guard.create_if_absent(OsStr::new(o), b"conflict").unwrap();
                }
            }
            let before_r = guard.read(OsStr::new(r)).unwrap();
            let before_o = guard.read(OsStr::new(o)).unwrap();
            assert!(incomplete(&guard, "supervisor").is_err());
            assert!(guard.read(OsStr::new(r)).unwrap() == before_r);
            assert!(guard.read(OsStr::new(o)).unwrap() == before_o);
        }
    }
    use super::*;

    #[test]
    fn validates_names_and_tokens_without_path_interpretation() {
        assert!(valid_launcher_name("launcher-0123-ab_CD.html"));
        for bad in ["launcher-.html", "../launcher-a.html", "launcher-a.html:stream",
            "launcher-a/b.html", "launcher-a.html."] {
            assert!(!valid_launcher_name(bad));
        }
        assert!(token(&"a".repeat(43)));
        assert!(!token(&"a".repeat(42)));
        assert!(!token(&format!("{}!", "a".repeat(42))));
        assert!(uuid("d7c48c04-7497-4cf4-86d6-ab674b40a1cf"));
        assert!(!uuid("D7C48C04-7497-4CF4-86D6-AB674B40A1CF"));
    }

    #[test]
    fn native_file_identity_round_trips_without_truncation() {
        let id = FileIdentity { volume_serial: 0x123456789abcdef0, file_id: [0xf1; 16] };
        let wire = WireFileIdentity::from_native(id);
        assert_eq!(wire.volume_serial, "123456789abcdef0");
        assert_eq!(wire.file_id, "f1".repeat(16));
        assert!(wire.validate().is_ok());
        assert!(wire.matches(id));
        assert!(!WireFileIdentity { volume_serial: "0".into(), file_id: wire.file_id }.matches(id));
    }
    #[test]
    fn incomplete_claim_requires_an_exact_dead_owner_before_recovery() {
        let temp = tempfile::tempdir().unwrap();
        let data = temp.path().join("private-data");
        let dir = directory(&data, true).unwrap();
        let guard = RecordGuard::open(&dir).unwrap();
        let mut identity = processes::current_identity().unwrap();
        let owner = Owner { version: 1, nonce: uuid::Uuid::new_v4().to_string(), process: identity.clone() };
        let bytes = serde_json::to_vec(&owner).unwrap();
        let name = OsStr::new(names("supervisor").0);
        let live = guard.create_if_absent(name, &bytes).unwrap();
        let partial = incomplete(&guard, "supervisor").unwrap().unwrap();
        assert_eq!(partial.liveness, Liveness::Alive);
        assert!(guard.read(name).unwrap().is_some());
        guard.remove(name, &live).unwrap();
        let creation: u64 = identity.creation_time.parse().unwrap();
        identity.creation_time = creation.saturating_add(1).to_string();
        let stale = Owner { process: identity, ..owner };
        guard.create_if_absent(name, &serde_json::to_vec(&stale).unwrap()).unwrap();
        let partial = incomplete(&guard, "supervisor").unwrap().unwrap();
        assert_eq!(partial.liveness, Liveness::Gone);
        assert!(guard.read(name).unwrap().is_some());
        remove_incomplete(&guard, "supervisor", &partial).unwrap();
        assert!(guard.read(name).unwrap().is_none());
    }
    #[test]
    fn recovery_rejects_replaced_anchor_and_resumes_partial_cleanup() {
        let temp = tempfile::tempdir().unwrap();
        let data = temp.path().join("private-data");
        let dir = directory(&data, true).unwrap();
        let mut process = processes::current_identity().unwrap();
        process.creation_time = (process.creation_time.parse::<u64>().unwrap() + 1).to_string();
        let owner = Owner { version: 1, nonce: uuid::Uuid::new_v4().to_string(), process };
        let bytes = serde_json::to_vec(&owner).unwrap();
        let guard = RecordGuard::open(&dir).unwrap();
        let old = guard.create_if_absent(OsStr::new("supervisor.reservation.json"), &bytes).unwrap();
        let expected = recovery_snapshot(&data, &guard, &Target::Active).unwrap().0;
        guard.remove(OsStr::new("supervisor.reservation.json"), &old).unwrap();
        let replacement = guard.create_if_absent(OsStr::new("supervisor.reservation.json"), &bytes).unwrap();
        drop(guard);
        assert_eq!(recovery_reclaim(&data, &expected).unwrap()["status"], "changed");
        let guard = RecordGuard::open(&dir).unwrap();
        assert_eq!(guard.read(OsStr::new("supervisor.reservation.json")).unwrap(), Some(replacement));
        let resumed = recovery_snapshot(&data, &guard, &Target::Active).unwrap().0;
        drop(guard);
        assert_eq!(recovery_reclaim(&data, &resumed).unwrap()["status"], "removed");
        let guard = RecordGuard::open(&dir).unwrap();
        assert!(guard.read(OsStr::new("supervisor.reservation.json")).unwrap().is_none());
    }

    #[test]
    fn recovery_rejects_unanchored_or_malformed_claims() {
        let temp = tempfile::tempdir().unwrap();
        let data = temp.path().join("private-data");
        let dir = directory(&data, true).unwrap();
        let guard = RecordGuard::open(&dir).unwrap();
        guard.create_if_absent(OsStr::new("supervisor.owner.json"), b"{}").unwrap();
        assert!(recovery_snapshot(&data, &guard, &Target::Active).is_err());
        assert!(guard.read(OsStr::new("supervisor.owner.json")).unwrap().is_some());
    }
    #[test]
    fn invalid_process_identity_never_authorizes_recovery() {
        let mut identity = processes::current_identity().unwrap();
        identity.creation_time = "0".into();
        assert!(state(&identity).is_err());
    }
    fn test_descriptor(pid: u32, supervisor: Option<SupervisorBinding>) -> Descriptor {
        let mut identity = processes::current_identity().unwrap();
        let creation: u64 = identity.creation_time.parse().unwrap();
        identity.creation_time = creation.saturating_add(1).to_string();
        identity.pid = pid;
        Descriptor {
            transport_version: 1,
            instance_id: uuid::Uuid::new_v4().to_string(),
            pid,
            process: identity,
            https_port: 1234,
            grpc_port: None,
            certificate_pem: "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----".into(),
            bearer_token: "0123456789abcdef0123456789abcdef0123456789a".into(),
            supervisor,
        }
    }

    #[test]
    fn windows_recovery_interrupted_before_replacement_reservation() {
        let temp = tempfile::tempdir().unwrap();
        let data = temp.path().join("data");
        let dir = directory(&data, true).unwrap();
        let guard = RecordGuard::open(&dir).unwrap();
        let mut sup_process = processes::current_identity().unwrap();
        let sup_creation: u64 = sup_process.creation_time.parse().unwrap();
        sup_process.creation_time = sup_creation.saturating_add(1).to_string();
        let sup_nonce = uuid::Uuid::new_v4().to_string();
        let sup_owner = Owner { version: 1, nonce: sup_nonce.clone(), process: sup_process.clone() };
        authorities::ensure_authority(&guard, &sup_owner).unwrap();
        let binding = SupervisorBinding { pid: sup_process.pid, nonce: sup_nonce, generation_id: uuid::Uuid::new_v4().to_string() };
        let d = test_descriptor(12345, Some(binding));
        guard.create_if_absent(OsStr::new("coordinator.json"), &serde_json::to_vec(&d).unwrap()).unwrap();
        drop(guard);
        let inspection = recovery_inspect(&data, &Target::Active).unwrap();
        assert_eq!(inspection["status"], "present");
        assert_eq!(inspection["supervisorState"], "gone");
        assert_eq!(inspection["supervisorProcess"]["creationTime"], sup_process.creation_time);
        assert_eq!(inspection["claimState"], "absent");
        assert!(inspection["claimProcess"].is_null());
        let snapshot: RecoverySnapshot = serde_json::from_value(inspection["snapshot"].clone()).unwrap();
        let reclaim_res = recovery_reclaim(&data, &snapshot).unwrap();
        assert_eq!(reclaim_res["status"], "removed");
        let guard = RecordGuard::open(&dir).unwrap();
        assert!(guard.read(OsStr::new("coordinator.json")).unwrap().is_none());
        assert!(authorities::list_authorities(&guard).unwrap().is_empty());
    }

    #[test]
    fn windows_recovery_interrupted_after_replacement_reservation() {
        let temp = tempfile::tempdir().unwrap();
        let data = temp.path().join("data");
        let dir = directory(&data, true).unwrap();
        let guard = RecordGuard::open(&dir).unwrap();
        let mut sup_process = processes::current_identity().unwrap();
        let sup_creation: u64 = sup_process.creation_time.parse().unwrap();
        sup_process.creation_time = sup_creation.saturating_add(1).to_string();
        let sup_nonce = uuid::Uuid::new_v4().to_string();
        let sup_owner = Owner { version: 1, nonce: sup_nonce.clone(), process: sup_process.clone() };
        authorities::ensure_authority(&guard, &sup_owner).unwrap();
        let binding = SupervisorBinding { pid: sup_process.pid, nonce: sup_nonce, generation_id: uuid::Uuid::new_v4().to_string() };
        let d = test_descriptor(12345, Some(binding));
        guard.create_if_absent(OsStr::new("coordinator.json"), &serde_json::to_vec(&d).unwrap()).unwrap();
        let mut repl_process = processes::current_identity().unwrap();
        let repl_creation: u64 = repl_process.creation_time.parse().unwrap();
        repl_process.creation_time = repl_creation.saturating_add(2).to_string();
        let repl_nonce = uuid::Uuid::new_v4().to_string();
        let repl_owner = Owner { version: 1, nonce: repl_nonce, process: repl_process.clone() };
        let repl_bytes = serde_json::to_vec(&repl_owner).unwrap();
        guard.create_if_absent(OsStr::new("supervisor.reservation.json"), &repl_bytes).unwrap();
        drop(guard);
        let inspection = recovery_inspect(&data, &Target::Active).unwrap();
        assert_eq!(inspection["status"], "present");
        assert_eq!(inspection["supervisorState"], "gone");
        assert_eq!(inspection["supervisorProcess"]["creationTime"], sup_process.creation_time);
        assert_eq!(inspection["claimState"], "gone");
        assert_eq!(inspection["claimProcess"]["creationTime"], repl_process.creation_time);
        let snapshot: RecoverySnapshot = serde_json::from_value(inspection["snapshot"].clone()).unwrap();
        let reclaim_res = recovery_reclaim(&data, &snapshot).unwrap();
        assert_eq!(reclaim_res["status"], "removed");
        let guard = RecordGuard::open(&dir).unwrap();
        assert!(guard.read(OsStr::new("coordinator.json")).unwrap().is_none());
        assert!(guard.read(OsStr::new("supervisor.reservation.json")).unwrap().is_none());
        assert!(authorities::list_authorities(&guard).unwrap().is_empty());
    }

    #[test]
    fn windows_stale_reclaim_preserves_successor_reservation() {
        let temp = tempfile::tempdir().unwrap();
        let data = temp.path().join("data");
        let dir = directory(&data, true).unwrap();
        let guard = RecordGuard::open(&dir).unwrap();
        let mut sup_process = processes::current_identity().unwrap();
        let sup_creation: u64 = sup_process.creation_time.parse().unwrap();
        sup_process.creation_time = sup_creation.saturating_add(1).to_string();
        let sup_nonce = uuid::Uuid::new_v4().to_string();
        let sup_owner = Owner { version: 1, nonce: sup_nonce.clone(), process: sup_process.clone() };
        authorities::ensure_authority(&guard, &sup_owner).unwrap();
        let binding = SupervisorBinding { pid: sup_process.pid, nonce: sup_nonce, generation_id: uuid::Uuid::new_v4().to_string() };
        let d = test_descriptor(12345, Some(binding));
        guard.create_if_absent(OsStr::new("coordinator.json"), &serde_json::to_vec(&d).unwrap()).unwrap();
        drop(guard);
        let inspection = recovery_inspect(&data, &Target::Active).unwrap();
        let stale_snapshot: RecoverySnapshot = serde_json::from_value(inspection["snapshot"].clone()).unwrap();
        let guard = RecordGuard::open(&dir).unwrap();
        let mut repl_process = processes::current_identity().unwrap();
        let repl_creation: u64 = repl_process.creation_time.parse().unwrap();
        repl_process.creation_time = repl_creation.saturating_add(2).to_string();
        let repl_nonce = uuid::Uuid::new_v4().to_string();
        let repl_owner = Owner { version: 1, nonce: repl_nonce, process: repl_process };
        let repl_bytes = serde_json::to_vec(&repl_owner).unwrap();
        let repl_snap = guard.create_if_absent(OsStr::new("supervisor.reservation.json"), &repl_bytes).unwrap();
        drop(guard);
        assert_eq!(recovery_reclaim(&data, &stale_snapshot).unwrap()["status"], "changed");
        let guard = RecordGuard::open(&dir).unwrap();
        assert_eq!(guard.read(OsStr::new("supervisor.reservation.json")).unwrap(), Some(repl_snap));
    }

    #[test]
    fn windows_acquisition_cleans_unreferenced_dead_authorities() {
        let temp = tempfile::tempdir().unwrap();
        let data = temp.path().join("data");
        let dir = directory(&data, true).unwrap();
        let guard = RecordGuard::open(&dir).unwrap();
        let mut dead_process = processes::current_identity().unwrap();
        let creation: u64 = dead_process.creation_time.parse().unwrap();
        dead_process.creation_time = creation.saturating_add(1).to_string();
        let dead_nonce = uuid::Uuid::new_v4().to_string();
        let dead_owner = Owner { version: 1, nonce: dead_nonce, process: dead_process };
        authorities::ensure_authority(&guard, &dead_owner).unwrap();
        assert_eq!(authorities::list_authorities(&guard).unwrap().len(), 1);
        drop(guard);
        let result = acquire(&data, "supervisor").unwrap();
        assert_eq!(result["status"], "owned");
        let guard = RecordGuard::open(&dir).unwrap();
        assert!(authorities::list_authorities(&guard).unwrap().is_empty());
    }

    #[test]
    fn windows_modeled_pid_reuse_never_signals_live_fixture() {
        let temp = tempfile::tempdir().unwrap();
        let data = temp.path().join("data");
        let dir = directory(&data, true).unwrap();
        let guard = RecordGuard::open(&dir).unwrap();
        let mut reused_process = processes::current_identity().unwrap();
        let creation: u64 = reused_process.creation_time.parse().unwrap();
        reused_process.creation_time = creation.saturating_add(10).to_string();
        let sup_nonce = uuid::Uuid::new_v4().to_string();
        let sup_owner = Owner { version: 1, nonce: sup_nonce.clone(), process: reused_process.clone() };
        authorities::ensure_authority(&guard, &sup_owner).unwrap();
        let binding = SupervisorBinding { pid: reused_process.pid, nonce: sup_nonce, generation_id: uuid::Uuid::new_v4().to_string() };
        let d = test_descriptor(12345, Some(binding));
        guard.create_if_absent(OsStr::new("coordinator.json"), &serde_json::to_vec(&d).unwrap()).unwrap();
        drop(guard);
        let inspection = recovery_inspect(&data, &Target::Active).unwrap();
        assert_eq!(inspection["status"], "present");
        assert_eq!(inspection["supervisorState"], "gone");
        let snapshot: RecoverySnapshot = serde_json::from_value(inspection["snapshot"].clone()).unwrap();
        assert_eq!(recovery_reclaim(&data, &snapshot).unwrap()["status"], "removed");
    }
    #[test]
    fn windows_acquisition_fails_closed_on_unresolved_predecessor_authority() {
        let temp = tempfile::tempdir().unwrap();
        let data = temp.path().join("data");
        let dir = directory(&data, true).unwrap();
        let guard = RecordGuard::open(&dir).unwrap();
        let binding = SupervisorBinding { pid: 9999, nonce: uuid::Uuid::new_v4().to_string(), generation_id: uuid::Uuid::new_v4().to_string() };
        let d = test_descriptor(12345, Some(binding));
        guard.create_if_absent(OsStr::new("coordinator.json"), &serde_json::to_vec(&d).unwrap()).unwrap();
        let mut repl_process = processes::current_identity().unwrap();
        let repl_creation: u64 = repl_process.creation_time.parse().unwrap();
        repl_process.creation_time = repl_creation.saturating_add(2).to_string();
        let repl_nonce = uuid::Uuid::new_v4().to_string();
        let repl_owner = Owner { version: 1, nonce: repl_nonce, process: repl_process };
        let repl_bytes = serde_json::to_vec(&repl_owner).unwrap();
        let repl_snap = guard.create_if_absent(OsStr::new("supervisor.reservation.json"), &repl_bytes).unwrap();
        drop(guard);
        assert!(acquire(&data, "supervisor").is_err());
        let guard = RecordGuard::open(&dir).unwrap();
        assert_eq!(guard.read(OsStr::new("supervisor.reservation.json")).unwrap(), Some(repl_snap));
        assert!(guard.read(OsStr::new("coordinator.json")).unwrap().is_some());
    }

    #[test]
    fn windows_acquisition_fails_closed_on_malformed_active_descriptor() {
        let temp = tempfile::tempdir().unwrap();
        let data = temp.path().join("data");
        let dir = directory(&data, true).unwrap();
        let guard = RecordGuard::open(&dir).unwrap();
        guard.create_if_absent(OsStr::new("coordinator.json"), b"{\"invalid\":true}").unwrap();
        let mut repl_process = processes::current_identity().unwrap();
        let repl_creation: u64 = repl_process.creation_time.parse().unwrap();
        repl_process.creation_time = repl_creation.saturating_add(2).to_string();
        let repl_nonce = uuid::Uuid::new_v4().to_string();
        let repl_owner = Owner { version: 1, nonce: repl_nonce, process: repl_process };
        let repl_bytes = serde_json::to_vec(&repl_owner).unwrap();
        let repl_snap = guard.create_if_absent(OsStr::new("supervisor.reservation.json"), &repl_bytes).unwrap();
        drop(guard);
        assert!(acquire(&data, "supervisor").is_err());
        let guard = RecordGuard::open(&dir).unwrap();
        assert_eq!(guard.read(OsStr::new("supervisor.reservation.json")).unwrap(), Some(repl_snap));
    }
    #[test]
    fn windows_acquisition_recovers_from_dead_anchored_partial_claim() {
        let temp = tempfile::tempdir().unwrap();
        let data = temp.path().join("data");
        let dir = directory(&data, true).unwrap();
        let guard = RecordGuard::open(&dir).unwrap();
        let mut dead_process = processes::current_identity().unwrap();
        let creation: u64 = dead_process.creation_time.parse().unwrap();
        dead_process.creation_time = creation.saturating_add(1).to_string();
        let dead_nonce = uuid::Uuid::new_v4().to_string();
        let dead_owner = Owner { version: 1, nonce: dead_nonce, process: dead_process };
        let dead_bytes = serde_json::to_vec(&dead_owner).unwrap();
        guard.create_if_absent(OsStr::new("supervisor.reservation.json"), &dead_bytes).unwrap();
        drop(guard);
        let result = acquire(&data, "supervisor").unwrap();
        assert_eq!(result["status"], "owned");
        let guard = RecordGuard::open(&dir).unwrap();
        let full = records(&guard, "supervisor").unwrap().unwrap();
        assert_ne!(full.owner.nonce, dead_owner.nonce);
    }

    #[test]
    fn windows_acquisition_blocks_on_live_anchored_partial_claim() {
        let temp = tempfile::tempdir().unwrap();
        let data = temp.path().join("data");
        let dir = directory(&data, true).unwrap();
        let guard = RecordGuard::open(&dir).unwrap();
        let live_process = processes::current_identity().unwrap();
        let live_nonce = uuid::Uuid::new_v4().to_string();
        let live_owner = Owner { version: 1, nonce: live_nonce, process: live_process.clone() };
        let live_bytes = serde_json::to_vec(&live_owner).unwrap();
        let snap = guard.create_if_absent(OsStr::new("supervisor.reservation.json"), &live_bytes).unwrap();
        drop(guard);
        let result = acquire(&data, "supervisor").unwrap();
        assert_eq!(result["status"], "blocked");
        assert_eq!(result["ownerPid"], live_process.pid);
        let guard = RecordGuard::open(&dir).unwrap();
        assert_eq!(guard.read(OsStr::new("supervisor.reservation.json")).unwrap(), Some(snap));
    }

    #[test]
    fn windows_acquisition_preserves_authority_from_dead_anchored_partial_claim() {
        let temp = tempfile::tempdir().unwrap();
        let data = temp.path().join("data");
        let dir = directory(&data, true).unwrap();
        let guard = RecordGuard::open(&dir).unwrap();
        let mut dead_process = processes::current_identity().unwrap();
        let creation: u64 = dead_process.creation_time.parse().unwrap();
        dead_process.creation_time = creation.saturating_add(1).to_string();
        let dead_nonce = uuid::Uuid::new_v4().to_string();
        let dead_owner = Owner { version: 1, nonce: dead_nonce.clone(), process: dead_process.clone() };
        let dead_bytes = serde_json::to_vec(&dead_owner).unwrap();
        guard.create_if_absent(OsStr::new("supervisor.reservation.json"), &dead_bytes).unwrap();
        let binding = SupervisorBinding { pid: dead_process.pid, nonce: dead_nonce.clone(), generation_id: uuid::Uuid::new_v4().to_string() };
        let d = test_descriptor(12345, Some(binding));
        guard.create_if_absent(OsStr::new("coordinator.json"), &serde_json::to_vec(&d).unwrap()).unwrap();
        drop(guard);
        let result = acquire(&data, "supervisor").unwrap();
        assert_eq!(result["status"], "owned");
        let guard = RecordGuard::open(&dir).unwrap();
        let auth_name = authorities::authority_name(&dead_nonce).unwrap();
        let auth_record = guard.read(OsStr::new(&auth_name)).unwrap().unwrap();
        let parsed = authorities::parse_owner(&auth_record.bytes).unwrap();
        assert_eq!(parsed, dead_owner);
    }
}
