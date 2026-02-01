/**
 * Secret Detection Patterns
 *
 * Regex patterns for detecting various types of secrets and credentials.
 */

export interface SecretPattern {
  /** Pattern name for identification */
  name: string;
  /** Detection type category */
  type: DetectionType;
  /** Regex pattern for matching */
  pattern: RegExp;
  /** Optional context validator to reduce false positives */
  contextValidator?: (match: string, context: string) => boolean;
  /** Description of what this pattern detects */
  description: string;
}

export type DetectionType =
  | "api_key"
  | "password"
  | "token"
  | "private_key"
  | "connection_string"
  | "high_entropy";

/**
 * AWS Access Key ID pattern
 * Format: AKIA followed by 16 alphanumeric characters
 */
const AWS_ACCESS_KEY: SecretPattern = {
  name: "aws_access_key",
  type: "api_key",
  pattern: /AKIA[0-9A-Z]{16}/g,
  description: "AWS Access Key ID",
};

/**
 * AWS Secret Access Key pattern
 * 40 character base64-like string, requires context
 */
const AWS_SECRET_KEY: SecretPattern = {
  name: "aws_secret_key",
  type: "api_key",
  pattern: /(?:aws[_-]?secret|secret[_-]?access[_-]?key)['":\s=]*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
  description: "AWS Secret Access Key",
};

/**
 * GitHub Personal Access Token (classic)
 * Format: ghp_ followed by 36 alphanumeric characters
 */
const GITHUB_PAT: SecretPattern = {
  name: "github_pat",
  type: "token",
  pattern: /ghp_[A-Za-z0-9]{36}/g,
  description: "GitHub Personal Access Token",
};

/**
 * GitHub Server-to-Server Token
 * Format: ghs_ followed by 36 alphanumeric characters
 */
const GITHUB_SERVER_TOKEN: SecretPattern = {
  name: "github_server_token",
  type: "token",
  pattern: /ghs_[A-Za-z0-9]{36}/g,
  description: "GitHub Server-to-Server Token",
};

/**
 * GitHub OAuth Access Token
 * Format: gho_ followed by 36 alphanumeric characters
 */
const GITHUB_OAUTH: SecretPattern = {
  name: "github_oauth",
  type: "token",
  pattern: /gho_[A-Za-z0-9]{36}/g,
  description: "GitHub OAuth Access Token",
};

/**
 * GitHub App User Access Token
 * Format: ghu_ followed by 36 alphanumeric characters
 */
const GITHUB_USER_TOKEN: SecretPattern = {
  name: "github_user_token",
  type: "token",
  pattern: /ghu_[A-Za-z0-9]{36}/g,
  description: "GitHub User Access Token",
};

/**
 * GitHub App Refresh Token
 * Format: ghr_ followed by 36+ alphanumeric characters
 */
const GITHUB_REFRESH_TOKEN: SecretPattern = {
  name: "github_refresh_token",
  type: "token",
  pattern: /ghr_[A-Za-z0-9]{36,}/g,
  description: "GitHub Refresh Token",
};

/**
 * GitHub Fine-Grained Personal Access Token
 * Format: github_pat_ followed by 22+ alphanumeric/underscore characters
 * See: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-fine-grained-personal-access-token
 */
const GITHUB_FINE_GRAINED_PAT: SecretPattern = {
  name: "github_fine_grained_pat",
  type: "token",
  pattern: /github_pat_[A-Za-z0-9_]{22,}/g,
  description: "GitHub Fine-Grained Personal Access Token",
};

/**
 * Stripe Live Secret Key
 * Format: sk_live_ followed by 24+ alphanumeric characters
 */
const STRIPE_LIVE_KEY: SecretPattern = {
  name: "stripe_live_key",
  type: "api_key",
  pattern: /sk_live_[A-Za-z0-9]{24,}/g,
  description: "Stripe Live Secret Key",
};

/**
 * Stripe Test Secret Key
 * Format: sk_test_ followed by 24+ alphanumeric characters
 */
const STRIPE_TEST_KEY: SecretPattern = {
  name: "stripe_test_key",
  type: "api_key",
  pattern: /sk_test_[A-Za-z0-9]{24,}/g,
  description: "Stripe Test Secret Key",
};

/**
 * Stripe Restricted Key
 * Format: rk_live_ or rk_test_ followed by 24+ alphanumeric characters
 */
const STRIPE_RESTRICTED_KEY: SecretPattern = {
  name: "stripe_restricted_key",
  type: "api_key",
  pattern: /rk_(?:live|test)_[A-Za-z0-9]{24,}/g,
  description: "Stripe Restricted Key",
};

/**
 * Generic API Key assignment
 * Matches patterns like: apiKey = "secret123", api_key: 'abc123'
 */
const GENERIC_API_KEY: SecretPattern = {
  name: "generic_api_key",
  type: "api_key",
  pattern:
    /['"]?(?:api[_-]?key|apikey|api[_-]?secret|secret[_-]?key)['"]?\s*[:=]\s*['"]([a-zA-Z0-9_\-]{20,})['"]/gi,
  description: "Generic API Key",
};

/**
 * Generic Password assignment
 * Matches patterns like: password = "secret123", passwd: 'abc123'
 *
 * NOTE: Fixed ReDoS vulnerability - original pattern [^'"]{8,} could cause
 * catastrophic backtracking. Now uses possessive-like quantifier with explicit
 * character class and length limit to prevent backtracking attacks.
 */
const GENERIC_PASSWORD: SecretPattern = {
  name: "generic_password",
  type: "password",
  // Fixed pattern: Uses explicit allowed chars with bounded length to prevent ReDoS
  // Maximum 256 chars to limit worst-case matching time
  pattern:
    /['"]?(?:password|passwd|pwd|pass)['"]?\s*[:=]\s*['"]([^\s'"]{8,256})['"]/gi,
  contextValidator: (match: string) => {
    // Skip if it looks like a placeholder
    const placeholders = [
      "password",
      "changeme",
      "example",
      "your_password",
      "xxx",
      "***",
    ];
    return !placeholders.some((p) => match.toLowerCase().includes(p));
  },
  description: "Generic Password",
};

/**
 * Private Key header
 * Matches RSA, EC, and OpenSSH private key headers
 */
const PRIVATE_KEY_HEADER: SecretPattern = {
  name: "private_key",
  type: "private_key",
  pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  description: "Private Key",
};

/**
 * Database connection string
 * Matches PostgreSQL, MySQL, MongoDB, Redis URLs with credentials
 */
const CONNECTION_STRING: SecretPattern = {
  name: "connection_string",
  type: "connection_string",
  pattern:
    /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^:]+:[^@]+@[^\s'"]+/gi,
  description: "Database Connection String",
};

/**
 * JWT Bearer Token
 * Matches Bearer tokens in JWT format
 */
const BEARER_JWT: SecretPattern = {
  name: "bearer_jwt",
  type: "token",
  pattern: /Bearer\s+([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)/g,
  description: "JWT Bearer Token",
};

/**
 * Slack Bot Token
 * Format: xoxb- followed by token segments
 */
const SLACK_BOT_TOKEN: SecretPattern = {
  name: "slack_bot_token",
  type: "token",
  pattern: /xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g,
  description: "Slack Bot Token",
};

/**
 * Slack User Token
 * Format: xoxp- followed by token segments
 */
const SLACK_USER_TOKEN: SecretPattern = {
  name: "slack_user_token",
  type: "token",
  pattern: /xoxp-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[a-f0-9]{32}/g,
  description: "Slack User Token",
};

/**
 * Slack Webhook URL
 */
const SLACK_WEBHOOK: SecretPattern = {
  name: "slack_webhook",
  type: "api_key",
  pattern:
    /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[a-zA-Z0-9]{24}/g,
  description: "Slack Webhook URL",
};

/**
 * Discord Bot Token
 */
const DISCORD_BOT_TOKEN: SecretPattern = {
  name: "discord_bot_token",
  type: "token",
  pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}/g,
  description: "Discord Bot Token",
};

/**
 * Discord Webhook URL
 */
const DISCORD_WEBHOOK: SecretPattern = {
  name: "discord_webhook",
  type: "api_key",
  pattern:
    /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_-]+/g,
  description: "Discord Webhook URL",
};

/**
 * NPM Auth Token
 */
const NPM_TOKEN: SecretPattern = {
  name: "npm_token",
  type: "token",
  pattern: /npm_[A-Za-z0-9]{36}/g,
  description: "NPM Auth Token",
};

/**
 * PyPI API Token
 */
const PYPI_TOKEN: SecretPattern = {
  name: "pypi_token",
  type: "token",
  pattern: /pypi-[A-Za-z0-9_-]{50,}/g,
  description: "PyPI API Token",
};

/**
 * Anthropic API Key
 */
const ANTHROPIC_API_KEY: SecretPattern = {
  name: "anthropic_api_key",
  type: "api_key",
  pattern: /sk-ant-api03-[A-Za-z0-9_-]{93}/g,
  description: "Anthropic API Key",
};

/**
 * OpenAI API Key
 */
const OPENAI_API_KEY: SecretPattern = {
  name: "openai_api_key",
  type: "api_key",
  pattern: /sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}/g,
  description: "OpenAI API Key",
};

/**
 * OpenAI Project API Key
 */
const OPENAI_PROJECT_KEY: SecretPattern = {
  name: "openai_project_key",
  type: "api_key",
  pattern: /sk-proj-[A-Za-z0-9_-]{48,}/g,
  description: "OpenAI Project API Key",
};

/**
 * Google API Key
 */
const GOOGLE_API_KEY: SecretPattern = {
  name: "google_api_key",
  type: "api_key",
  pattern: /AIza[0-9A-Za-z_-]{35}/g,
  description: "Google API Key",
};

/**
 * Twilio Account SID
 */
const TWILIO_ACCOUNT_SID: SecretPattern = {
  name: "twilio_account_sid",
  type: "api_key",
  pattern: /AC[a-f0-9]{32}/g,
  description: "Twilio Account SID",
};

/**
 * Twilio Auth Token
 */
const TWILIO_AUTH_TOKEN: SecretPattern = {
  name: "twilio_auth_token",
  type: "token",
  pattern: /(?:twilio[_-]?auth[_-]?token|auth[_-]?token)['":\s]*['"]?([a-f0-9]{32})['"]?/gi,
  description: "Twilio Auth Token",
};

/**
 * SendGrid API Key
 */
const SENDGRID_API_KEY: SecretPattern = {
  name: "sendgrid_api_key",
  type: "api_key",
  pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g,
  description: "SendGrid API Key",
};

/**
 * Mailgun API Key
 */
const MAILGUN_API_KEY: SecretPattern = {
  name: "mailgun_api_key",
  type: "api_key",
  pattern: /key-[0-9a-f]{32}/g,
  description: "Mailgun API Key",
};

/**
 * Heroku API Key
 */
const HEROKU_API_KEY: SecretPattern = {
  name: "heroku_api_key",
  type: "api_key",
  pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
  contextValidator: (match: string, context: string) => {
    // Only match if in heroku context (to avoid matching regular UUIDs)
    return /heroku/i.test(context);
  },
  description: "Heroku API Key",
};

/**
 * DigitalOcean Token
 */
const DIGITALOCEAN_TOKEN: SecretPattern = {
  name: "digitalocean_token",
  type: "token",
  pattern: /dop_v1_[a-f0-9]{64}/g,
  description: "DigitalOcean Personal Access Token",
};

/**
 * Cloudflare API Token
 */
const CLOUDFLARE_API_TOKEN: SecretPattern = {
  name: "cloudflare_api_token",
  type: "token",
  pattern: /[A-Za-z0-9_-]{40}/g,
  contextValidator: (match: string, context: string) => {
    // Only match if in cloudflare context
    return /cloudflare|cf[_-]?api/i.test(context);
  },
  description: "Cloudflare API Token",
};

/**
 * Datadog API Key
 */
const DATADOG_API_KEY: SecretPattern = {
  name: "datadog_api_key",
  type: "api_key",
  pattern: /(?:dd|datadog)[_-]?api[_-]?key['":\s]*['"]?([a-f0-9]{32})['"]?/gi,
  description: "Datadog API Key",
};

/**
 * All secret patterns grouped for easy iteration
 */
export const SECRET_PATTERNS: SecretPattern[] = [
  // AWS
  AWS_ACCESS_KEY,
  AWS_SECRET_KEY,
  // GitHub
  GITHUB_PAT,
  GITHUB_FINE_GRAINED_PAT,
  GITHUB_SERVER_TOKEN,
  GITHUB_OAUTH,
  GITHUB_USER_TOKEN,
  GITHUB_REFRESH_TOKEN,
  // Stripe
  STRIPE_LIVE_KEY,
  STRIPE_TEST_KEY,
  STRIPE_RESTRICTED_KEY,
  // Generic
  GENERIC_API_KEY,
  GENERIC_PASSWORD,
  // Private Keys
  PRIVATE_KEY_HEADER,
  // Connection Strings
  CONNECTION_STRING,
  // JWT
  BEARER_JWT,
  // Slack
  SLACK_BOT_TOKEN,
  SLACK_USER_TOKEN,
  SLACK_WEBHOOK,
  // Discord
  DISCORD_BOT_TOKEN,
  DISCORD_WEBHOOK,
  // Package Managers
  NPM_TOKEN,
  PYPI_TOKEN,
  // AI Services
  ANTHROPIC_API_KEY,
  OPENAI_API_KEY,
  OPENAI_PROJECT_KEY,
  // Google
  GOOGLE_API_KEY,
  // Communication
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  SENDGRID_API_KEY,
  MAILGUN_API_KEY,
  // Cloud Providers
  HEROKU_API_KEY,
  DIGITALOCEAN_TOKEN,
  CLOUDFLARE_API_TOKEN,
  DATADOG_API_KEY,
];

/**
 * Patterns for known safe content that should be skipped
 */
export const SAFE_PATTERNS = {
  /** Standard UUID format */
  uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  /** SHA-1 hash (40 hex chars) */
  sha1: /\b[a-f0-9]{40}\b/gi,
  /** SHA-256 hash (64 hex chars) */
  sha256: /\b[a-f0-9]{64}\b/gi,
  /** SHA-512 hash (128 hex chars) */
  sha512: /\b[a-f0-9]{128}\b/gi,
  /** Base64 data URI (images, fonts, etc.) */
  dataUri: /data:[a-z]+\/[a-z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi,
  /** Git commit hash */
  gitCommit: /\b[a-f0-9]{7,40}\b/gi,
  /** Version strings */
  version: /v?\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?/gi,
  /** Package lock file hashes */
  integrityHash: /sha(?:256|384|512)-[A-Za-z0-9+/=]+/gi,
  /** Example/placeholder domains */
  exampleDomain: /example\.(?:com|org|net)/gi,
  /** Localhost URLs */
  localhost: /(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?/gi,
};

/**
 * Context keywords that indicate a hash rather than a secret
 */
export const HASH_CONTEXT_KEYWORDS = [
  "sha1",
  "sha256",
  "sha384",
  "sha512",
  "md5",
  "hash",
  "digest",
  "checksum",
  "fingerprint",
  "integrity",
  "commit",
  "revision",
  "etag",
];

/**
 * Context keywords that indicate example/test data
 */
export const EXAMPLE_CONTEXT_KEYWORDS = [
  "example",
  "sample",
  "test",
  "demo",
  "placeholder",
  "dummy",
  "fake",
  "mock",
  "fixture",
];
