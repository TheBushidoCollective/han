---
name: sip-authentication-security
description: Use when implementing SIP authentication, security mechanisms, and encryption. Use when securing SIP servers, clients, or proxies.
allowed-tools:
  - Bash
  - Read
---

# SIP Authentication and Security

Master SIP authentication mechanisms (HTTP Digest), TLS encryption, SIPS,
and security best practices for building secure VoIP applications.

## HTTP Digest Authentication

### Challenge-Response Flow

```
Client                                    Server
  |                                         |
  | REGISTER (no credentials)               |
  |---------------------------------------->|
  |                                         |
  |    401 Unauthorized                     |
  |    WWW-Authenticate: Digest             |
  |      realm="atlanta.com"                |
  |      nonce="dcd98b7102dd..."            |
  |      algorithm=MD5                      |
  |      qop="auth"                         |
  |<----------------------------------------|
  |                                         |
  | REGISTER (with Authorization)           |
  |    Authorization: Digest                |
  |      username="alice"                   |
  |      realm="atlanta.com"                |
  |      nonce="dcd98b7102dd..."            |
  |      uri="sip:atlanta.com"              |
  |      response="6629fae49393..."         |
  |      algorithm=MD5                      |
  |      qop=auth                           |
  |      nc=00000001                        |
  |      cnonce="0a4f113b"                  |
  |---------------------------------------->|
  |                                         |
  |    200 OK                               |
  |<----------------------------------------|
  |                                         |
```

### Digest Authentication Implementation

