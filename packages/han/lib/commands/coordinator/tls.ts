/**
 * TLS Certificate Management
 *
 * Fetches and caches Let's Encrypt certificates from the certificate distribution server.
 * Provides automatic refresh when certificates are close to expiry.
 *
 * For 6-day certificates, implements hot-reload without server restart.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Server as HttpsServer } from "node:https";
import { join } from "node:path";
import { createLogger } from "../../logger.ts";

const log = createLogger("tls");

const CERT_DIR = join(process.env.HOME || "~", ".claude", "han", "certs");
const CERT_FILE = join(CERT_DIR, "coordinator.crt");
const KEY_FILE = join(CERT_DIR, "coordinator.key");
const CERT_METADATA = join(CERT_DIR, "metadata.json");
const CERT_FETCH_URL = "https://certs.han.guru/coordinator/latest";

// Refresh certificates when less than this many days until expiry
// For 6-day certificates (160 hours), refresh when < 2 days (48 hours) remaining
const CERT_REFRESH_THRESHOLD_DAYS = 2;

interface CertBundle {
	cert: string;
	key: string;
	expires: string;
	domain: string;
}

interface CertMetadata {
	expires: string;
	domain: string;
	fetchedAt: string;
}

export interface TLSCredentials {
	cert: string;
	key: string;
}

/**
 * Ensure TLS certificates are available and valid
 * Returns null if certificates cannot be fetched (graceful fallback to HTTP)
 */
export async function ensureCertificates(): Promise<TLSCredentials | null> {
	try {
		await mkdir(CERT_DIR, { recursive: true });

		// Check if we have valid cached certs
		if (existsSync(CERT_METADATA)) {
			const metadataContent = await readFile(CERT_METADATA, "utf-8");
			const metadata: CertMetadata = JSON.parse(metadataContent);
			const expiresAt = new Date(metadata.expires);
			const now = new Date();
			const daysUntilExpiry =
				(expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

			// Use cached cert if more than threshold days until expiry
			if (
				daysUntilExpiry > CERT_REFRESH_THRESHOLD_DAYS &&
				existsSync(CERT_FILE) &&
				existsSync(KEY_FILE)
			) {
				const cert = await readFile(CERT_FILE, "utf-8");
				const key = await readFile(KEY_FILE, "utf-8");
				log.info(
					`Using cached certificate (expires in ${Math.floor(daysUntilExpiry)} days)`,
				);
				return { cert, key };
			}

			log.info(
				`Certificate expires in ${Math.floor(daysUntilExpiry)} days, refreshing...`,
			);
		}

		// Fetch new certificates
		log.info(`Fetching certificates from ${CERT_FETCH_URL}...`);
		const response = await fetch(CERT_FETCH_URL);

		if (!response.ok) {
			log.warn(
				`Failed to fetch certificates (HTTP ${response.status}), falling back to HTTP mode`,
			);
			return null;
		}

		const bundle: CertBundle = await response.json();

		// Validate bundle structure
		if (!bundle.cert || !bundle.key || !bundle.expires || !bundle.domain) {
			log.warn(
				"Invalid certificate bundle received, falling back to HTTP mode",
			);
			return null;
		}

		// Cache certificates
		await writeFile(CERT_FILE, bundle.cert);
		await writeFile(KEY_FILE, bundle.key);
		await writeFile(
			CERT_METADATA,
			JSON.stringify({
				expires: bundle.expires,
				domain: bundle.domain,
				fetchedAt: new Date().toISOString(),
			} satisfies CertMetadata),
		);

		log.info(
			`Certificates fetched successfully for ${bundle.domain} (expires ${bundle.expires})`,
		);
		return { cert: bundle.cert, key: bundle.key };
	} catch (error) {
		log.warn(
			`Error fetching certificates, falling back to HTTP mode: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}

/**
 * Check if certificates need refresh and update server context if needed
 * Returns true if certificates were refreshed
 */
export async function checkAndRefreshCertificates(
	server?: HttpsServer,
): Promise<boolean> {
	try {
		// Check if we need to refresh
		if (!existsSync(CERT_METADATA)) {
			return false;
		}

		const metadataContent = await readFile(CERT_METADATA, "utf-8");
		const metadata: CertMetadata = JSON.parse(metadataContent);
		const expiresAt = new Date(metadata.expires);
		const now = new Date();
		const daysUntilExpiry =
			(expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

		// No refresh needed if more than threshold days until expiry
		if (daysUntilExpiry > CERT_REFRESH_THRESHOLD_DAYS) {
			return false;
		}

		log.info(
			`Certificate expires in ${Math.floor(daysUntilExpiry * 24)} hours, refreshing...`,
		);

		// Fetch new certificates
		const response = await fetch(CERT_FETCH_URL);

		if (!response.ok) {
			log.warn(
				`Failed to fetch certificates (HTTP ${response.status}), will retry later`,
			);
			return false;
		}

		const bundle: CertBundle = await response.json();

		// Validate bundle structure
		if (!bundle.cert || !bundle.key || !bundle.expires || !bundle.domain) {
			log.warn("Invalid certificate bundle received, will retry later");
			return false;
		}

		// Cache certificates
		await writeFile(CERT_FILE, bundle.cert);
		await writeFile(KEY_FILE, bundle.key);
		await writeFile(
			CERT_METADATA,
			JSON.stringify({
				expires: bundle.expires,
				domain: bundle.domain,
				fetchedAt: new Date().toISOString(),
			} satisfies CertMetadata),
		);

		log.info(
			`Certificates refreshed successfully for ${bundle.domain} (expires ${bundle.expires})`,
		);

		// Hot-reload TLS context on the running server (if provided)
		if (server && "setSecureContext" in server) {
			server.setSecureContext({
				cert: bundle.cert,
				key: bundle.key,
			});
			log.info("TLS context updated on running server (hot-reload successful)");
		}

		return true;
	} catch (error) {
		log.warn(
			`Error refreshing certificates: ${error instanceof Error ? error.message : String(error)}`,
		);
		return false;
	}
}
