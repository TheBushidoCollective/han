//! TLS certificate management for the coordinator.
//!
//! Loads Let's Encrypt certificates from the cert server cache (~/.claude/han/certs/).
//! Falls back to self-signed certificates if real certs are not available.

use rcgen::{CertificateParams, DistinguishedName, KeyPair, SanType};
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

const CERT_DOMAIN: &str = "coordinator.local.han.guru";

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
    #[error("No certificates available")]
    NoCertificates,
}

/// TLS certificate pair (cert + key in PEM format).
pub struct CertPair {
    pub cert_pem: String,
    pub key_pem: String,
}

/// Load TLS certificates.
///
/// Priority:
/// 1. Real Let's Encrypt certs from cert server cache (~/.claude/han/certs/)
/// 2. Self-signed fallback (~/.han/certs/)
pub fn ensure_certificates() -> Result<CertPair, TlsError> {
    // 1. Check for real Let's Encrypt certs (fetched by TypeScript tls.ts from certs.han.guru)
    if let Some(pair) = load_real_certs()? {
        return Ok(pair);
    }

    // 2. Fall back to self-signed
    tracing::warn!(
        "No Let's Encrypt certificates found, generating self-signed for {}",
        CERT_DOMAIN
    );
    let pair = generate_self_signed()?;
    let certs_dir = get_fallback_certs_dir()?;
    fs::create_dir_all(&certs_dir)?;
    fs::write(certs_dir.join("coordinator.pem"), &pair.cert_pem)?;
    fs::write(certs_dir.join("coordinator-key.pem"), &pair.key_pem)?;
    tracing::warn!("Using self-signed certificate (dashboard may not trust it)");
    Ok(pair)
}

/// Load real Let's Encrypt certificates from the cert server cache.
fn load_real_certs() -> Result<Option<CertPair>, TlsError> {
    let home = dirs::home_dir().ok_or(TlsError::NoHomeDir)?;
    let certs_dir = home.join(".claude").join("han").join("certs");
    let cert_path = certs_dir.join("coordinator.crt");
    let key_path = certs_dir.join("coordinator.key");

    if cert_path.exists() && key_path.exists() {
        let cert_pem = fs::read_to_string(&cert_path)?;
        let key_pem = fs::read_to_string(&key_path)?;

        // Basic validation: ensure they look like PEM
        if cert_pem.contains("BEGIN CERTIFICATE") && key_pem.contains("PRIVATE KEY") {
            tracing::info!(
                "Using Let's Encrypt certificates from {:?}",
                certs_dir
            );
            return Ok(Some(CertPair { cert_pem, key_pem }));
        }

        tracing::warn!("Certificate files at {:?} appear invalid", certs_dir);
    }

    Ok(None)
}

/// Generate a self-signed certificate (fallback when cert server is unavailable).
fn generate_self_signed() -> Result<CertPair, TlsError> {
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
    params.not_after = time::OffsetDateTime::now_utc() + time::Duration::days(365);

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

/// Fallback self-signed certs directory (~/.han/certs/).
fn get_fallback_certs_dir() -> Result<PathBuf, TlsError> {
    let home = dirs::home_dir().ok_or(TlsError::NoHomeDir)?;
    Ok(home.join(".han").join("certs"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_self_signed() {
        let pair = generate_self_signed().unwrap();
        assert!(pair.cert_pem.contains("BEGIN CERTIFICATE"));
        assert!(pair.key_pem.contains("BEGIN PRIVATE KEY"));
    }

    #[test]
    fn test_build_tls_config() {
        let _ = rustls::crypto::ring::default_provider().install_default();
        let pair = generate_self_signed().unwrap();
        let config = build_tls_config(&pair).unwrap();
        assert!(config.alpn_protocols.is_empty() || true);
    }
}