```typescript
import crypto from 'crypto';

interface DigestChallenge {
  realm: string;
  nonce: string;
  algorithm: 'MD5' | 'SHA-256';
  qop?: 'auth' | 'auth-int';
  opaque?: string;
  stale?: boolean;
}

interface DigestCredentials {
  username: string;
  realm: string;
  nonce: string;
  uri: string;
  response: string;
  algorithm: 'MD5' | 'SHA-256';
  cnonce?: string;
  nc?: string;
  qop?: string;
  opaque?: string;
}

class SipDigestAuth {
  // Generate authentication challenge (401/407 response)
  static generateChallenge(realm: string): DigestChallenge {
    return {
      realm,
      nonce: this.generateNonce(),
      algorithm: 'MD5',
      qop: 'auth',
      opaque: this.generateOpaque()
    };
  }

  // Create WWW-Authenticate or Proxy-Authenticate header
  static createChallengeHeader(challenge: DigestChallenge): string {
    let header = `Digest realm="${challenge.realm}", ` +
                 `nonce="${challenge.nonce}", ` +
                 `algorithm=${challenge.algorithm}`;

    if (challenge.qop) {
      header += `, qop="${challenge.qop}"`;
    }

    if (challenge.opaque) {
      header += `, opaque="${challenge.opaque}"`;
    }

    if (challenge.stale) {
      header += `, stale=TRUE`;
    }

    return header;
  }

  // Calculate response for authentication
  static calculateResponse(params: {
    username: string;
    password: string;
    realm: string;
    method: string;
    uri: string;
    nonce: string;
    algorithm?: 'MD5' | 'SHA-256';
    cnonce?: string;
    nc?: string;
    qop?: string;
    body?: string;
  }): string {
    const algorithm = params.algorithm || 'MD5';
    const hashFunc = algorithm === 'MD5' ? 'md5' : 'sha256';

    // Calculate A1 = MD5(username:realm:password)
    const a1 = this.hash(
      hashFunc,
      `${params.username}:${params.realm}:${params.password}`
    );

    // Calculate A2
    let a2: string;
    if (params.qop === 'auth-int') {
      // A2 = MD5(method:uri:MD5(body))
      const bodyHash = this.hash(hashFunc, params.body || '');
      a2 = this.hash(hashFunc, `${params.method}:${params.uri}:${bodyHash}`);
    } else {
      // A2 = MD5(method:uri)
      a2 = this.hash(hashFunc, `${params.method}:${params.uri}`);
    }

    // Calculate response
    let response: string;
    if (params.qop) {
      // response = MD5(A1:nonce:nc:cnonce:qop:A2)
      response = this.hash(
        hashFunc,
        `${a1}:${params.nonce}:${params.nc}:${params.cnonce}:${params.qop}:${a2}`
      );
    } else {
      // response = MD5(A1:nonce:A2)
      response = this.hash(hashFunc, `${a1}:${params.nonce}:${a2}`);
    }

    return response;
  }

  // Create Authorization or Proxy-Authorization header
  static createAuthorizationHeader(params: {
    username: string;
    password: string;
    realm: string;
    method: string;
    uri: string;
    nonce: string;
    algorithm?: 'MD5' | 'SHA-256';
    qop?: string;
    opaque?: string;
  }): string {
    const algorithm = params.algorithm || 'MD5';
    const cnonce = this.generateCnonce();
    const nc = '00000001';
    const qop = params.qop || 'auth';

    const response = this.calculateResponse({
      username: params.username,
      password: params.password,
      realm: params.realm,
      method: params.method,
      uri: params.uri,
      nonce: params.nonce,
      algorithm,
      cnonce,
      nc,
      qop
    });

    let header = `Digest username="${params.username}", ` +
                 `realm="${params.realm}", ` +
                 `nonce="${params.nonce}", ` +
                 `uri="${params.uri}", ` +
                 `response="${response}", ` +
                 `algorithm=${algorithm}`;

    if (qop) {
      header += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
    }

    if (params.opaque) {
      header += `, opaque="${params.opaque}"`;
    }

    return header;
  }

  // Verify client credentials
  static verifyCredentials(
    credentials: DigestCredentials,
    password: string,
    method: string
  ): boolean {
    const expectedResponse = this.calculateResponse({
      username: credentials.username,
      password,
      realm: credentials.realm,
      method,
      uri: credentials.uri,
      nonce: credentials.nonce,
      algorithm: credentials.algorithm,
      cnonce: credentials.cnonce,
      nc: credentials.nc,
      qop: credentials.qop
    });

    return credentials.response === expectedResponse;
  }

  // Parse Authorization/Proxy-Authorization header
  static parseAuthorizationHeader(header: string): DigestCredentials | null {
    if (!header.startsWith('Digest ')) {
      return null;
    }

    const params: any = {};
    const paramRegex = /(\w+)=(?:"([^"]+)"|([^,\s]+))/g;
    let match;

    while ((match = paramRegex.exec(header)) !== null) {
      const key = match[1];
      const value = match[2] || match[3];
      params[key] = value;
    }

    return {
      username: params.username,
      realm: params.realm,
      nonce: params.nonce,
      uri: params.uri,
      response: params.response,
      algorithm: params.algorithm || 'MD5',
      cnonce: params.cnonce,
      nc: params.nc,
      qop: params.qop,
      opaque: params.opaque
    };
  }

  private static hash(algorithm: string, data: string): string {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  private static generateNonce(): string {
    // Nonce = Base64(timestamp:ETag:private-key)
    const timestamp = Date.now();
    const etag = crypto.randomBytes(16).toString('hex');
    const privateKey = 'secret-server-key';
    const nonce = `${timestamp}:${etag}:${privateKey}`;
    return Buffer.from(nonce).toString('base64');
  }

  private static generateCnonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private static generateOpaque(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}
```

### Complete Authentication Example

```typescript
class SipAuthenticatedClient {
  private username: string;
  private password: string;
  private realm?: string;
  private nonce?: string;
  private opaque?: string;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  // Send REGISTER with authentication
  async register(server: string): Promise<void> {
    // First attempt without credentials
    let response = await this.sendRegister(server);

    if (response.statusCode === 401) {
      // Extract challenge from WWW-Authenticate header
      const challenge = this.parseChallenge(response.headers['www-authenticate']);

      if (!challenge) {
        throw new Error('Invalid authentication challenge');
      }

      this.realm = challenge.realm;
      this.nonce = challenge.nonce;
      this.opaque = challenge.opaque;

      // Send REGISTER with credentials
      response = await this.sendRegister(server, true);
    }

    if (response.statusCode === 200) {
      console.log('Registration successful');
    } else {
      throw new Error(`Registration failed: ${response.statusCode}`);
    }
  }

  private async sendRegister(
    server: string,
    withAuth: boolean = false
  ): Promise<any> {
    const uri = `sip:${server}`;
    const method = 'REGISTER';

    let message = `${method} ${uri} SIP/2.0\r
