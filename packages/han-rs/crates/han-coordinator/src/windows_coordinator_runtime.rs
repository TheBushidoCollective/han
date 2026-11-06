//! Windows coordinator operations over the validated, pinned runtime directory.
use std::{ffi::{OsStr, OsString}, io, path::{Path, PathBuf}, sync::Arc};

use serde::Deserialize;
use crate::{runtime::{Descriptor, SupervisorBinding}, windows_process_identity::{self, ProcessIdentity}, windows_secure_fs::{CoordinatorLease, PinnedDirectory, RecordGuard, RecordSnapshot}};

const ACTIVE: &str = "coordinator.json";
const RESERVATION: &str = "supervisor.reservation.json";
const OWNER: &str = "supervisor.owner.json";
// These process-lifetime owners prevent a successor from acquiring the lease
// while detached connection tasks may still be unwinding.
static DIRECTORY: std::sync::OnceLock<Arc<PinnedDirectory>> = std::sync::OnceLock::new();
static LEASE: std::sync::OnceLock<CoordinatorLease<'static>> = std::sync::OnceLock::new();

pub(crate) fn retain_directory(runtime: &Path) -> io::Result<&'static Arc<PinnedDirectory>> {
    DIRECTORY.set(Arc::new(open_runtime(runtime, false)?))
        .map_err(|_| invalid("coordinator directory already initialized"))?;
    DIRECTORY.get().ok_or_else(|| invalid("coordinator directory unavailable"))
}

pub(crate) fn retain_lease(directory: &'static Arc<PinnedDirectory>) -> io::Result<&'static CoordinatorLease<'static>> {
    LEASE.set(CoordinatorLease::acquire(directory.as_ref())?)
        .map_err(|_| invalid("coordinator lease already initialized"))?;
    LEASE.get().ok_or_else(|| invalid("coordinator lease unavailable"))
}
const PID: &str = "supervisor.pid";

fn invalid(message: &'static str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

pub(crate) fn open_runtime(runtime: &Path, create: bool) -> io::Result<PinnedDirectory> {
    if runtime.file_name() != Some(OsStr::new("runtime")) {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "invalid runtime directory"));
    }
    let data = runtime.parent().ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "runtime has no data directory"))?;
    PinnedDirectory::open_data_directory(data)?.open_private_child(OsStr::new("runtime"), create)
}

pub(crate) fn prepare(data: &Path) -> io::Result<PathBuf> {
    let runtime = data.join("runtime");
    let _pinned = open_runtime(&runtime, true)?;
    Ok(runtime)
}

pub(crate) fn read_descriptor(runtime: &Path) -> io::Result<Descriptor> {
    let directory = open_runtime(runtime, false)?;
    let guard = RecordGuard::open(&directory)?;
    let record = guard.read(OsStr::new(ACTIVE))?
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "coordinator descriptor not found"))?;
    serde_json::from_slice(&record.bytes).map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SupervisorOwner {
    version: u32,
    nonce: String,
    process: ProcessIdentity,
}

fn required(guard: &RecordGuard<'_>, name: &str) -> io::Result<RecordSnapshot> {
    guard.read(OsStr::new(name))?.ok_or_else(|| invalid("supervisor claim is missing"))
}

fn supervisor_records(guard: &RecordGuard<'_>, binding: &SupervisorBinding) -> io::Result<Vec<(OsString, RecordSnapshot)>> {
    SupervisorBinding::validate(binding.pid, binding.nonce.clone(), binding.generation_id.clone())?;
    let reservation = required(guard, RESERVATION)?;
    let owner = required(guard, OWNER)?;
    let pid = required(guard, PID)?;
    if reservation.bytes != owner.bytes { return Err(invalid("supervisor records disagree")); }
    let claim: SupervisorOwner = serde_json::from_slice(&owner.bytes).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    if claim.version != 1 || claim.nonce != binding.nonce || claim.process.pid != binding.pid {
        return Err(invalid("supervisor claim does not match binding"));
    }
    let pid_text = std::str::from_utf8(&pid.bytes).map_err(|_| invalid("invalid supervisor pid record"))?;
    if pid_text != claim.process.pid.to_string() { return Err(invalid("supervisor pid record disagrees")); }
    windows_process_identity::verify_parent(&claim.process)?;
    Ok(vec![(RESERVATION.into(), reservation), (OWNER.into(), owner), (PID.into(), pid)])
}

