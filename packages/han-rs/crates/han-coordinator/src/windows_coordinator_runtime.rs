//! Windows coordinator operations over the validated, pinned runtime directory.
use std::{ffi::OsStr, io, path::{Path, PathBuf}};

use crate::{runtime::Descriptor, windows_secure_fs::{PinnedDirectory, RecordGuard}};

fn open_runtime(runtime: &Path, create: bool) -> io::Result<PinnedDirectory> {
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
    let record = guard.read(OsStr::new("coordinator.json"))?
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "coordinator descriptor not found"))?;
    serde_json::from_slice(&record.bytes).map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
}