Via: SIP/2.0/UDP client.example.com;branch=z9hG4bK${this.generateBranch()}\r
Max-Forwards: 70\r
To: <sip:${this.username}@${server}>\r
From: <sip:${this.username}@${server}>;tag=${this.generateTag()}\r
Call-ID: ${this.generateCallId()}\r
CSeq: 1 REGISTER\r
Contact: <sip:${this.username}@client.example.com>\r
Expires: 3600\r
`;

    if (withAuth && this.realm && this.nonce) {
      const authHeader = SipDigestAuth.createAuthorizationHeader({
        username: this.username,
        password: this.password,
        realm: this.realm,
        method,
        uri,
        nonce: this.nonce,
        opaque: this.opaque
      });

      message += `Authorization: ${authHeader}\r\n`;
    }

    message += 'Content-Length: 0\r\n\r\n';

    // Send message and get response
    return this.send(message);
  }

  private parseChallenge(header: string): DigestChallenge | null {
    if (!header || !header.startsWith('Digest ')) {
      return null;
    }

    const params: any = {};
    const paramRegex = /(\w+)=(?:"([^"]+)"|([^,\s]+))/g;
    let match;

    while ((match = paramRegex.exec(header)) !== null) {
      const key = match[1];
      const value = match[2] || match[3];
      params[key] = value;
    }

    return {
      realm: params.realm,
      nonce: params.nonce,
      algorithm: params.algorithm || 'MD5',
      qop: params.qop,
      opaque: params.opaque
    };
  }

  private generateBranch(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateTag(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private generateCallId(): string {
    return `${crypto.randomBytes(16).toString('hex')}@client.example.com`;
  }

  private async send(message: string): Promise<any> {
    // Implementation depends on transport
    console.log('Sending:', message);
    return { statusCode: 401, headers: {} };
  }
}
```

## Server-Side Authentication

### Registration Server with Authentication

```typescript
interface UserCredentials {
  username: string;
  password: string;
  domain: string;
}

class SipRegistrar {
  private users: Map<string, UserCredentials> = new Map();
  private registrations: Map<string, Registration> = new Map();
  private nonces: Map<string, NonceInfo> = new Map();
  private realm: string;

  constructor(realm: string) {
    this.realm = realm;
  }

  // Add user to database
  addUser(username: string, password: string, domain: string): void {
    this.users.set(username, { username, password, domain });
  }

  // Handle REGISTER request
  handleRegister(request: SipRequest): SipResponse {
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      // No credentials, send challenge
      return this.sendChallenge();
    }

    // Parse credentials
    const credentials = SipDigestAuth.parseAuthorizationHeader(authHeader);
    if (!credentials) {
      return this.createResponse(400, 'Bad Request');
    }

    // Verify nonce
    const nonceInfo = this.nonces.get(credentials.nonce);
    if (!nonceInfo) {
      // Nonce expired or invalid, send new challenge
      return this.sendChallenge(true);
    }

    // Check nonce count to prevent replay attacks
    if (credentials.nc && parseInt(credentials.nc, 16) <= nonceInfo.nc) {
      return this.createResponse(401, 'Unauthorized');
    }

    // Get user password
    const user = this.users.get(credentials.username);
    if (!user) {
      return this.createResponse(403, 'Forbidden');
    }

    // Verify credentials
    const valid = SipDigestAuth.verifyCredentials(
      credentials,
      user.password,
      'REGISTER'
    );

    if (!valid) {
      return this.createResponse(403, 'Forbidden');
    }

    // Update nonce count
    if (credentials.nc) {
      nonceInfo.nc = parseInt(credentials.nc, 16);
    }

    // Register contact
    const contact = request.headers['contact'];
    const expires = parseInt(request.headers['expires'] || '3600');

    this.registerContact(credentials.username, contact, expires);

    return this.createResponse(200, 'OK');
  }

  private sendChallenge(stale: boolean = false): SipResponse {
    const challenge = SipDigestAuth.generateChallenge(this.realm);
    challenge.stale = stale;

    // Store nonce
    this.nonces.set(challenge.nonce, {
      nonce: challenge.nonce,
      timestamp: Date.now(),
      nc: 0
    });

    const response = this.createResponse(401, 'Unauthorized');
    response.headers['www-authenticate'] =
      SipDigestAuth.createChallengeHeader(challenge);

    return response;
  }

  private registerContact(
    username: string,
    contact: string,
    expires: number
  ): void {
    const registration: Registration = {
      username,
      contact,
      expires: Date.now() + expires * 1000
    };

    this.registrations.set(username, registration);

    // Set expiration timer
    setTimeout(() => {
      this.registrations.delete(username);
    }, expires * 1000);
  }

  private createResponse(statusCode: number, reason: string): SipResponse {
    return {
      version: 'SIP/2.0',
      statusCode,
      reasonPhrase: reason,
      headers: {} as any,
      body: undefined
    };
  }

  // Clean up expired nonces
  cleanupNonces(): void {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes

    for (const [nonce, info] of this.nonces.entries()) {
      if (now - info.timestamp > maxAge) {
        this.nonces.delete(nonce);
      }
    }
  }
}

interface Registration {
  username: string;
  contact: string;
  expires: number;
}

interface NonceInfo {
  nonce: string;
  timestamp: number;
  nc: number;
}

interface SipRequest {
  method: string;
  requestUri: string;
  version: string;
  headers: any;
  body?: string;
}

interface SipResponse {
  version: string;
  statusCode: number;
  reasonPhrase: string;
  headers: any;
  body?: string;
}
```