/// The snapshot travels with shutdown state so that an old generation cannot
/// withdraw or remove a successor, even after a pathname is reused.
pub(crate) struct PublicationState {
    directory: Arc<PinnedDirectory>,
    snapshot: RecordSnapshot,
    standalone: Option<(OsString, RecordSnapshot)>,
}

impl PublicationState {
    pub(crate) fn publish(directory: Arc<PinnedDirectory>, lease: &CoordinatorLease<'_>, descriptor: &Descriptor) -> io::Result<Self> {
        let guard = lease.guard()?;
        let mut standalone = None;
        let bindings = if let Some(binding) = &descriptor.supervisor {
            supervisor_records(&guard, binding)?
        } else {
            let name = OsString::from(format!(".coordinator-owner-{}.json", uuid::Uuid::new_v4()));
            let identity = windows_process_identity::current_identity()?;
            let bytes = serde_json::to_vec(&identity).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
            let snapshot = guard.create_if_absent(&name, &bytes)?;
            standalone = Some((name.clone(), snapshot.clone()));
            vec![(name, snapshot)]
        };
        let result = (|| {
            // An existing descriptor is not an identity-safe proof that its PID
            // is dead. Refuse replacement until predecessor eligibility is available.
            if guard.read(OsStr::new(ACTIVE))?.is_some() {
                return Err(io::Error::new(io::ErrorKind::AlreadyExists, "existing coordinator descriptor requires identity-safe predecessor verification"));
            }
            let mut bytes = serde_json::to_vec(descriptor).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
            bytes.push(b'\n');
            let checks: Vec<(&OsStr, &RecordSnapshot)> = bindings.iter().map(|(name, record)| (name.as_os_str(), record)).collect();
            lease.publish_guarded(&guard, &checks, OsStr::new(ACTIVE), None, &bytes)
        })();
        let publication = match result {
            Ok(publication) => publication,
            Err(error) => {
                if let Some((name, snapshot)) = &standalone {
                    if let Err(cleanup) = guard.remove(name, snapshot) {
                        return Err(io::Error::other(format!("publication failed: {error}; owner cleanup failed: {cleanup}")));
                    }
                }
                return Err(error);
            }
        };
        if let Some(error) = publication.retirement_cleanup_error {
            tracing::warn!("Coordinator descriptor was published but retirement cleanup failed: {}", error);
        }
        drop(guard);
        Ok(Self { directory, snapshot: publication.snapshot, standalone })
    }

    pub(crate) fn withdraw(&self, descriptor: &Descriptor) -> io::Result<()> {
        let binding = descriptor.supervisor.as_ref().ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "supervisor binding required"))?;
        SupervisorBinding::validate(binding.pid, binding.nonce.clone(), binding.generation_id.clone())?;
        let stopping = format!("coordinator.stopping.{}.{}.json", binding.nonce, binding.generation_id);
        let guard = RecordGuard::open(&self.directory)?;
        guard.withdraw(OsStr::new(ACTIVE), &self.snapshot, OsStr::new(&stopping))
    }
    pub(crate) fn cleanup(&self) {
        let Ok(guard) = RecordGuard::open(&self.directory) else { return };
        if let Err(error) = guard.remove(OsStr::new(ACTIVE), &self.snapshot) {
            if error.kind() != io::ErrorKind::NotFound {
                tracing::warn!("Could not remove owned coordinator descriptor: {}", error);
            }
        }
        if let Some((name, snapshot)) = &self.standalone {
            if let Err(error) = guard.remove(name, snapshot) {
                tracing::warn!("Could not remove coordinator ownership record: {}", error);
            }
        }
    }
}
