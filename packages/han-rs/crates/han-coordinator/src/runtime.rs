//! Local coordinator identity and owner-protected publication.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use std::{fs, io::{self, Read, Write}, path::{Path, PathBuf}};

pub const LOCAL_TRANSPORT_VERSION: u32 = 1;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Descriptor {
    pub transport_version: u32,
    pub instance_id: String,
    pub pid: u32,
    pub https_port: u16,
    pub grpc_port: Option<u16>,
    pub certificate_pem: String,
    pub bearer_token: String,
    #[serde(deserialize_with = "deserialize_supervisor")]
    pub supervisor: Option<SupervisorBinding>,
}

fn deserialize_supervisor<'de, D: serde::Deserializer<'de>>(deserializer: D) -> Result<Option<SupervisorBinding>, D::Error> {
    Option::<SupervisorBinding>::deserialize(deserializer)
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupervisorBinding {
    pub pid: u32,
    pub nonce: String,
    pub generation_id: String,
}

impl SupervisorBinding {
    pub fn validate(pid: u32, nonce: String, generation_id: String) -> io::Result<Self> {
        let canonical_uuid = |s: &str| uuid::Uuid::parse_str(s)
            .is_ok_and(|id| id.hyphenated().to_string() == s);
        if pid == 0 || pid > i32::MAX as u32 || !canonical_uuid(&nonce) || !canonical_uuid(&generation_id) {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "invalid supervisor binding"));
        }
        Ok(Self { pid, nonce, generation_id })
    }
}

#[cfg(unix)]
struct PublicationGuard(fs::File);

#[cfg(unix)]
impl PublicationGuard {
    fn acquire(runtime: &Path) -> io::Result<Self> {
        use std::os::unix::{fs::{MetadataExt, OpenOptionsExt, PermissionsExt}, io::AsRawFd};
        let file = fs::OpenOptions::new().read(true).write(true).create(true)
            .mode(0o600).custom_flags(libc::O_NOFOLLOW)
            .open(runtime.join("descriptor-publication.lock"))?;
        let metadata = file.metadata()?;
        if !metadata.is_file() || metadata.uid() != unsafe { libc::geteuid() }
            || metadata.permissions().mode() & 0o077 != 0
        {
            return Err(io::Error::new(io::ErrorKind::PermissionDenied, "insecure descriptor publication lock"));
        }
        loop {
            if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX) } == 0 {
                return Ok(Self(file));
            }
            let error = io::Error::last_os_error();
            if error.kind() != io::ErrorKind::Interrupted { return Err(error); }
        }
    }
}

#[cfg(unix)]
impl Drop for PublicationGuard {
    fn drop(&mut self) {
        use std::os::unix::io::AsRawFd;
        unsafe { libc::flock(self.0.as_raw_fd(), libc::LOCK_UN); }
    }
}

#[derive(Clone)]
pub struct ShutdownContext {
    pub runtime: PathBuf,
    pub descriptor: Descriptor,
}

impl ShutdownContext {
    #[cfg(unix)]
    pub fn withdraw(&self) -> io::Result<()> {
        let binding = self.descriptor.supervisor.as_ref().ok_or_else(||
            io::Error::new(io::ErrorKind::InvalidInput, "supervisor binding required"))?;
        // Revalidate before using either value as a pathname component.
        SupervisorBinding::validate(binding.pid, binding.nonce.clone(), binding.generation_id.clone())?;
        let _guard = PublicationGuard::acquire(&self.runtime)?;
        if read_descriptor(&self.runtime)? != self.descriptor {
            return Err(io::Error::new(io::ErrorKind::PermissionDenied, "coordinator descriptor ownership changed"));
        }
        let stopping = self.runtime.join(format!("coordinator.stopping.{}.{}.json", binding.nonce, binding.generation_id));
        match fs::symlink_metadata(&stopping) {
            Err(e) if e.kind() == io::ErrorKind::NotFound => {},
            Err(e) => return Err(e),
            Ok(_) => return Err(io::Error::new(io::ErrorKind::AlreadyExists, "shutdown intent already exists")),
        }
        fs::rename(self.runtime.join("coordinator.json"), stopping)
    }

    #[cfg(not(unix))]
    pub fn withdraw(&self) -> io::Result<()> {
        Err(io::Error::new(io::ErrorKind::Unsupported, "secure descriptor ACL support is required on this platform"))
    }
}