## TLS/SIPS Implementation

### Secure SIP (SIPS) Setup

```typescript
import tls from 'tls';
import fs from 'fs';

interface TlsConfig {
  cert: string;
  key: string;
  ca?: string;
  rejectUnauthorized?: boolean;
  minVersion?: string;
  ciphers?: string;
}

class SipTlsServer {
  private server: tls.Server;
  private config: TlsConfig;

  constructor(config: TlsConfig) {
    this.config = config;
    this.server = this.createServer();
  }

  private createServer(): tls.Server {
    const options: tls.TlsOptions = {
      cert: fs.readFileSync(this.config.cert),
      key: fs.readFileSync(this.config.key),
      // Require client certificate for mutual TLS
      requestCert: true,
      rejectUnauthorized: this.config.rejectUnauthorized !== false,
      // Use strong TLS version
      minVersion: (this.config.minVersion as any) || 'TLSv1.2',
      // Use secure cipher suites
      ciphers: this.config.ciphers || [
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'DHE-RSA-AES256-GCM-SHA384',
        'DHE-RSA-AES128-GCM-SHA256'
      ].join(':')
    };

    if (this.config.ca) {
      options.ca = fs.readFileSync(this.config.ca);
    }

    const server = tls.createServer(options, (socket) => {
      this.handleConnection(socket);
    });

    return server;
  }

  private handleConnection(socket: tls.TLSSocket): void {
    console.log('Secure connection established');

    // Verify client certificate
    if (socket.authorized) {
      console.log('Client certificate verified');
      const cert = socket.getPeerCertificate();
      console.log('Client CN:', cert.subject.CN);
    } else {
      console.log('Client certificate not authorized:', socket.authorizationError);
      socket.destroy();
      return;
    }

    socket.on('data', (data) => {
      this.handleData(socket, data);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    socket.on('close', () => {
      console.log('Connection closed');
    });
  }

  private handleData(socket: tls.TLSSocket, data: Buffer): void {
    const message = data.toString();
    console.log('Received:', message);

    // Process SIP message
    // Send response
  }

  listen(port: number, host: string = '0.0.0.0'): void {
    this.server.listen(port, host, () => {
      console.log(`SIP TLS server listening on ${host}:${port}`);
    });
  }

  close(): void {
    this.server.close();
  }
}

class SipTlsClient {
  private config: TlsConfig;

  constructor(config: TlsConfig) {
    this.config = config;
  }

  connect(host: string, port: number): Promise<tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      const options: tls.ConnectionOptions = {
        host,
        port,
        cert: fs.readFileSync(this.config.cert),
        key: fs.readFileSync(this.config.key),
        rejectUnauthorized: this.config.rejectUnauthorized !== false,
        minVersion: (this.config.minVersion as any) || 'TLSv1.2',
        ciphers: this.config.ciphers
      };

      if (this.config.ca) {
        options.ca = fs.readFileSync(this.config.ca);
      }

      const socket = tls.connect(options, () => {
        if (socket.authorized) {
          console.log('Connected to server, certificate verified');
          resolve(socket);
        } else {
          console.error('Certificate verification failed:', socket.authorizationError);
          socket.destroy();
          reject(new Error('Certificate verification failed'));
        }
      });

      socket.on('error', (error) => {
        reject(error);
      });
    });
  }

  async send(host: string, port: number, message: string): Promise<void> {
    const socket = await this.connect(host, port);

    socket.write(message);

    socket.on('data', (data) => {
      console.log('Received:', data.toString());
    });
  }
}

// Usage example
const serverConfig: TlsConfig = {
  cert: '/path/to/server-cert.pem',
  key: '/path/to/server-key.pem',
  ca: '/path/to/ca-cert.pem',
  rejectUnauthorized: true
};

const server = new SipTlsServer(serverConfig);
server.listen(5061);

const clientConfig: TlsConfig = {
  cert: '/path/to/client-cert.pem',
  key: '/path/to/client-key.pem',
  ca: '/path/to/ca-cert.pem'
};

const client = new SipTlsClient(clientConfig);
```

