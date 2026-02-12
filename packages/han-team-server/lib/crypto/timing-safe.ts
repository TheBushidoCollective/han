/**
 * Timing-Safe Comparison Utilities
 *
 * Provides constant-time comparison to prevent timing attacks.
 * These attacks measure response time to deduce information about secrets.
 */

/**
 * Compares two byte arrays in constant time
 *
 * This prevents timing attacks where an attacker could measure
 * how long a comparison takes to deduce how many bytes match.
 *
 * @param a - First byte array
 * @param b - Second byte array
 * @returns true if arrays are equal, false otherwise
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    // Still do a dummy comparison to maintain constant time
    // even when lengths differ (prevents length oracle)
    const dummy = new Uint8Array(Math.max(a.length, b.length));
    timingSafeCompare(dummy, dummy);
    return false;
  }

  return timingSafeCompare(a, b);
}

/**
 * Internal constant-time comparison of equal-length arrays
 */
function timingSafeCompare(a: Uint8Array, b: Uint8Array): boolean {
  let result = 0;

  for (let i = 0; i < a.length; i++) {
    // XOR accumulates differences without short-circuiting
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

/**
 * Compares two strings in constant time
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal, false otherwise
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  return timingSafeEqual(encoder.encode(a), encoder.encode(b));
}

/**
 * Compares a hash/HMAC in constant time
 *
 * This should be used when verifying HMACs or hash digests
 * to prevent timing attacks.
 *
 * @param expected - Expected hash value
 * @param actual - Actual computed hash value
 * @returns true if hashes match, false otherwise
 */
export function verifyHash(expected: Uint8Array, actual: Uint8Array): boolean {
  return timingSafeEqual(expected, actual);
}