pub fn random_token() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn data_dir(explicit: Option<&Path>) -> io::Result<PathBuf> {
    let dir = explicit.map(Path::to_path_buf)
        .or_else(|| std::env::var_os("HAN_DATA_DIR").map(PathBuf::from))
        .or_else(|| std::env::var_os("CLAUDE_CONFIG_DIR").map(|p| PathBuf::from(p).join("han")))
        .or_else(|| dirs::home_dir().map(|p| p.join(".han")))
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "cannot resolve Han data directory"))?;
    if dir.is_absolute() { Ok(dir) } else { Ok(std::env::current_dir()?.join(dir)) }
}

#[cfg(unix)]
pub fn prepare(dir: &Path) -> io::Result<PathBuf> {
    use std::os::unix::fs::{DirBuilderExt, MetadataExt, PermissionsExt};
    fs::DirBuilder::new().recursive(true).mode(0o700).create(dir)?;
    let data_metadata = fs::symlink_metadata(dir)?;
    if !data_metadata.is_dir() || data_metadata.file_type().is_symlink()
        || data_metadata.uid() != unsafe { libc::geteuid() } || data_metadata.permissions().mode() & 0o022 != 0
    {
        return Err(io::Error::new(io::ErrorKind::PermissionDenied, "data directory must be user-owned and not writable by others or a symlink"));
    }
    let runtime = dir.join("runtime");
    match fs::DirBuilder::new().mode(0o700).create(&runtime) {
        Ok(()) => {},
        Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {},
        Err(e) => return Err(e),
    }
    let metadata = fs::symlink_metadata(&runtime)?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() || metadata.uid() != unsafe { libc::geteuid() } || metadata.permissions().mode() & 0o077 != 0 {
        return Err(io::Error::new(io::ErrorKind::PermissionDenied, "runtime directory must be owned by the current user, private, and not a symlink"));
    }
    Ok(runtime)
}

#[cfg(not(unix))]
pub fn prepare(_dir: &Path) -> io::Result<PathBuf> {
    Err(io::Error::new(io::ErrorKind::Unsupported, "secure runtime directory ACL support is required on this platform"))
}

#[cfg(unix)]
pub fn read_descriptor(runtime: &Path) -> io::Result<Descriptor> {
    use std::os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt};
    let file = fs::OpenOptions::new().read(true).custom_flags(libc::O_NOFOLLOW)
        .open(runtime.join("coordinator.json"))?;
    let metadata = file.metadata()?;
    if !metadata.is_file() || metadata.uid() != unsafe { libc::geteuid() }
        || metadata.permissions().mode() & 0o077 != 0
    {
        return Err(io::Error::new(io::ErrorKind::PermissionDenied, "insecure coordinator descriptor"));
    }
    let mut data = Vec::new();
    file.take(64 * 1024).read_to_end(&mut data)?;
    serde_json::from_slice(&data).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

#[cfg(not(unix))]
pub fn read_descriptor(_runtime: &Path) -> io::Result<Descriptor> {
    Err(io::Error::new(io::ErrorKind::Unsupported, "secure descriptor ACL support is required on this platform"))
}


