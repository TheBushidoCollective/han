//! Local coordinator identity and owner-protected publication.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use std::{fs, io::{self, Write}, path::{Path, PathBuf}};

pub const LOCAL_TRANSPORT_VERSION: u32 = 1;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Descriptor {
    pub transport_version: u32,
    pub instance_id: String,
    pub pid: u32,
    pub https_port: u16,
    pub grpc_port: Option<u16>,
    pub certificate_pem: String,
    pub bearer_token: String,
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
    fs::create_dir_all(dir)?;
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

pub struct PublishedDescriptor { path: PathBuf, instance_id: String }
impl PublishedDescriptor {
    #[cfg(unix)]
    pub fn publish(runtime: &Path, descriptor: &Descriptor) -> io::Result<Self> {
        use std::os::unix::fs::OpenOptionsExt;
        let path = runtime.join("coordinator.json");
        let temp = runtime.join(format!(".coordinator.{}.tmp", descriptor.instance_id));
        let result = (|| {
            let mut file = fs::OpenOptions::new().write(true).create_new(true).mode(0o600).custom_flags(libc::O_NOFOLLOW).open(&temp)?;
            serde_json::to_writer(&mut file, descriptor)?;
            file.write_all(b"\n")?;
            file.sync_all()?;
            fs::rename(&temp, &path)?;
            Ok(Self { path, instance_id: descriptor.instance_id.clone() })
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
    fn drop(&mut self) {
        if fs::read(&self.path).ok().and_then(|b| serde_json::from_slice::<Descriptor>(&b).ok()).is_some_and(|d| d.instance_id == self.instance_id) {
            let _ = fs::remove_file(&self.path);
        }
    }
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
        let mut descriptor = Descriptor { transport_version: 1, instance_id: random_token(), pid: std::process::id(), https_port: 1234, grpc_port: None, certificate_pem: "public".into(), bearer_token: random_token() };
        let published = PublishedDescriptor::publish(&runtime, &descriptor).unwrap();
        assert_eq!(fs::metadata(runtime.join("coordinator.json")).unwrap().permissions().mode() & 0o777, 0o600);
        descriptor.instance_id = random_token();
        fs::write(runtime.join("coordinator.json"), serde_json::to_vec(&descriptor).unwrap()).unwrap();
        drop(published);
        assert!(runtime.join("coordinator.json").exists());
    }
    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_runtime() {
        let temp = tempfile::tempdir().unwrap();
        let target = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(target.path(), temp.path().join("runtime")).unwrap();
        assert!(prepare(temp.path()).is_err());
    }
}
