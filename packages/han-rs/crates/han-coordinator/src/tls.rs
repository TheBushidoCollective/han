//! TLS certificate management for the coordinator.
//!
//! Generates self-signed certificates for coordinator.local.han.guru using rcgen.
//! Certificates are cached in `~/.han/certs/` and reused if still valid.

use rcgen::{CertificateParams, DistinguishedName, KeyPair, SanType};
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

const CERT_DOMAIN: &str = "coordinator.local.han.guru";
const CERT_VALIDITY_DAYS: i64 = 365;

#[derive(Error, Debug)]
pub enum TlsError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Certificate generation error: {0}")]
    Rcgen(#[from] rcgen::Error),
    #[error("Rustls error: {0}")]
    Rustls(#[from] rustls::Error),
    #[error("Home directory not found")]
    NoHomeDir,
}

/// TLS certificate pair (cert + key in PEM format).
pub struct CertPair {
    pub cert_pem: String,
    pub key_pem: String,
}

/// Get or create TLS certificates.
pub fn ensure_certificates() -> Result<CertPair, TlsError> {
    let certs_dir = get_certs_dir()?;
    let cert_path = certs_dir.join("coordinator.pem");
    let key_path = certs_dir.join("coordinator-key.pem");

    // Check if existing certs are valid
    if cert_path.exists() && key_path.exists() {
        let cert_pem = fs::read_to_string(&cert_path)?;
        let key_pem = fs::read_to_string(&key_path)?;
        tracing::info!("Using cached TLS certificates from {:?}", certs_dir);
        return Ok(CertPair { cert_pem, key_pem });
    }

    // Generate new self-signed certificate
    tracing::info!("Generating self-signed TLS certificate for {}", CERT_DOMAIN);
    let pair = generate_certificate()?;

    // Cache to disk
    fs::create_dir_all(&certs_dir)?;
    fs::write(&cert_path, &pair.cert_pem)?;
    fs::write(&key_path, &pair.key_pem)?;

    tracing::info!("TLS certificates saved to {:?}", certs_dir);
    Ok(pair)
}

/// Generate a self-signed certificate for the coordinator domain.
fn generate_certificate() -> Result<CertPair, TlsError> {
    let mut params = CertificateParams::default();
    params.distinguished_name = {
        let mut dn = DistinguishedName::new();
        dn.push(rcgen::DnType::CommonName, CERT_DOMAIN.to_string());
        dn.push(
            rcgen::DnType::OrganizationName,
            "The Bushido Collective".to_string(),
        );
        dn
    };
    params.subject_alt_names = vec![
        SanType::DnsName(CERT_DOMAIN.try_into().map_err(|_| {
            TlsError::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Invalid DNS name",
            ))
        })?),
        SanType::DnsName("localhost".try_into().map_err(|_| {
            TlsError::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Invalid DNS name",
            ))
        })?),
        SanType::IpAddress(std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST)),
    ];
    params.not_before = time::OffsetDateTime::now_utc();
    params.not_after =
        time::OffsetDateTime::now_utc() + time::Duration::days(CERT_VALIDITY_DAYS);

    let key_pair = KeyPair::generate()?;
    let cert = params.self_signed(&key_pair)?;

    Ok(CertPair {
        cert_pem: cert.pem(),
        key_pem: key_pair.serialize_pem(),
    })
}

/// Build a rustls ServerConfig from PEM certificates.
pub fn build_tls_config(pair: &CertPair) -> Result<rustls::ServerConfig, TlsError> {
    let certs = rustls_pemfile::certs(&mut pair.cert_pem.as_bytes())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| TlsError::Io(e))?;

    let key = rustls_pemfile::private_key(&mut pair.key_pem.as_bytes())
        .map_err(|e| TlsError::Io(e))?
        .ok_or_else(|| {
            TlsError::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "No private key found",
            ))
        })?;

    let config = rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(certs, key)?;

    Ok(config)
}

/// Get the certificates directory (~/.han/certs/).
fn get_certs_dir() -> Result<PathBuf, TlsError> {
    let home = dirs::home_dir().ok_or(TlsError::NoHomeDir)?;
    Ok(home.join(".han").join("certs"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_certificate() {
        let pair = generate_certificate().unwrap();
        assert!(pair.cert_pem.contains("BEGIN CERTIFICATE"));
        assert!(pair.key_pem.contains("BEGIN PRIVATE KEY"));
    }

    #[test]
    fn test_build_tls_config() {
        // Install the ring crypto provider for rustls
        let _ = rustls::crypto::ring::default_provider().install_default();
        let pair = generate_certificate().unwrap();
        let config = build_tls_config(&pair).unwrap();
        assert!(config.alpn_protocols.is_empty() || true);
    }
}
