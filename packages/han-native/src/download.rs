//! Download utilities for ONNX Runtime and embedding models
//!
//! This module handles downloading and extracting dependencies at runtime,
//! using rustls for TLS (no openssl-sys dependency).

use futures::StreamExt;
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::AsyncWriteExt;

/// Get the cache directory for han
pub fn get_cache_dir() -> PathBuf {
    dirs::cache_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("han")
}

/// Get the ONNX Runtime directory
pub fn get_onnxruntime_dir() -> PathBuf {
    get_cache_dir().join("onnxruntime")
}

/// Get the models directory
pub fn get_models_dir() -> PathBuf {
    get_cache_dir().join("models")
}

/// ONNX Runtime version to download
const ONNXRUNTIME_VERSION: &str = "1.20.1";

/// Get the ONNX Runtime download URL for the current platform
pub fn get_onnxruntime_url() -> Option<String> {
    let base = format!(
        "https://github.com/microsoft/onnxruntime/releases/download/v{}/onnxruntime",
        ONNXRUNTIME_VERSION
    );

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    return Some(format!("{}-osx-arm64-{}.tgz", base, ONNXRUNTIME_VERSION));

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    return Some(format!("{}-osx-x86_64-{}.tgz", base, ONNXRUNTIME_VERSION));

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    return Some(format!("{}-linux-x64-{}.tgz", base, ONNXRUNTIME_VERSION));

    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    return Some(format!("{}-linux-aarch64-{}.tgz", base, ONNXRUNTIME_VERSION));

    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    return Some(format!("{}-win-x64-{}.zip", base, ONNXRUNTIME_VERSION));

    #[cfg(not(any(
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "aarch64"),
        all(target_os = "windows", target_arch = "x86_64"),
    )))]
    return None;
}

/// Get the ONNX Runtime library filename for the current platform
pub fn get_onnxruntime_lib_name() -> &'static str {
    #[cfg(target_os = "macos")]
    return "libonnxruntime.dylib";

    #[cfg(target_os = "linux")]
    return "libonnxruntime.so";

    #[cfg(target_os = "windows")]
    return "onnxruntime.dll";

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    return "libonnxruntime.so";
}

/// Get the path to the ONNX Runtime library
pub fn get_onnxruntime_lib_path() -> PathBuf {
    get_onnxruntime_dir()
        .join(format!("onnxruntime-v{}", ONNXRUNTIME_VERSION))
        .join("lib")
        .join(get_onnxruntime_lib_name())
}

/// Embedding model info
const MODEL_NAME: &str = "all-MiniLM-L6-v2";
const MODEL_URL: &str = "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx";
const TOKENIZER_URL: &str = "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json";

/// Get the path to the embedding model
pub fn get_model_path() -> PathBuf {
    get_models_dir().join(MODEL_NAME).join("model.onnx")
}

/// Get the path to the tokenizer
pub fn get_tokenizer_path() -> PathBuf {
    get_models_dir().join(MODEL_NAME).join("tokenizer.json")
}

/// Check if ONNX Runtime is downloaded
pub async fn is_onnxruntime_available() -> bool {
    let lib_path = get_onnxruntime_lib_path();
    fs::metadata(&lib_path).await.is_ok()
}

/// Check if the embedding model is downloaded
pub async fn is_model_available() -> bool {
    let model_path = get_model_path();
    let tokenizer_path = get_tokenizer_path();
    fs::metadata(&model_path).await.is_ok() && fs::metadata(&tokenizer_path).await.is_ok()
}

/// Download a file with progress
pub async fn download_file(url: &str, dest: &Path) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to download {}: {}", url, e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status {}: {}",
            response.status(),
            url
        ));
    }

    let mut file = fs::File::create(dest)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Failed to read chunk: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write chunk: {}", e))?;
    }

    file.flush()
        .await
        .map_err(|e| format!("Failed to flush file: {}", e))?;

    Ok(())
}

/// Download and extract ONNX Runtime
pub async fn ensure_onnxruntime() -> Result<PathBuf, String> {
    let lib_path = get_onnxruntime_lib_path();

    if fs::metadata(&lib_path).await.is_ok() {
        return Ok(lib_path);
    }

    let url = get_onnxruntime_url().ok_or("Unsupported platform for ONNX Runtime")?;
    let ort_dir = get_onnxruntime_dir();
    fs::create_dir_all(&ort_dir)
        .await
        .map_err(|e| format!("Failed to create ONNX Runtime directory: {}", e))?;

    // Download to temp file
    let archive_ext = if cfg!(windows) { "zip" } else { "tgz" };
    let archive_path = ort_dir.join(format!("onnxruntime.{}", archive_ext));

    tracing::info!("Downloading ONNX Runtime from {}...", url);
    download_file(&url, &archive_path).await?;

    // Extract
    tracing::info!("Extracting ONNX Runtime...");
    extract_archive(&archive_path, &ort_dir).await?;

    // Clean up archive
    let _ = fs::remove_file(&archive_path).await;

    if fs::metadata(&lib_path).await.is_ok() {
        Ok(lib_path)
    } else {
        Err("ONNX Runtime library not found after extraction".to_string())
    }
}

/// Download the embedding model
pub async fn ensure_model() -> Result<PathBuf, String> {
    let model_path = get_model_path();
    let tokenizer_path = get_tokenizer_path();

    let model_dir = get_models_dir().join(MODEL_NAME);
    fs::create_dir_all(&model_dir)
        .await
        .map_err(|e| format!("Failed to create model directory: {}", e))?;

    if fs::metadata(&model_path).await.is_err() {
        tracing::info!("Downloading embedding model...");
        download_file(MODEL_URL, &model_path).await?;
    }

    if fs::metadata(&tokenizer_path).await.is_err() {
        tracing::info!("Downloading tokenizer...");
        download_file(TOKENIZER_URL, &tokenizer_path).await?;
    }

    Ok(model_path)
}

/// Extract an archive (tar.gz or zip)
async fn extract_archive(archive_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let archive_path = archive_path.to_path_buf();
    let dest_dir = dest_dir.to_path_buf();

    // Use blocking task for extraction
    tokio::task::spawn_blocking(move || {
        let file = std::fs::File::open(&archive_path)
            .map_err(|e| format!("Failed to open archive: {}", e))?;

        let ext = archive_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        match ext {
            "tgz" | "gz" => {
                let decoder = flate2::read::GzDecoder::new(file);
                let mut archive = tar::Archive::new(decoder);
                archive
                    .unpack(&dest_dir)
                    .map_err(|e| format!("Failed to extract tar.gz: {}", e))?;
            }
            "zip" => {
                let mut archive = zip::ZipArchive::new(file)
                    .map_err(|e| format!("Failed to read zip: {}", e))?;
                archive
                    .extract(&dest_dir)
                    .map_err(|e| format!("Failed to extract zip: {}", e))?;
            }
            _ => return Err(format!("Unknown archive format: {}", ext)),
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Extraction task failed: {}", e))?
}