## SRTP and Media Security

### SRTP Key Exchange in SDP

```
v=0
o=alice 2890844526 2890844526 IN IP4 pc33.atlanta.com
s=Secure Session
c=IN IP4 pc33.atlanta.com
t=0 0
m=audio 49170 RTP/SAVP 0
a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:PS1uQCVeeCFCanVmcjkpPywjNWhcYD0mXXtxaVBR|2^20|1:32
a=crypto:2 AES_CM_128_HMAC_SHA1_32 inline:PS1uQCVeeCFCanVmcjkpPywjNWhcYD0mXXtxaVBR|2^20|1:32
a=rtpmap:0 PCMU/8000
```

### SRTP Implementation

```typescript
import crypto from 'crypto';

interface SrtpParams {
  cryptoSuite: string;
  keyParams: string;
  sessionParams?: string;
}

class SrtpCrypto {
  // Parse crypto attribute from SDP
  static parseCryptoAttribute(attr: string): SrtpParams | null {
    // a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:base64key|lifetime|mkiValue
    const match = attr.match(
      /crypto:(\d+)\s+([^\s]+)\s+inline:([^\s|]+)(?:\|([^\s|]+))?(?:\|([^\s]+))?/
    );

    if (!match) {
      return null;
    }

    const [, tag, cryptoSuite, keyParams, lifetime, mki] = match;

    return {
      cryptoSuite,
      keyParams,
      sessionParams: lifetime
    };
  }

  // Generate crypto attribute for SDP
  static generateCryptoAttribute(tag: number = 1): string {
    const cryptoSuite = 'AES_CM_128_HMAC_SHA1_80';
    const masterKey = crypto.randomBytes(16); // 128 bits
    const masterSalt = crypto.randomBytes(14); // 112 bits

    // Concatenate key and salt
    const keyMaterial = Buffer.concat([masterKey, masterSalt]);
    const keyParams = keyMaterial.toString('base64');

    // Session parameters
    const lifetime = '2^20'; // 2^20 packets
    const mki = '1:32';      // MKI value:length

    return `crypto:${tag} ${cryptoSuite} inline:${keyParams}|${lifetime}|${mki}`;
  }

  // Derive session keys from master key
  static deriveSessionKeys(
    masterKey: Buffer,
    masterSalt: Buffer,
    index: number
  ): {
    encryptionKey: Buffer;
    authKey: Buffer;
    saltingKey: Buffer;
  } {
    // Key derivation according to RFC 3711
    const kdr = 0; // Key derivation rate (0 = never rekeyed)

    // Calculate key_id
    const r = index / (2 ** kdr);

    // Derive encryption key
    const encryptionKey = this.deriveKey(masterKey, masterSalt, 0x00, r);

    // Derive authentication key
    const authKey = this.deriveKey(masterKey, masterSalt, 0x01, r);

    // Derive salting key
    const saltingKey = this.deriveKey(masterKey, masterSalt, 0x02, r);

    return { encryptionKey, authKey, saltingKey };
  }

  private static deriveKey(
    masterKey: Buffer,
    masterSalt: Buffer,
    label: number,
    index: number
  ): Buffer {
    // PRF(masterKey, (masterSalt XOR (label || index)))
    // Simplified implementation
    const iv = Buffer.alloc(16);
    masterSalt.copy(iv);
    iv[7] ^= label;

    const cipher = crypto.createCipheriv('aes-128-cbc', masterKey, iv);
    const key = cipher.update(Buffer.alloc(16));

    return key;
  }

  // Encrypt RTP packet
  static encryptRtp(
    packet: Buffer,
    encryptionKey: Buffer,
    saltingKey: Buffer,
    ssrc: number,
    sequenceNumber: number
  ): Buffer {
    // Extract RTP header (first 12 bytes)
    const header = packet.slice(0, 12);

    // Extract payload
    const payload = packet.slice(12);

    // Generate IV from salting key and packet index
    const iv = this.generateIv(saltingKey, ssrc, sequenceNumber);

    // Encrypt payload
    const cipher = crypto.createCipheriv('aes-128-ctr', encryptionKey, iv);
    const encryptedPayload = Buffer.concat([
      cipher.update(payload),
      cipher.final()
    ]);

    // Concatenate header and encrypted payload
    return Buffer.concat([header, encryptedPayload]);
  }

  // Generate authentication tag
  static generateAuthTag(
    packet: Buffer,
    authKey: Buffer
  ): Buffer {
    const hmac = crypto.createHmac('sha1', authKey);
    hmac.update(packet);
    const tag = hmac.digest();

    // Use first 10 bytes for AES_CM_128_HMAC_SHA1_80
    return tag.slice(0, 10);
  }

  private static generateIv(
    saltingKey: Buffer,
    ssrc: number,
    sequenceNumber: number
  ): Buffer {
    const iv = Buffer.alloc(16);

    // Copy salting key
    saltingKey.copy(iv);

    // XOR with SSRC
    iv.writeUInt32BE(iv.readUInt32BE(4) ^ ssrc, 4);

    // XOR with sequence number
    iv.writeUInt16BE(iv.readUInt16BE(14) ^ sequenceNumber, 14);

    return iv;
  }
}
```

