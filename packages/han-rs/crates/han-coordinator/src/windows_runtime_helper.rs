//! Bounded, one-request Windows local-runtime helper. The pipe is the only
//! channel carrying descriptor credentials or launcher tokens.
#![cfg(windows)]

use std::{ffi::OsStr, io::{self, Read, Write}, path::{Path, PathBuf}};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use crate::runtime::{Descriptor, SupervisorBinding};
use crate::windows_process_identity::{self as processes, Liveness, ProcessIdentity};
use crate::windows_secure_fs::{FileIdentity, PinnedDirectory, RecordGuard, RecordSnapshot};

const MAX_MESSAGE: usize = 128 * 1024;

fn invalid() -> io::Error { io::Error::new(io::ErrorKind::InvalidData, "invalid local-runtime request or record") }

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
    identity: Option<WireFileIdentity>,
    process: Option<ProcessIdentity>,
}

#[derive(Deserialize)]
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
struct Claim {
    nonce: String,
    process: ProcessIdentity,
    reservation: WireFileIdentity,
    owner_file: WireFileIdentity,
    pid_file: WireFileIdentity,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Owner { version: u32, nonce: String, process: ProcessIdentity }

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
    PinnedDirectory::open_data_directory(path)?.open_private_child(OsStr::new("runtime"), create)
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
fn acquire(path: &Path, kind: &str) -> io::Result<Value> {
    let parent = processes::own_parent_identity()?;
    if parent.user_sid != processes::current_identity()?.user_sid { return Err(invalid()); }
    let dir = directory(path, true)?;
    let guard = RecordGuard::open(&dir)?;
    if let Some(existing) = records(&guard, kind)? {
        match processes::liveness(&existing.owner.process)? {
            Liveness::Alive => return Ok(json!({"status":"blocked", "ownerPid":existing.owner.process.pid})),
            Liveness::Unknown => return Err(invalid()),
            Liveness::Gone => remove_records(&guard, kind, &existing)?,
        }
    }
    let owner = Owner { version: 1, nonce: uuid::Uuid::new_v4().to_string(), process: parent };
    let bytes = serde_json::to_vec(&owner).map_err(|_| invalid())?;
    let (r, o, p) = names(kind);
    let reservation = guard.create_if_absent(OsStr::new(r), &bytes)?;
    let owner_file = match guard.create_if_absent(OsStr::new(o), &bytes) {
        Ok(file) => file,
        Err(e) => { guard.remove(OsStr::new(r), &reservation)?; return Err(e); }
    };
    let pid_file = match guard.create_if_absent(OsStr::new(p), owner.process.pid.to_string().as_bytes()) {
        Ok(file) => file,
        Err(e) => { guard.remove(OsStr::new(o), &owner_file)?; guard.remove(OsStr::new(r), &reservation)?; return Err(e); }
    };
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
    if release { remove_records(&guard, kind, &r)?; }
    Ok(json!({"status": if release { "released" } else { "owned" }}))
}
fn target_name(target: &Target) -> io::Result<String> {
    match target {
        Target::Active => Ok("coordinator.json".into()),
        Target::Stopping { binding: b } => { binding(b)?; Ok(format!("coordinator.stopping.{}.{}.json", b.nonce, b.generation_id)) }
    }
}
fn read_descriptor(path: &Path, target: &Target) -> io::Result<Value> {
    let name = target_name(target)?;
    let Some(dir) = read_directory(path)? else { return Ok(Value::Null); };
    let guard = RecordGuard::open(&dir)?;
    let Some(record) = guard.read(OsStr::new(&name))? else { return Ok(Value::Null); };
    let d: Descriptor = serde_json::from_slice(&record.bytes).map_err(|_| invalid())?;
    descriptor(&d)?;
    if let Target::Stopping { binding: b } = target {
        if d.supervisor.as_ref() != Some(b) { return Err(invalid()); }
    }
    Ok(json!({"descriptor":d, "identity":WireFileIdentity::from_native(record.identity)}))
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
    let actual: Descriptor = serde_json::from_slice(&record.bytes).map_err(|_| invalid())?;
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

fn dispatch(r: Request) -> io::Result<Value> {
    if r.version != 1 || !r.data_dir.is_absolute() { return Err(invalid()); }
    // Operation-irrelevant non-null fields are rejected here; run also rejects
    // explicit nulls and extraneous keys before dispatch.
    let fields = [r.target.is_some(), r.claim.is_some(), r.binding.is_some(), r.child_pid.is_some(),
        r.descriptor.is_some(), r.origin.is_some(), r.token.is_some(), r.name.is_some(), r.identity.is_some(), r.process.is_some()];
    let count = fields.iter().filter(|&&v| v).count();
    match r.op.as_str() {
        "descriptor.read" if count == 1 && r.target.is_some() => read_descriptor(&r.data_dir, r.target.as_ref().unwrap()),
        "supervisor.acquire" if count == 0 => acquire(&r.data_dir, "supervisor"),
        "spawn.acquire" if count == 0 => acquire(&r.data_dir, "spawn"),
        "supervisor.read" if count == 0 => {
            let Some(dir) = read_directory(&r.data_dir)? else { return Ok(Value::Null); };
            let guard = RecordGuard::open(&dir)?;
            match records(&guard, "supervisor")? {
                None => Ok(Value::Null),
                Some(r) => Ok(json!({"pid":r.owner.process.pid, "nonce":r.owner.nonce, "process":r.owner.process})),
            }
        }
        "supervisor.check" if count == 1 && r.claim.is_some() => claim_operation(&r.data_dir, "supervisor", r.claim.as_ref().unwrap(), false),
        "supervisor.release" if count == 1 && r.claim.is_some() => claim_operation(&r.data_dir, "supervisor", r.claim.as_ref().unwrap(), true),
        "spawn.release" if count == 1 && r.claim.is_some() => claim_operation(&r.data_dir, "spawn", r.claim.as_ref().unwrap(), true),
        "intent.remove" if count == 3 && r.binding.is_some() && r.child_pid.is_some() && r.descriptor.is_some() =>
            remove_intent(&r.data_dir, r.binding.as_ref().unwrap(), r.child_pid.unwrap(), r.descriptor.as_ref().unwrap()),
        "launcher.create" if count == 2 && r.origin.is_some() && r.token.is_some() => launcher(&r.data_dir, r.origin.as_deref().unwrap(), r.token.as_deref().unwrap()),
        "launcher.remove" if count == 2 && r.name.is_some() && r.identity.is_some() => remove_launcher(&r.data_dir, r.name.as_deref().unwrap(), r.identity.as_ref().unwrap()),
        "process.state" if count == 1 && r.process.is_some() => {
            let state = match processes::liveness(r.process.as_ref().unwrap())? { Liveness::Alive => "alive", Liveness::Gone => "gone", Liveness::Unknown => "unknown" };
            Ok(json!({"status":state}))
        }
        _ => Err(invalid()),
    }
}

pub(crate) fn run() -> io::Result<()> {
    let mut input = Vec::new();
    io::stdin().lock().take((MAX_MESSAGE + 1) as u64).read_to_end(&mut input)?;
    if input.len() > MAX_MESSAGE { return Err(invalid()); }
    let raw: Value = serde_json::from_slice(&input).map_err(|_| invalid())?;
    let object = raw.as_object().ok_or_else(invalid)?;
    let op = object.get("op").and_then(Value::as_str).ok_or_else(invalid)?;
    let extras: &[&str] = match op {
        "descriptor.read" => &["target"],
        "supervisor.acquire" | "supervisor.read" | "spawn.acquire" => &[],
        "supervisor.check" | "supervisor.release" | "spawn.release" => &["claim"],
        "intent.remove" => &["binding", "childPid", "descriptor"],
        "launcher.create" => &["origin", "token"],
        "launcher.remove" => &["name", "identity"],
        "process.state" => &["process"],
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
    io::stdout().lock().write_all(&response)
}

#[cfg(test)]
mod tests {
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
}
