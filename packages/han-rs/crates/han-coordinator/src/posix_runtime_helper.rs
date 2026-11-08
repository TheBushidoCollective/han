//! POSIX supervisor and recovery transactions, serialized with publication.
#![cfg(unix)]
use std::{ffi::{CString, OsStr}, fs, io::{self, Read, Write}, os::{fd::{AsRawFd, FromRawFd}, unix::{ffi::OsStrExt, fs::{MetadataExt, OpenOptionsExt, PermissionsExt}}}, path::{Path, PathBuf}};
use std::future::Future;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use crate::runtime::{Descriptor, PublicationGuard, SupervisorBinding};
const LIMIT: usize = 128 * 1024;
fn invalid() -> io::Error { io::Error::new(io::ErrorKind::InvalidData, "invalid local runtime request or record") }
fn uuid(s: &str) -> bool { uuid::Uuid::parse_str(s).is_ok_and(|u| u.hyphenated().to_string() == s) }
fn c(s: &OsStr) -> io::Result<CString> { CString::new(s.as_bytes()).map_err(|_| invalid()) }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Identity { device: String, inode: String }
fn identity(m: &fs::Metadata) -> Identity { Identity { device: m.dev().to_string(), inode: m.ino().to_string() } }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Record { identity: Identity, bytes: String }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag="kind", rename_all="lowercase", deny_unknown_fields)]
enum Target { Active, Stopping { binding: SupervisorBinding } }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag="kind", rename_all="kebab-case", rename_all_fields="camelCase", deny_unknown_fields)]
enum ClaimSnapshot { Absent, Vacated { reservation: Identity }, Anchored { reservation: Identity, owner_name: String, owner_file: Record, pid_file: Option<Record> }, DescriptorBoundPid { pid_file: Record } }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Stopping { name: String, record: Record }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
struct Snapshot { platform: String, data_directory: Identity, runtime_directory: Identity, publication_lock: Identity, target: Target, active: Option<Record>, stopping: Vec<Stopping>, claim: ClaimSnapshot }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
struct Claim { pid: u32, nonce: String, reservation: Identity, owner_file: Identity, pid_file: Identity }
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Owner { version: u32, pid: u32, nonce: String }
#[derive(Deserialize)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
struct Request { version: u32, data_dir: PathBuf, op: String, target: Option<Target>, snapshot: Option<Snapshot>, claim: Option<Claim>, binding: Option<SupervisorBinding>, descriptor: Option<Descriptor>, pid: Option<u32>, nonce: Option<String>, port: Option<u16>, identity: Option<crate::legacy_ops::LegacyIdentity>, escalate: Option<bool> }
fn open_at(dir: &fs::File, name: &OsStr, flags: i32, mode: u32) -> io::Result<fs::File> {
    let n = c(name)?; let fd = unsafe { libc::openat(dir.as_raw_fd(), n.as_ptr(), flags | libc::O_CLOEXEC | libc::O_NOFOLLOW, mode as libc::c_uint) };
    if fd < 0 { return Err(io::Error::last_os_error()); }
    Ok(unsafe { fs::File::from_raw_fd(fd) })
}
fn check_dir(file: &fs::File, private: bool) -> io::Result<()> {
    let m = file.metadata()?;
    if !m.is_dir() || m.uid() != unsafe { libc::geteuid() } || m.permissions().mode() & (if private {0o077} else {0o022}) != 0 { return Err(invalid()); }
    Ok(())
}
fn root(path: &Path) -> io::Result<fs::File> {
    let f = fs::OpenOptions::new().read(true).custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC).open(path)?;
    check_dir(&f, false)?; Ok(f)
}
fn read_at(dir: &fs::File, name: &OsStr, public: bool) -> io::Result<Option<Record>> {
    let file = match open_at(dir, name, libc::O_RDONLY, 0) { Ok(f) => f, Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(None), Err(e) => return Err(e) };
    let m = file.metadata()?;
    if !m.is_file() || m.uid() != unsafe { libc::geteuid() } || m.permissions().mode() & (if public {0o022} else {0o077}) != 0 { return Err(invalid()); }
    let mut data = Vec::new(); file.take(65537).read_to_end(&mut data)?; if data.len() > 65536 { return Err(invalid()); }
    Ok(Some(Record { identity: identity(&m), bytes: STANDARD.encode(data) }))
}
fn bytes(record: &Record) -> io::Result<Vec<u8>> { STANDARD.decode(&record.bytes).map_err(|_| invalid()) }
fn parse(record: &Record) -> io::Result<Descriptor> {
    let d: Descriptor = serde_json::from_slice(&bytes(record)?).map_err(|_| invalid())?;
    if d.transport_version != 1 || d.pid == 0 || d.pid > i32::MAX as u32 || d.instance_id.is_empty() || d.https_port == 0 || d.grpc_port == Some(0) || !d.certificate_pem.contains("-----BEGIN CERTIFICATE-----") || d.bearer_token.len() != 43 || !d.bearer_token.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-') { return Err(invalid()); }
    if let Some(b) = &d.supervisor { SupervisorBinding::validate(b.pid, b.nonce.clone(), b.generation_id.clone())?; }
    Ok(d)
}
fn name(target: &Target) -> io::Result<String> { match target { Target::Active => Ok("coordinator.json".into()), Target::Stopping { binding: b } => { SupervisorBinding::validate(b.pid, b.nonce.clone(), b.generation_id.clone())?; Ok(format!("coordinator.stopping.{}.{}.json", b.nonce, b.generation_id)) } } }
fn classify_probe(error: io::Error) -> io::Result<&'static str> {
    match error.raw_os_error() { Some(libc::ESRCH) => Ok("gone"), Some(libc::EPERM) => Ok("alive"), _ => Err(error) }
}
fn observed(pid: u32) -> io::Result<&'static str> {
    if pid == 0 || pid > i32::MAX as u32 { return Err(invalid()); }
    if unsafe { libc::kill(pid as i32, 0) } == 0 { return Ok("alive"); }
    classify_probe(io::Error::last_os_error())
}
fn pid(record: &Record) -> io::Result<u32> { let s = String::from_utf8(bytes(record)?).map_err(|_| invalid())?; let s = s.trim(); let p: u32 = s.parse().map_err(|_| invalid())?; if p == 0 || p > i32::MAX as u32 || p.to_string() != s { return Err(invalid()); } Ok(p) }
fn owner(record: &Record, name: &str) -> io::Result<Owner> { let o: Owner = serde_json::from_slice(&bytes(record)?).map_err(|_| invalid())?; if o.version != 1 || o.pid == 0 || o.pid > i32::MAX as u32 || !uuid(&o.nonce) || name != format!("owner.{}.json", o.nonce) { return Err(invalid()); } Ok(o) }
fn entries(dir: &fs::File, path: &Path, max: usize) -> io::Result<Vec<String>> {
    if identity(&root(path)?.metadata()?) != identity(&dir.metadata()?) { return Err(invalid()); }
    let mut v = Vec::new();
    for item in fs::read_dir(path)? {
        if v.len() == max { return Err(invalid()); }
        v.push(item?.file_name().into_string().map_err(|_| invalid())?);
    }
    if identity(&root(path)?.metadata()?) != identity(&dir.metadata()?) { return Err(invalid()); }
    v.sort(); Ok(v)
}
struct Roots { data: fs::File, runtime: fs::File, guard: PublicationGuard, path: PathBuf }
impl Roots {
    fn open(path: &Path) -> io::Result<Self> {
        let data = root(path)?; let runtime = open_at(&data, OsStr::new("runtime"), libc::O_RDONLY | libc::O_DIRECTORY, 0)?; check_dir(&runtime, true)?;
        let guard = PublicationGuard::acquire(&path.join("runtime"))?;
        let data_again = root(path)?; let runtime_again = open_at(&data_again, OsStr::new("runtime"), libc::O_RDONLY | libc::O_DIRECTORY, 0)?;
        if identity(&data.metadata()?) != identity(&data_again.metadata()?) || identity(&runtime.metadata()?) != identity(&runtime_again.metadata()?) { return Err(invalid()); }
        let lock = read_at(&runtime, OsStr::new("descriptor-publication.lock"), false)?.ok_or_else(invalid)?;
        if lock.identity != identity(&guard.metadata()?) { return Err(invalid()); }
        Ok(Self { data, runtime, guard, path: path.to_owned() })
    }
}
fn stopping(roots: &Roots) -> io::Result<Vec<Stopping>> {
    let mut result = Vec::new();
    for n in entries(&roots.runtime, &roots.path.join("runtime"), 4096)? {
        if !n.starts_with("coordinator.stopping.") { continue; }
        let rest = n.strip_prefix("coordinator.stopping.").and_then(|s| s.strip_suffix(".json")).ok_or_else(invalid)?;
        let (a,b) = rest.split_once('.').ok_or_else(invalid)?; if !uuid(a) || !uuid(b) || result.len() == 256 { return Err(invalid()); }
        let record = read_at(&roots.runtime, OsStr::new(&n), false)?.ok_or_else(invalid)?;
        let d = parse(&record)?; let binding = d.supervisor.ok_or_else(invalid)?;
        if binding.nonce != a || binding.generation_id != b { return Err(invalid()); }
        result.push(Stopping { name:n, record });
    }
    Ok(result)
}
fn selected<'a>(target: &Target, active: &'a Option<Record>, stops: &'a [Stopping]) -> io::Result<Option<&'a Record>> {
    let n = name(target)?; let r = match target { Target::Active => active.as_ref(), Target::Stopping { .. } => stops.iter().find(|s| s.name == n).map(|s| &s.record) };
    if let (Target::Stopping { binding }, Some(r)) = (target, r) { if parse(r)?.supervisor.as_ref() != Some(binding) { return Err(invalid()); } }
    Ok(r)
}
fn claim_snapshot(roots: &Roots, active: &Option<Record>, stops: &[Stopping]) -> io::Result<ClaimSnapshot> {
    let pid_file = read_at(&roots.data, OsStr::new("coordinator.pid"), true)?;
    let reservation = match open_at(&roots.data, OsStr::new("coordinator.pid.takeover"), libc::O_RDONLY | libc::O_DIRECTORY, 0) {
        Ok(f) => f,
        Err(e) if e.kind() == io::ErrorKind::NotFound => {
            let Some(pid_file) = pid_file else { return Ok(ClaimSnapshot::Absent) };
            let p = pid(&pid_file)?;
            let mut bound = active.as_ref().map(parse).transpose()?.and_then(|d| d.supervisor).is_some_and(|b| b.pid == p);
            for s in stops { bound |= parse(&s.record)?.supervisor.is_some_and(|b| b.pid == p); }
            if !bound { return Err(invalid()); }
            return Ok(ClaimSnapshot::DescriptorBoundPid { pid_file });
        }
        Err(e) => return Err(e),
    };
    check_dir(&reservation, true)?; let reservation_id = identity(&reservation.metadata()?);
    let names = entries(&reservation, &roots.path.join("coordinator.pid.takeover"), 2)?;
    if names.is_empty() { if pid_file.is_some() { return Err(invalid()); } return Ok(ClaimSnapshot::Vacated { reservation: reservation_id }); }
    if names.len() != 1 { return Err(invalid()); }
    let owner_file = read_at(&reservation, OsStr::new(&names[0]), false)?.ok_or_else(invalid)?;
    let owner = owner(&owner_file, &names[0])?; if let Some(file) = &pid_file { if pid(file)? != owner.pid { return Err(invalid()); } }
    Ok(ClaimSnapshot::Anchored { reservation: reservation_id, owner_name: names[0].clone(), owner_file, pid_file })
}
fn snapshot(roots: &Roots, target: &Target) -> io::Result<Snapshot> {
    let active = read_at(&roots.runtime, OsStr::new("coordinator.json"), false)?; if let Some(r) = &active { parse(r)?; }
    let stopping = stopping(roots)?; selected(target, &active, &stopping)?;
    let claim = claim_snapshot(roots, &active, &stopping)?;
    Ok(Snapshot { platform:"posix".into(), data_directory:identity(&roots.data.metadata()?), runtime_directory:identity(&roots.runtime.metadata()?), publication_lock:identity(&roots.guard.metadata()?), target:target.clone(), active, stopping, claim })
}
fn unlink(dir: &fs::File, name: &str, is_dir: bool) -> io::Result<()> { let n = CString::new(name).map_err(|_| invalid())?; if unsafe { libc::unlinkat(dir.as_raw_fd(), n.as_ptr(), if is_dir {libc::AT_REMOVEDIR} else {0}) } != 0 { return Err(io::Error::last_os_error()); } dir.sync_all() }
fn write_new(dir: &fs::File, name: &str, contents: &[u8]) -> io::Result<()> { let mut f = open_at(dir, OsStr::new(name), libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL, 0o600)?; f.write_all(contents)?; f.sync_all()?; dir.sync_all() }
fn rename(dir: &fs::File, from: &str, to: &str) -> io::Result<()> { let a = CString::new(from).map_err(|_| invalid())?; let b = CString::new(to).map_err(|_| invalid())?; if unsafe { libc::renameat(dir.as_raw_fd(), a.as_ptr(), dir.as_raw_fd(), b.as_ptr()) } != 0 { return Err(io::Error::last_os_error()); } dir.sync_all() }
fn mkdir(dir: &fs::File, name: &str) -> io::Result<()> { let n = CString::new(name).map_err(|_| invalid())?; if unsafe { libc::mkdirat(dir.as_raw_fd(), n.as_ptr(), 0o700) } != 0 { return Err(io::Error::last_os_error()); } dir.sync_all() }
fn remove_claim(roots: &Roots, claim: &ClaimSnapshot) -> io::Result<()> {
    match claim {
        ClaimSnapshot::Absent => Ok(()),
        ClaimSnapshot::DescriptorBoundPid { .. } => unlink(&roots.data, "coordinator.pid", false),
        ClaimSnapshot::Vacated { .. } => unlink(&roots.data, "coordinator.pid.takeover", true),
        ClaimSnapshot::Anchored { owner_name, pid_file, .. } => {
            let dir = open_at(&roots.data, OsStr::new("coordinator.pid.takeover"), libc::O_RDONLY | libc::O_DIRECTORY, 0)?;
            if pid_file.is_some() { unlink(&roots.data, "coordinator.pid", false)?; }
            unlink(&dir, owner_name, false)?; unlink(&roots.data, "coordinator.pid.takeover", true)
        }
    }
}
fn owner_for(claim: &ClaimSnapshot) -> io::Result<Option<Owner>> { match claim { ClaimSnapshot::Anchored {owner_name,owner_file,..} => Ok(Some(owner(owner_file,owner_name)?)), _ => Ok(None) } }
fn own_claim(snapshot: &ClaimSnapshot, claim: &Claim) -> io::Result<bool> {
    if claim.pid != unsafe { libc::getppid() } as u32 || !uuid(&claim.nonce) { return Err(invalid()); }
    match snapshot { ClaimSnapshot::Anchored {reservation,owner_name,owner_file,pid_file:Some(pid_file)} => { let o = owner(owner_file, owner_name)?; Ok(o.pid == claim.pid && o.nonce == claim.nonce && reservation == &claim.reservation && owner_file.identity == claim.owner_file && pid_file.identity == claim.pid_file) }, _ => Ok(false) }
}
fn acquire(roots: &Roots, requested_pid: u32, nonce: &str) -> io::Result<Value> {
    if requested_pid != unsafe { libc::getppid() } as u32 || !uuid(nonce) { return Err(invalid()); }
    // Legacy numeric markers are informational only. They never authorize
    // deletion of runtime publications and are retired under this guard.
    match open_at(&roots.data, OsStr::new("coordinator.pid.takeover"), libc::O_RDONLY | libc::O_DIRECTORY, 0) {
        Err(error) if error.raw_os_error() == Some(libc::ENOTDIR) => {
            let marker = read_at(&roots.data, OsStr::new("coordinator.pid.takeover"), true)?.ok_or_else(invalid)?;
            let marker_pid = pid(&marker)?;
            if observed(marker_pid)? != "gone" { return Ok(json!({"status":"blocked","ownerPid":marker_pid})); }
            if let Some(file) = read_at(&roots.data, OsStr::new("coordinator.pid"), true)? {
                let published = pid(&file)?;
                if observed(published)? != "gone" { return Ok(json!({"status":"blocked","ownerPid":published})); }
                unlink(&roots.data, "coordinator.pid", false)?;
            }
            unlink(&roots.data, "coordinator.pid.takeover", false)?;
        }
        Err(error) if error.kind() != io::ErrorKind::NotFound => return Err(error),
        _ => {}
    }
    let snap = snapshot(roots, &Target::Active)?;
    if let Some(o) = owner_for(&snap.claim)? {
        if observed(o.pid)? != "gone" {
            if o.pid != requested_pid || o.nonce != nonce { return Ok(json!({"status":"blocked","ownerPid":o.pid})); }
            if let ClaimSnapshot::Anchored { reservation,owner_file,pid_file:Some(pid_file),.. } = &snap.claim {
                return Ok(json!({"status":"owned","claim":Claim {pid:o.pid,nonce:o.nonce,reservation:reservation.clone(),owner_file:owner_file.identity.clone(),pid_file:pid_file.identity.clone()}}));
            }
            // A repeated request completes only its own anchored partial claim.
            let candidate = format!(".coordinator.pid.{nonce}.pid");
            match read_at(&roots.data, OsStr::new(&candidate), false)? {
                Some(existing) if pid(&existing)? == requested_pid => {},
                Some(_) => return Err(invalid()),
                None => write_new(&roots.data, &candidate, requested_pid.to_string().as_bytes())?,
            }
            if requested_pid != unsafe { libc::getppid() } as u32 { return Err(invalid()); }
            rename(&roots.data, &candidate, "coordinator.pid")?;
            let now = snapshot(roots, &Target::Active)?;
            if let ClaimSnapshot::Anchored {reservation,owner_file,pid_file:Some(pid_file),..} = now.claim { return Ok(json!({"status":"owned","claim":Claim {pid:requested_pid,nonce:nonce.into(),reservation,owner_file:owner_file.identity,pid_file:pid_file.identity}})); }
            return Err(invalid());
        }
    }
    if let ClaimSnapshot::DescriptorBoundPid {pid_file} = &snap.claim { if observed(pid(pid_file)?)? != "gone" { return Ok(json!({"status":"blocked","ownerPid":pid(pid_file)?})); } }
    for record in snap.active.iter().chain(snap.stopping.iter().map(|s| &s.record)) {
        let d = parse(record)?;
        if observed(d.pid)? != "gone" { return Ok(json!({"status":"blocked","ownerPid":d.pid})); }
        if let Some(b) = d.supervisor {
            if observed(b.pid)? != "gone" { return Ok(json!({"status":"blocked","ownerPid":b.pid})); }
        }
    }
    remove_claim(roots, &snap.claim)?;
    if requested_pid != unsafe { libc::getppid() } as u32 { return Err(invalid()); }
    let candidate = format!(".coordinator.pid.{nonce}"); let owner_name = format!("owner.{nonce}.json"); mkdir(&roots.data, &candidate)?;
    let candidate_dir = open_at(&roots.data, OsStr::new(&candidate), libc::O_RDONLY | libc::O_DIRECTORY, 0)?;
    write_new(&candidate_dir, &owner_name, &serde_json::to_vec(&Owner {version:1,pid:requested_pid,nonce:nonce.into()}).map_err(|_| invalid())?)?;
    if requested_pid != unsafe { libc::getppid() } as u32 { return Err(invalid()); }
    rename(&roots.data, &candidate, "coordinator.pid.takeover")?;
    let temp_pid = format!(".coordinator.pid.{nonce}.pid"); write_new(&roots.data, &temp_pid, requested_pid.to_string().as_bytes())?; rename(&roots.data, &temp_pid, "coordinator.pid")?;
    if requested_pid != unsafe { libc::getppid() } as u32 { return Err(invalid()); }
    let now = snapshot(roots, &Target::Active)?;
    if let ClaimSnapshot::Anchored {reservation,owner_file,pid_file:Some(pid_file),..} = now.claim { return Ok(json!({"status":"owned","claim":Claim {pid:requested_pid,nonce:nonce.into(),reservation,owner_file:owner_file.identity,pid_file:pid_file.identity}})); }
    Err(invalid())
}
fn inspect(roots: &Roots, target: &Target) -> io::Result<Value> {
    let snap = snapshot(roots, target)?; let d = selected(target, &snap.active, &snap.stopping)?.map(parse).transpose()?;
    let owner = owner_for(&snap.claim)?;
    let supervisor_state = match &d { Some(d) if d.supervisor.is_some() => observed(d.supervisor.as_ref().unwrap().pid)?, _ => match &owner {Some(o)=>observed(o.pid)?,None=>"absent"} };
    let child_state = match &d {Some(d)=>observed(d.pid)?,None=>"absent"};
    let mut bindings = Vec::new(); for item in &snap.stopping { bindings.push(parse(&item.record)?.supervisor.ok_or_else(invalid)?); }
    let names: Vec<_> = snap.stopping.iter().map(|s| s.name.clone()).collect();
    Ok(json!({"status":if d.is_some(){"present"}else{"absent"},"descriptor":d,"snapshot":snap,"stoppingNames":names,"stoppingBindings":bindings,"supervisorState":supervisor_state,"childState":child_state}))
}
fn reclaim(roots: &Roots, expected: &Snapshot) -> io::Result<Value> {
    let actual = snapshot(roots, &expected.target)?; if &actual != expected { return Ok(json!({"status":"changed"})); }
    let selected_record = selected(&actual.target, &actual.active, &actual.stopping)?; let descriptor = selected_record.map(parse).transpose()?;
    let selected_name = name(&actual.target)?;
    if actual.stopping.iter().any(|s| s.name != selected_name) || (!matches!(actual.target,Target::Active) && actual.active.is_some()) { return Ok(json!({"status":"busy"})); }
    if let Some(d) = &descriptor { if observed(d.pid)? != "gone" { return Ok(json!({"status":"busy"})); } if let Some(b) = &d.supervisor { if observed(b.pid)? != "gone" { return Ok(json!({"status":"busy"})); } } }
    if let Some(o) = owner_for(&actual.claim)? { if observed(o.pid)? != "gone" { return Ok(json!({"status":"busy"})); } }
    if let ClaimSnapshot::DescriptorBoundPid {pid_file} = &actual.claim {
        let p = pid(pid_file)?; if observed(p)? != "gone" { return Ok(json!({"status":"busy"})); }
        if !descriptor.as_ref().and_then(|d| d.supervisor.as_ref()).is_some_and(|b| b.pid == p) { return Ok(json!({"status":"busy"})); }
        remove_claim(roots, &actual.claim)?;
        if descriptor.is_some() { unlink(&roots.runtime, &selected_name, false)?; }
        return Ok(json!({"status":"removed"}));
    }
    if descriptor.is_none() && matches!(actual.claim,ClaimSnapshot::Absent) { return Ok(json!({"status":"absent"})); }
    if descriptor.is_some() { unlink(&roots.runtime, &selected_name, false)?; }
    remove_claim(roots, &actual.claim)?; Ok(json!({"status":"removed"}))
}
pub(crate) fn validate_publication(runtime: &Path, binding: &SupervisorBinding, child_pid: u32) -> io::Result<()> {
    if child_pid != std::process::id() || binding.pid != unsafe { libc::getppid() } as u32 { return Err(invalid()); }
    let data_path = runtime.parent().ok_or_else(invalid)?; let data = root(data_path)?;
    // Caller already holds the publication lock; do not reacquire it here.
    let dir = open_at(&data, OsStr::new("coordinator.pid.takeover"), libc::O_RDONLY | libc::O_DIRECTORY, 0)?; check_dir(&dir, true)?;
    let names = entries(&dir, &data_path.join("coordinator.pid.takeover"), 2)?; if names.len() != 1 { return Err(invalid()); }
    let file = read_at(&dir, OsStr::new(&names[0]), false)?.ok_or_else(invalid)?; let o = owner(&file, &names[0])?;
    let pid_file = read_at(&data, OsStr::new("coordinator.pid"), true)?.ok_or_else(invalid)?;
    if o.pid != binding.pid || o.nonce != binding.nonce || pid(&pid_file)? != binding.pid || binding.pid != unsafe { libc::getppid() } as u32 { return Err(invalid()); }
    Ok(())
}
fn claim_operation(roots: &Roots, claim: &Claim, release: bool) -> io::Result<Value> {
    let snap = snapshot(roots, &Target::Active)?;
    if matches!(snap.claim, ClaimSnapshot::Absent) { return Ok(json!({"status":"absent"})); }
    if !own_claim(&snap.claim, claim)? { return Ok(json!({"status":"changed"})); }
    if release { remove_claim(roots, &snap.claim)?; Ok(json!({"status":"released"})) }
    else { Ok(json!({"status":"owned"})) }
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
    if r.op == "runtime.prepare" || r.op == "supervisor.acquire" {
        crate::runtime::prepare(&r.data_dir)?;
        if r.op == "runtime.prepare" {
            let _ = Roots::open(&r.data_dir)?;
            return Ok(json!({"status":"prepared"}));
        }
    }
    let roots = match Roots::open(&r.data_dir) { Ok(r) => r, Err(e) if e.kind() == io::ErrorKind::NotFound && r.op == "supervisor.read" => return Ok(json!({"status":"absent"})), Err(e) => return Err(e) };
    match r.op.as_str() {
        "legacy.inspect" => crate::legacy_ops::inspect(&r.data_dir.to_string_lossy(), r.port.ok_or_else(invalid)?),
        "legacy.stop" => run_async(crate::legacy_ops::stop(&r.data_dir.to_string_lossy(), r.port.ok_or_else(invalid)?, r.identity.ok_or_else(invalid)?, r.escalate.unwrap_or(true))),
        "legacy.retire" => crate::legacy_ops::retire(&r.data_dir.to_string_lossy(), r.port.ok_or_else(invalid)?),
        "supervisor.acquire" => acquire(&roots, r.pid.ok_or_else(invalid)?, r.nonce.as_deref().ok_or_else(invalid)?),
        "supervisor.read" => { let snap = snapshot(&roots,&Target::Active)?; match owner_for(&snap.claim)? { Some(o) => Ok(json!({"status":"present","pid":o.pid,"nonce":o.nonce})), None if matches!(snap.claim,ClaimSnapshot::Absent) => Ok(json!({"status":"absent"})), None => Ok(json!({"status":"recoverable"})) } },
        "supervisor.check" | "supervisor.release" => claim_operation(&roots, r.claim.as_ref().ok_or_else(invalid)?, r.op == "supervisor.release"),
        "recovery.inspect" => inspect(&roots,r.target.as_ref().ok_or_else(invalid)?),
        "recovery.reclaim" => reclaim(&roots,r.snapshot.as_ref().ok_or_else(invalid)?),
        "intent.remove" => { let b = r.binding.as_ref().ok_or_else(invalid)?; let d = r.descriptor.as_ref().ok_or_else(invalid)?; let claim = r.claim.as_ref().ok_or_else(invalid)?; let snap = snapshot(&roots,&Target::Stopping {binding:b.clone()})?; if !own_claim(&snap.claim,claim)? || b.pid != claim.pid || b.nonce != claim.nonce || d.supervisor.as_ref() != Some(b) { return Err(invalid()); } let Some(record) = selected(&snap.target,&snap.active,&snap.stopping)? else { return Ok(json!({"status":"absent"})); }; if &parse(record)? != d { return Ok(json!({"status":"changed"})); } unlink(&roots.runtime,&name(&snap.target)?,false)?; Ok(json!({"status":"removed"})) },
        _ => Err(invalid()),
    }
}
pub(crate) fn run() -> io::Result<()> {
    let result = (|| { let mut input = Vec::new(); io::stdin().lock().take((LIMIT+1) as u64).read_to_end(&mut input)?; if input.len() > LIMIT { return Err(invalid()); }
        let raw: Value = serde_json::from_slice(&input).map_err(|_| invalid())?; let object = raw.as_object().ok_or_else(invalid)?;
        let extras: &[&str] = match object.get("op").and_then(Value::as_str) { Some("runtime.prepare" | "supervisor.read") => &[], Some("supervisor.acquire") => &["pid","nonce"], Some("supervisor.check" | "supervisor.release") => &["claim"], Some("recovery.inspect") => &["target"], Some("recovery.reclaim") => &["snapshot"], Some("intent.remove") => &["binding","descriptor","claim"], Some("legacy.inspect" | "legacy.retire") => &["port"], Some("legacy.stop") => &["port","identity","escalate"], _ => return Err(invalid()) };
        if object.len() != extras.len()+3 || !["version","dataDir","op"].iter().chain(extras).all(|k| object.get(*k).is_some_and(|v| !v.is_null())) { return Err(invalid()); }
        let result = dispatch(serde_json::from_value(raw).map_err(|_| invalid())?)?; let out = serde_json::to_vec(&json!({"version":1,"ok":true,"result":result})).map_err(|_| invalid())?; if out.len() > LIMIT { return Err(invalid()); } io::stdout().lock().write_all(&out)
    })();
    if let Err(e) = result { let kind = match e.kind() {io::ErrorKind::PermissionDenied=>"permission_denied",io::ErrorKind::NotFound=>"not_found",_=>"invalid_data"}; let _ = io::stdout().lock().write_all(json!({"version":1,"ok":false,"error":{"stage":"recovery","kind":kind}}).to_string().as_bytes()); return Err(io::Error::other("local-runtime request failed")); } Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> (tempfile::TempDir, Roots) {
        let temp = tempfile::tempdir().unwrap();
        crate::runtime::prepare(temp.path()).unwrap();
        let roots = Roots::open(temp.path()).unwrap();
        (temp, roots)
    }
    fn parent() -> u32 { unsafe { libc::getppid() as u32 } }
    fn install_owner(roots: &Roots, pid: u32, nonce: &str, with_pid: bool) {
        mkdir(&roots.data, "coordinator.pid.takeover").unwrap();
        let dir = open_at(&roots.data, OsStr::new("coordinator.pid.takeover"), libc::O_RDONLY | libc::O_DIRECTORY, 0).unwrap();
        let bytes = serde_json::to_vec(&Owner {version:1,pid,nonce:nonce.into()}).unwrap();
        write_new(&dir, &format!("owner.{nonce}.json"), &bytes).unwrap();
        if with_pid { write_new(&roots.data, "coordinator.pid", pid.to_string().as_bytes()).unwrap(); }
    }
    fn new_nonce() -> String { uuid::Uuid::new_v4().to_string() }

    #[test]
    fn native_empty_publication_never_adopts_live_partial() {
        let (_temp, roots) = fixture();
        let nonce = new_nonce(); install_owner(&roots, std::process::id(), &nonce, false);
        let result = acquire(&roots, parent(), &new_nonce()).unwrap();
        assert_eq!(result["status"], "blocked");
        assert!(read_at(&roots.data, OsStr::new("coordinator.pid"), true).unwrap().is_none());
    }
    #[test]
    fn native_unguarded_pid_never_overwrites_live_claim() {
        let (_temp, roots) = fixture();
        let nonce = new_nonce(); install_owner(&roots, std::process::id(), &nonce, true);
        let before = read_at(&roots.data, OsStr::new("coordinator.pid"), true).unwrap();
        assert_eq!(acquire(&roots, parent(), &new_nonce()).unwrap()["status"], "blocked");
        assert_eq!(read_at(&roots.data, OsStr::new("coordinator.pid"), true).unwrap(), before);
    }
    #[test]
    fn native_recursive_reclaim_rejects_unexpected_entries() {
        let (temp, roots) = fixture();
        mkdir(&roots.data, "coordinator.pid.takeover").unwrap();
        fs::write(temp.path().join("coordinator.pid.takeover").join("unexpected"), b"do not remove").unwrap();
        assert!(snapshot(&roots, &Target::Active).is_err());
        assert!(acquire(&roots, parent(), &new_nonce()).is_err());
        assert_eq!(fs::read(temp.path().join("coordinator.pid.takeover").join("unexpected")).unwrap(), b"do not remove");
    }
    #[test]
    fn native_age_never_authorizes_live_claim_theft() {
        let (_temp, roots) = fixture();
        let nonce = new_nonce(); install_owner(&roots, std::process::id(), &nonce, false);
        let snap = snapshot(&roots, &Target::Active).unwrap();
        assert_eq!(reclaim(&roots, &snap).unwrap()["status"], "busy");
        assert_eq!(acquire(&roots, parent(), &new_nonce()).unwrap()["status"], "blocked");
    }
    #[test]
    fn native_stale_release_preserves_successor() {
        let (_temp, roots) = fixture();
        let nonce = new_nonce(); install_owner(&roots, parent(), &nonce, true);
        let snap = snapshot(&roots, &Target::Active).unwrap();
        let ClaimSnapshot::Anchored { reservation, owner_file, pid_file:Some(pid_file), .. } = &snap.claim else { panic!("expected claim") };
        let stale = Claim { pid:parent(), nonce:new_nonce(), reservation:reservation.clone(), owner_file:owner_file.identity.clone(), pid_file:pid_file.identity.clone() };
        assert_eq!(claim_operation(&roots, &stale, true).unwrap()["status"], "changed");
        assert_eq!(snapshot(&roots, &Target::Active).unwrap(), snap);
    }
    #[test]
    fn native_probe_failure_never_means_gone() {
        assert_eq!(classify_probe(io::Error::from_raw_os_error(libc::EPERM)).unwrap(), "alive");
        assert_eq!(classify_probe(io::Error::from_raw_os_error(libc::ESRCH)).unwrap(), "gone");
        assert!(classify_probe(io::Error::from_raw_os_error(libc::EIO)).is_err());
    }
    #[test]
    fn native_collision_never_grants_ownership() {
        let (_temp, roots) = fixture();
        let nonce = new_nonce();
        mkdir(&roots.data, &format!(".coordinator.pid.{nonce}")).unwrap();
        assert!(acquire(&roots, parent(), &nonce).is_err());
        assert!(matches!(snapshot(&roots, &Target::Active).unwrap().claim, ClaimSnapshot::Absent));
    }
    #[test]
    fn native_reclaim_rejects_same_content_successor_inode() {
        let (_temp, roots) = fixture();
        let nonce = new_nonce(); install_owner(&roots, std::process::id(), &nonce, true);
        let previous = snapshot(&roots, &Target::Active).unwrap();
        rename(&roots.data, "coordinator.pid", ".old.pid").unwrap();
        write_new(&roots.data, "coordinator.pid", std::process::id().to_string().as_bytes()).unwrap();
        assert_eq!(reclaim(&roots, &previous).unwrap()["status"], "changed");
        assert!(read_at(&roots.data, OsStr::new("coordinator.pid"), true).unwrap().is_some());
    }
    #[test]
    fn native_reclaim_resumes_after_each_claim_removal_boundary() {
        let (_temp, roots) = fixture();
        let mut child = std::process::Command::new("/bin/sh").args(["-c", "exit 0"]).spawn().unwrap();
        let dead = child.id(); child.wait().unwrap();
        let nonce = new_nonce(); install_owner(&roots, dead, &nonce, true);
        let old = snapshot(&roots, &Target::Active).unwrap();
        unlink(&roots.data, "coordinator.pid", false).unwrap();
        assert_eq!(reclaim(&roots, &old).unwrap()["status"], "changed");
        let partial = snapshot(&roots, &Target::Active).unwrap();
        let ClaimSnapshot::Anchored { owner_name, .. } = &partial.claim else { panic!("expected anchor") };
        let dir = open_at(&roots.data, OsStr::new("coordinator.pid.takeover"), libc::O_RDONLY | libc::O_DIRECTORY, 0).unwrap();
        unlink(&dir, owner_name, false).unwrap();
        assert_eq!(reclaim(&roots, &partial).unwrap()["status"], "changed");
        let shell = snapshot(&roots, &Target::Active).unwrap();
        assert!(matches!(&shell.claim, ClaimSnapshot::Vacated { .. }));
        assert_eq!(reclaim(&roots, &shell).unwrap()["status"], "removed");
        assert!(matches!(snapshot(&roots, &Target::Active).unwrap().claim, ClaimSnapshot::Absent));
    }
}