## Security Best Practices

### Input Validation and Sanitization

```typescript
class SipSecurityValidator {
  // Validate SIP URI to prevent injection attacks
  static validateUri(uri: string): boolean {
    // Check for valid SIP URI format
    const sipUriRegex = /^sips?:[a-zA-Z0-9_.+-]+@[a-zA-Z0-9.-]+$/;

    if (!sipUriRegex.test(uri)) {
      return false;
    }

    // Check for dangerous characters
    const dangerousChars = ['<', '>', '"', "'", ';', '&', '|', '`'];
    for (const char of dangerousChars) {
      if (uri.includes(char)) {
        return false;
      }
    }

    return true;
  }

  // Validate header values
  static validateHeader(name: string, value: string): boolean {
    // Check for CRLF injection
    if (value.includes('\r') || value.includes('\n')) {
      return false;
    }

    // Validate specific headers
    switch (name.toLowerCase()) {
      case 'content-length':
        return /^\d+$/.test(value);

      case 'max-forwards':
        const maxForwards = parseInt(value);
        return !isNaN(maxForwards) && maxForwards >= 0 && maxForwards <= 70;

      case 'cseq':
        return /^\d+\s+[A-Z]+$/.test(value);

      default:
        return true;
    }
  }

  // Validate SDP to prevent injection
  static validateSdp(sdp: string): boolean {
    const lines = sdp.split('\n');

    for (const line of lines) {
      // Each line should be type=value
      if (!line.match(/^[a-z]=.+$/)) {
        return false;
      }

      // Check for dangerous content
      if (line.includes('<script>') || line.includes('javascript:')) {
        return false;
      }
    }

    return true;
  }

  // Rate limiting to prevent DoS
  static checkRateLimit(
    source: string,
    maxRequests: number = 10,
    windowMs: number = 1000
  ): boolean {
    const now = Date.now();
    const requests = this.requestCounts.get(source) || { count: 0, resetTime: now + windowMs };

    if (now > requests.resetTime) {
      // Reset window
      requests.count = 1;
      requests.resetTime = now + windowMs;
      this.requestCounts.set(source, requests);
      return true;
    }

    if (requests.count >= maxRequests) {
      return false;
    }

    requests.count++;
    this.requestCounts.set(source, requests);
    return true;
  }

  private static requestCounts = new Map<string, { count: number; resetTime: number }>();
}
```

### Anti-Spoofing Measures

```typescript
class SipAntiSpoofing {
  // Validate Via header to detect spoofing
  static validateVia(via: string, sourceIp: string, sourcePort: number): boolean {
    // Parse Via header
    const match = via.match(/SIP\/2.0\/(\w+)\s+([^;:]+)(?::(\d+))?/);

    if (!match) {
      return false;
    }

    const [, transport, host, port] = match;

    // Check if received parameter matches source
    const receivedMatch = via.match(/;received=([^;]+)/);
    if (receivedMatch) {
      const received = receivedMatch[1];
      if (received !== sourceIp) {
        console.warn('Via received parameter mismatch:', received, 'vs', sourceIp);
        return false;
      }
    }

    // Check if rport parameter matches source port
    const rportMatch = via.match(/;rport(?:=(\d+))?/);
    if (rportMatch && rportMatch[1]) {
      const rport = parseInt(rportMatch[1]);
      if (rport !== sourcePort) {
        console.warn('Via rport parameter mismatch:', rport, 'vs', sourcePort);
        return false;
      }
    }

    return true;
  }

