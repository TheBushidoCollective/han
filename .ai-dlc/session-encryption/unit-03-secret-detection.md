---
status: completed
depends_on: []
branch: ai-dlc/session-encryption/03-secret-detection
discipline: backend
---

# unit-03-secret-detection

## Description

Implement secret detection service that scans content for API keys, passwords, tokens, and high-entropy strings before sync, with auto-redaction.

## Discipline

backend - This unit will be executed by backend-focused agents.

## Success Criteria

- [ ] `SecretDetector` class with `scan(content): DetectedSecret[]` method
- [ ] Pattern-based detection for common secret types (AWS, GitHub, Stripe, generic API keys)
- [ ] Entropy-based detection for high-entropy strings (>4.5 bits/char, min 20 chars)
- [ ] `redact(content, detections): string` replaces secrets with `[REDACTED:type]` markers
- [ ] Detection types: `api_key`, `password`, `token`, `private_key`, `connection_string`, `high_entropy`
- [ ] Configurable sensitivity levels (strict, standard, permissive)
- [ ] False positive reduction: skip known safe patterns (UUIDs, base64 images, hashes)
- [ ] Performance: <50ms for 100KB content
- [ ] Unit tests with real-world secret patterns (redacted versions)

## Notes

**Pattern library (examples):**
```typescript
const PATTERNS = {
  aws_access_key: /AKIA[0-9A-Z]{16}/g,
  aws_secret_key: /[A-Za-z0-9/+=]{40}/g,  // with context check
  github_token: /gh[ps]_[A-Za-z0-9]{36}/g,
  github_oauth: /gho_[A-Za-z0-9]{36}/g,
  stripe_key: /sk_live_[A-Za-z0-9]{24,}/g,
  generic_api_key: /['\"][a-zA-Z0-9_-]*(?:api[_-]?key|apikey|secret)['\"]?\s*[:=]\s*['\"][a-zA-Z0-9_\-]{20,}['\"]/gi,
  private_key: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  connection_string: /(?:postgres|mysql|redis|mongodb):\/\/[^\s]+:[^\s]+@[^\s]+/gi,
  bearer_token: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
};
```

**Entropy calculation:**
```typescript
function calculateEntropy(str: string): number {
  const freq = new Map<string, number>();
  for (const char of str) {
    freq.set(char, (freq.get(char) || 0) + 1);
  }
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}
```

**Safe patterns to skip:**
- UUIDs: `/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i`
- SHA hashes: `/[a-f0-9]{40,64}/` (when labeled as hash)
- Base64 encoded images/data URIs

**File structure:**
```
lib/
  security/
    secret-detector.ts     # Main detection service
    patterns.ts            # Regex patterns
    entropy.ts             # Entropy analysis
    redactor.ts            # Redaction logic
    index.ts               # Public exports
```
