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
    let directory = if create {
        PinnedDirectory::prepare_data_directory(data)?
    } else {
        PinnedDirectory::open_data_directory(data)?
    };
    directory.open_private_child(OsStr::new("runtime"), create)
}

pub(crate) fn prepare(data: &Path) -> io::Result<PathBuf> {
    let runtime = data.join("runtime");
    let _pinned = open_runtime(&runtime, true)?;
    Ok(runtime)
}

// A predecessor is eligible only after the lifetime lease has been acquired.
// Validate the whole public schema before allowing its exact snapshot to retire.
fn parse_descriptor(bytes: &[u8]) -> io::Result<Descriptor> {
    let value: serde_json::Value = serde_json::from_slice(bytes)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    let object = value.as_object().ok_or_else(|| invalid("descriptor is not an object"))?;
    const FIELDS: &[&str] = &["transportVersion", "instanceId", "pid", "httpsPort",
        "grpcPort", "certificatePem", "bearerToken", "supervisor"];
    if object.len() != FIELDS.len() || FIELDS.iter().any(|field| !object.contains_key(*field)) {
        return Err(invalid("invalid descriptor fields"));
    }
    if let Some(supervisor) = object.get("supervisor").and_then(serde_json::Value::as_object) {
        if supervisor.len() != 3 || ["pid", "nonce", "generationId"].iter().any(|field| !supervisor.contains_key(*field)) {
            return Err(invalid("invalid descriptor supervisor fields"));
        }
    }
    // Parse the original bytes again so duplicate known keys are rejected.
    let descriptor: Descriptor = serde_json::from_slice(bytes)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    if descriptor.transport_version != crate::runtime::LOCAL_TRANSPORT_VERSION
        || descriptor.instance_id.is_empty()
        || descriptor.pid == 0
        || descriptor.https_port == 0
        || descriptor.grpc_port == Some(0)
        || !descriptor.certificate_pem.contains("-----BEGIN CERTIFICATE-----")
        || descriptor.bearer_token.len() != 43
        || !descriptor.bearer_token.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Err(invalid("invalid descriptor contents"));
    }
    if let Some(binding) = &descriptor.supervisor {
        SupervisorBinding::validate(binding.pid, binding.nonce.clone(), binding.generation_id.clone())
            .map_err(|_| invalid("invalid descriptor supervisor binding"))?;
    }
    Ok(descriptor)
}

pub(crate) fn read_descriptor(runtime: &Path) -> io::Result<Descriptor> {
    let directory = open_runtime(runtime, false)?;
    let guard = RecordGuard::open(&directory)?;
    let record = guard.read(OsStr::new(ACTIVE))?
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "coordinator descriptor not found"))?;
    parse_descriptor(&record.bytes)
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
            // The acquired process-lifetime lease excludes every live conforming
            // coordinator. It is not a reason to signal the recorded PID.
            // Preserve the complete, ACL-checked snapshot for handle-based
            // identity and byte revalidation inside publish_guarded.
            let predecessor = guard.read(OsStr::new(ACTIVE))?;
            if let Some(record) = &predecessor {
                parse_descriptor(&record.bytes)?;
            }
            let mut bytes = serde_json::to_vec(descriptor).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
            bytes.push(b'\n');
            let checks: Vec<(&OsStr, &RecordSnapshot)> = bindings.iter().map(|(name, record)| (name.as_os_str(), record)).collect();
            lease.publish_guarded(&guard, &checks, OsStr::new(ACTIVE), predecessor.as_ref(), &bytes)
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

#[cfg(test)]
mod tests {
    use super::*;

    fn descriptor() -> Descriptor {
        Descriptor {
            transport_version: crate::runtime::LOCAL_TRANSPORT_VERSION,
            instance_id: crate::runtime::random_token(),
            pid: std::process::id(),
            https_port: 1234,
            grpc_port: None,
            certificate_pem: "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----".into(),
            bearer_token: crate::runtime::random_token(),
            supervisor: None,
        }
    }

    fn fixture() -> (tempfile::TempDir, Arc<PinnedDirectory>) {
        let temp = tempfile::tempdir().unwrap();
        let runtime = prepare(&temp.path().join("han")).unwrap();
        let directory = Arc::new(open_runtime(&runtime, false).unwrap());
        (temp, directory)
    }

    #[test]
    fn crashed_predecessor_is_replaced_and_late_cleanup_cannot_remove_it() {
        let (_temp, directory) = fixture();
        let lease = CoordinatorLease::acquire(&directory).unwrap();
        let first = PublicationState::publish(directory.clone(), &lease, &descriptor()).unwrap();
        assert!(CoordinatorLease::acquire(&directory).is_err());
        // Model lease release on process death, retaining the old token to
        // exercise a delayed cleanup against the replacement.
        drop(lease);
        let lease = CoordinatorLease::acquire(&directory).unwrap();
        let replacement = descriptor();
        let second = PublicationState::publish(directory.clone(), &lease, &replacement).unwrap();
        let mut stale = descriptor();
        stale.supervisor = Some(SupervisorBinding::validate(1, uuid::Uuid::new_v4().to_string(),
            uuid::Uuid::new_v4().to_string()).unwrap());
        assert!(first.withdraw(&stale).is_err());
        first.cleanup();
        let guard = lease.guard().unwrap();
        let current = guard.read(OsStr::new(ACTIVE)).unwrap().unwrap();
        assert_eq!(current, second.snapshot);
        assert_eq!(parse_descriptor(&current.bytes).unwrap(), replacement);
        drop(guard);
        second.cleanup();
        assert!(lease.guard().unwrap().read(OsStr::new(ACTIVE)).unwrap().is_none());
    }

    #[test]
    fn malformed_predecessor_is_not_replaced() {
        let (_temp, directory) = fixture();
        let lease = CoordinatorLease::acquire(&directory).unwrap();
        let guard = lease.guard().unwrap();
        let bad = guard.create_if_absent(OsStr::new(ACTIVE), b"{\"transportVersion\":1}").unwrap();
        drop(guard);
        assert!(PublicationState::publish(directory.clone(), &lease, &descriptor()).is_err());
        let guard = lease.guard().unwrap();
        assert_eq!(guard.read(OsStr::new(ACTIVE)).unwrap(), Some(bad.clone()));
        guard.remove(OsStr::new(ACTIVE), &bad).unwrap();
    }

    #[test]
    fn descriptor_validation_rejects_unknown_duplicate_and_invalid_fields() {
        let bytes = serde_json::to_vec(&descriptor()).unwrap();
        assert!(parse_descriptor(&bytes).is_ok());
        let mut value: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        value["unexpected"] = serde_json::json!(true);
        assert!(parse_descriptor(&serde_json::to_vec(&value).unwrap()).is_err());
        value.as_object_mut().unwrap().remove("unexpected");
        value["bearerToken"] = serde_json::json!("bad");
        assert!(parse_descriptor(&serde_json::to_vec(&value).unwrap()).is_err());
        let text = String::from_utf8(bytes).unwrap().replacen(
            "\"transportVersion\":1", "\"transportVersion\":1,\"transportVersion\":1", 1);
        assert!(parse_descriptor(text.as_bytes()).is_err());
    }
}