  // Add received and rport parameters to Via
  static addReceivedRport(via: string, sourceIp: string, sourcePort: number): string {
    let result = via;

    // Add received parameter if not present
    if (!via.includes('received=')) {
      result += `;received=${sourceIp}`;
    }

    // Add rport parameter value
    if (via.includes('rport') && !via.includes('rport=')) {
      result = result.replace(/rport/, `rport=${sourcePort}`);
    } else if (!via.includes('rport')) {
      result += `;rport=${sourcePort}`;
    }

    return result;
  }
}
```

## When to Use This Skill

Use sip-authentication-security when building applications that require:

- User authentication and authorization
- Secure SIP communications (SIPS/TLS)
- Protected media streams (SRTP)
- Registration with authentication
- Proxy authentication
- Certificate-based authentication
- Protection against replay attacks
- Defense against SIP-specific threats
- Compliance with security standards
- Enterprise VoIP security

## Best Practices

1. **Always use digest authentication** - Never send passwords in plaintext
2. **Implement nonce expiration** - Prevent replay attacks with time-limited nonces
3. **Use strong hash algorithms** - Prefer SHA-256 over MD5 when possible
4. **Validate nonce count (nc)** - Detect replay attacks within nonce lifetime
5. **Generate cryptographically random values** - Use crypto.randomBytes() for nonces, tags
6. **Use TLS for signaling** - Encrypt SIP messages with TLS (SIPS)
7. **Use SRTP for media** - Encrypt RTP streams with SRTP
8. **Implement mutual TLS** - Require client certificates for server authentication
9. **Validate all inputs** - Sanitize URIs, headers, and SDP content
10. **Add received/rport parameters** - Prevent Via header spoofing
11. **Implement rate limiting** - Prevent DoS and brute force attacks
12. **Use opaque values** - Help detect tampered authentication responses
13. **Support stale nonces** - Allow clients to retry with fresh nonce
14. **Log authentication failures** - Monitor for security incidents
15. **Rotate master keys regularly** - Limit exposure of compromised keys

## Common Pitfalls

1. **Storing plaintext passwords** - Always hash passwords before storage
2. **Not validating nonce freshness** - Allows replay attacks
3. **Weak nonce generation** - Predictable nonces compromise security
4. **Missing qop parameter** - Reduces security, allows easier attacks
5. **Not checking nc increments** - Misses replay attack attempts
6. **Accepting self-signed certificates** - Opens door to MITM attacks
7. **Using weak cipher suites** - Compromises TLS security
8. **Not validating certificate chain** - Accepts invalid certificates
9. **Hardcoded credentials** - Security vulnerability in production
10. **No rate limiting** - Vulnerable to DoS and brute force
11. **Missing Content-Length validation** - Enables buffer overflow attacks
12. **Not sanitizing SDP** - Vulnerable to injection attacks
13. **Trusting Via headers** - Enables IP spoofing attacks
14. **Using MD5 in production** - Known vulnerabilities, use SHA-256
15. **Not implementing SRTP** - Exposes media to eavesdropping

## Resources

- [RFC 2617 - HTTP Digest Authentication](https://datatracker.ietf.org/doc/html/rfc2617)
- [RFC 3261 Section 22 - Security Considerations](https://datatracker.ietf.org/doc/html/rfc3261#section-22)
- [RFC 3711 - Secure Real-time Transport Protocol (SRTP)](https://datatracker.ietf.org/doc/html/rfc3711)
- [RFC 4568 - SDP Security Descriptions](https://datatracker.ietf.org/doc/html/rfc4568)
- [RFC 5246 - TLS 1.2](https://datatracker.ietf.org/doc/html/rfc5246)
- [RFC 5630 - SIPS URI Scheme](https://datatracker.ietf.org/doc/html/rfc5630)
- [RFC 7616 - HTTP Digest Authentication (updated)](https://datatracker.ietf.org/doc/html/rfc7616)
- [OWASP SIP Security](https://owasp.org/www-community/vulnerabilities/SIP_Security)