pub struct PublishedDescriptor { runtime: PathBuf, descriptor: Descriptor }
impl PublishedDescriptor {
    #[cfg(unix)]
    pub fn publish(runtime: &Path, descriptor: &Descriptor) -> io::Result<Self> {
        use std::os::unix::fs::OpenOptionsExt;
        let _guard = PublicationGuard::acquire(runtime)?;
        let path = runtime.join("coordinator.json");
        let temp = runtime.join(format!(".coordinator.{}.tmp", descriptor.instance_id));
        let result = (|| {
            let mut file = fs::OpenOptions::new().write(true).create_new(true).mode(0o600).custom_flags(libc::O_NOFOLLOW).open(&temp)?;
            serde_json::to_writer(&mut file, descriptor)?;
            file.write_all(b"\n")?;
            file.sync_all()?;
            fs::rename(&temp, &path)?;
            Ok(Self { runtime: runtime.to_path_buf(), descriptor: descriptor.clone() })
        })();
        if result.is_err() { let _ = fs::remove_file(&temp); }
        result
    }
    #[cfg(not(unix))]
    pub fn publish(_runtime: &Path, _descriptor: &Descriptor) -> io::Result<Self> {
        Err(io::Error::new(io::ErrorKind::Unsupported, "secure descriptor ACL support is required on this platform"))
    }
}
impl Drop for PublishedDescriptor {
    #[cfg(unix)]
    fn drop(&mut self) {
        let Ok(_guard) = PublicationGuard::acquire(&self.runtime) else { return };
        if read_descriptor(&self.runtime).is_ok_and(|d| d == self.descriptor) {
            let _ = fs::remove_file(self.runtime.join("coordinator.json"));
        }
    }
    #[cfg(not(unix))]
    fn drop(&mut self) {}
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    #[test]
    fn publication_is_private_and_cleanup_checks_instance() {
        use std::os::unix::fs::PermissionsExt;
        let temp = tempfile::tempdir().unwrap();
        let runtime = prepare(temp.path()).unwrap();
        let mut descriptor = Descriptor { transport_version: 1, instance_id: random_token(), pid: std::process::id(), https_port: 1234, grpc_port: None, certificate_pem: "public".into(), bearer_token: random_token(), supervisor: None };
        let published = PublishedDescriptor::publish(&runtime, &descriptor).unwrap();
        assert_eq!(fs::metadata(runtime.join("coordinator.json")).unwrap().permissions().mode() & 0o777, 0o600);
        descriptor.instance_id = random_token();
        fs::write(runtime.join("coordinator.json"), serde_json::to_vec(&descriptor).unwrap()).unwrap();
        drop(published);
        assert!(runtime.join("coordinator.json").exists());
    }

    #[cfg(unix)]
    #[test]
    fn withdrawal_and_drop_never_touch_replacement() {
        let temp = tempfile::tempdir().unwrap();
        let runtime = prepare(temp.path()).unwrap();
        let binding = SupervisorBinding::validate(123, uuid::Uuid::new_v4().to_string(), uuid::Uuid::new_v4().to_string()).unwrap();
        let descriptor = Descriptor { transport_version: 1, instance_id: random_token(), pid: 1, https_port: 1234, grpc_port: None, certificate_pem: "cert".into(), bearer_token: random_token(), supervisor: Some(binding.clone()) };
        let old = PublishedDescriptor::publish(&runtime, &descriptor).unwrap();
        let mut replacement = descriptor.clone();
        replacement.bearer_token = random_token();
        let new = PublishedDescriptor::publish(&runtime, &replacement).unwrap();
        let context = ShutdownContext { runtime: runtime.clone(), descriptor };
        assert_eq!(context.withdraw().unwrap_err().kind(), io::ErrorKind::PermissionDenied);
        drop(old);
        assert_eq!(read_descriptor(&runtime).unwrap(), replacement);
        assert!(!runtime.join(format!("coordinator.stopping.{}.{}.json", binding.nonce, binding.generation_id)).exists());
        drop(new);
        assert!(!runtime.join("coordinator.json").exists());
    }

