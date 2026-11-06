//! Ephemeral TLS identity for one coordinator process.

use rcgen::{CertificateParams, KeyPair, SanType};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum TlsError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Certificate generation error: {0}")]
    Rcgen(#[from] rcgen::Error),
    #[error("Rustls error: {0}")]
    Rustls(#[from] rustls::Error),
}

pub struct CertPair {
    pub cert_pem: String,
    pub key_pem: String,
}

pub fn generate_identity() -> Result<CertPair, TlsError> {
    let mut params = CertificateParams::default();
    params.subject_alt_names = vec![SanType::IpAddress(std::net::Ipv4Addr::LOCALHOST.into())];
    params.not_before = time::OffsetDateTime::now_utc() - time::Duration::minutes(1);
    params.not_after = time::OffsetDateTime::now_utc() + time::Duration::days(1);
    let key = KeyPair::generate()?;
    let certificate = params.self_signed(&key)?;
    Ok(CertPair { cert_pem: certificate.pem(), key_pem: key.serialize_pem() })
}

pub fn build_tls_config(pair: &CertPair) -> Result<rustls::ServerConfig, TlsError> {
    let certs = rustls_pemfile::certs(&mut pair.cert_pem.as_bytes()).collect::<Result<Vec<_>, _>>()?;
    let key = rustls_pemfile::private_key(&mut pair.key_pem.as_bytes())?
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "No private key found"))?;
    let mut config = rustls::ServerConfig::builder().with_no_client_auth().with_single_cert(certs, key)?;
    config.alpn_protocols = vec![b"h2".to_vec(), b"http/1.1".to_vec()];
    Ok(config)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn identities_are_distinct() {
        let first = generate_identity().unwrap();
        let second = generate_identity().unwrap();
        assert_ne!(first.cert_pem, second.cert_pem);
        assert_ne!(first.key_pem, second.key_pem);
        assert!(first.cert_pem.contains("BEGIN CERTIFICATE"));
    }
}