    #[cfg(unix)]
    #[test]
    fn withdrawal_commits_exact_private_descriptor_and_preserves_it_on_drop() {
        use std::os::unix::fs::PermissionsExt;
        let temp = tempfile::tempdir().unwrap();
        let runtime = prepare(temp.path()).unwrap();
        let binding = SupervisorBinding::validate(123, uuid::Uuid::new_v4().to_string(), uuid::Uuid::new_v4().to_string()).unwrap();
        let descriptor = Descriptor { transport_version: 1, instance_id: random_token(), pid: 1, https_port: 1234, grpc_port: None, certificate_pem: "cert".into(), bearer_token: random_token(), supervisor: Some(binding.clone()) };
        let published = PublishedDescriptor::publish(&runtime, &descriptor).unwrap();
        ShutdownContext { runtime: runtime.clone(), descriptor: descriptor.clone() }.withdraw().unwrap();
        drop(published);
        let path = runtime.join(format!("coordinator.stopping.{}.{}.json", binding.nonce, binding.generation_id));
        assert!(!runtime.join("coordinator.json").exists());
        assert_eq!(fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
        assert_eq!(serde_json::from_slice::<Descriptor>(&fs::read(path).unwrap()).unwrap(), descriptor);
    }

    #[cfg(unix)]
    #[test]
    fn publication_lock_rejects_symlink_and_public_file() {
        use std::os::unix::fs::PermissionsExt;
        let temp = tempfile::tempdir().unwrap();
        let runtime = prepare(temp.path()).unwrap();
        let lock = runtime.join("descriptor-publication.lock");
        let target = temp.path().join("target");
        fs::write(&target, "").unwrap();
        std::os::unix::fs::symlink(&target, &lock).unwrap();
        assert!(PublicationGuard::acquire(&runtime).is_err());
        fs::remove_file(&lock).unwrap();
        fs::write(&lock, "").unwrap();
        fs::set_permissions(&lock, fs::Permissions::from_mode(0o644)).unwrap();
        assert!(PublicationGuard::acquire(&runtime).is_err());
    }

    #[test]
    fn supervisor_binding_rejects_invalid_path_components() {
        let uuid = "abcdefab-cdef-4abc-8def-abcdefabcdef".to_string();
        assert!(SupervisorBinding::validate(0, uuid.clone(), uuid.clone()).is_err());
        assert!(SupervisorBinding::validate(1, "../escape".into(), uuid.clone()).is_err());
        assert!(SupervisorBinding::validate(1, uuid.to_uppercase(), uuid.clone()).is_err());
        assert!(SupervisorBinding::validate(1, uuid.clone(), uuid).is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn waiting_withdrawal_observes_replacement_published_under_guard() {
        let temp = tempfile::tempdir().unwrap();
        let runtime = prepare(temp.path()).unwrap();
        let binding = SupervisorBinding::validate(123, uuid::Uuid::new_v4().to_string(), uuid::Uuid::new_v4().to_string()).unwrap();
        let descriptor = Descriptor { transport_version: 1, instance_id: random_token(), pid: 1, https_port: 1234, grpc_port: None, certificate_pem: "cert".into(), bearer_token: random_token(), supervisor: Some(binding.clone()) };
        let old = PublishedDescriptor::publish(&runtime, &descriptor).unwrap();
        let guard = PublicationGuard::acquire(&runtime).unwrap();
        let context = ShutdownContext { runtime: runtime.clone(), descriptor: descriptor.clone() };
        let (tx, rx) = std::sync::mpsc::channel();
        let thread = std::thread::spawn(move || {
            tx.send(()).unwrap();
            context.withdraw()
        });
        rx.recv().unwrap();
        let mut replacement = descriptor;
        replacement.instance_id = random_token();
        let temporary = runtime.join("replacement.tmp");
        fs::write(&temporary, serde_json::to_vec(&replacement).unwrap()).unwrap();
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temporary, fs::Permissions::from_mode(0o600)).unwrap();
        fs::rename(temporary, runtime.join("coordinator.json")).unwrap();
        drop(guard);
        assert_eq!(thread.join().unwrap().unwrap_err().kind(), io::ErrorKind::PermissionDenied);
        drop(old);
        assert_eq!(read_descriptor(&runtime).unwrap(), replacement);
        assert!(!runtime.join(format!("coordinator.stopping.{}.{}.json", binding.nonce, binding.generation_id)).exists());
    }
    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_runtime() {
        let temp = tempfile::tempdir().unwrap();
        let target = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(target.path(), temp.path().join("runtime")).unwrap();
        assert!(prepare(temp.path()).is_err());
    }
    #[cfg(windows)]
    #[test]
    fn windows_refuses_runtime_without_acl_implementation() {
        let temp = tempfile::tempdir().unwrap();
        let error = prepare(temp.path()).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::Unsupported);
        assert!(!temp.path().join("runtime").exists());
    }

    #[cfg(unix)]
    #[test]
    fn descriptor_reader_rejects_symlinks_and_public_modes() {
        use std::os::unix::fs::PermissionsExt;
        let temp = tempfile::tempdir().unwrap();
        let runtime = prepare(temp.path()).unwrap();
        let target = temp.path().join("outside");
        fs::write(&target, "{}").unwrap();
        std::os::unix::fs::symlink(&target, runtime.join("coordinator.json")).unwrap();
        assert!(read_descriptor(&runtime).is_err());
        fs::remove_file(runtime.join("coordinator.json")).unwrap();
        fs::write(runtime.join("coordinator.json"), "{}").unwrap();
        fs::set_permissions(runtime.join("coordinator.json"), fs::Permissions::from_mode(0o644)).unwrap();
        assert_eq!(read_descriptor(&runtime).err().unwrap().kind(), io::ErrorKind::PermissionDenied);
    }
}
