---
name: sip-media-negotiation
description: Use when handling SDP offer/answer, codec negotiation, media capabilities, and RTP session setup in SIP applications.
allowed-tools:
  - Bash
  - Read
---

# SIP Media Negotiation

Master Session Description Protocol (SDP) offer/answer model, codec negotiation, and media session establishment for building robust VoIP applications with optimal media handling.

## Understanding SDP and Media Negotiation

SDP (RFC 4566) is used in SIP to describe multimedia sessions. The SDP offer/answer model (RFC 3264) enables endpoints to negotiate media capabilities, codecs, and transport parameters.

## SDP Structure and Syntax

### Basic SDP Message

```
v=0
o=alice 2890844526 2890844527 IN IP4 atlanta.example.com
s=VoIP Call
c=IN IP4 192.0.2.1
t=0 0
m=audio 49170 RTP/AVP 0 8 97
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:97 iLBC/8000
a=ptime:20
a=maxptime:150
a=sendrecv
```

### SDP Line Meanings

```
v=  Protocol version (always 0)
o=  Origin (username, session-id, session-version, network-type, address-type, address)
s=  Session name
c=  Connection information
t=  Timing (start-time stop-time, 0 0 means permanent)
m=  Media description (media, port, protocol, formats)
a=  Attribute (codec mappings, parameters, direction)
```

## SDP Parser Implementation

### Complete SDP Parser

```typescript
interface SdpOrigin {
  username: string;
  sessionId: string;
  sessionVersion: string;
  netType: string;
  addrType: string;
  address: string;
}

interface SdpConnection {
  netType: string;
  addrType: string;
  address: string;
  ttl?: number;
  addressCount?: number;
}

interface SdpMedia {
  media: string;
  port: number;
  portCount?: number;
  protocol: string;
  formats: string[];
  attributes: Map<string, string[]>;
  connection?: SdpConnection;
  bandwidth?: Map<string, number>;
}

interface SdpSession {
  version: number;
  origin: SdpOrigin;
  sessionName: string;
  sessionInfo?: string;
  uri?: string;
  email?: string;
  phone?: string;
  connection?: SdpConnection;
  bandwidth?: Map<string, number>;
  timing: { start: number; stop: number }[];
  attributes: Map<string, string[]>;
  media: SdpMedia[];
}

class SdpParser {
  static parse(sdp: string): SdpSession {
    const lines = sdp.trim().split(/\r?\n/);
    const session: Partial<SdpSession> = {
      attributes: new Map(),
      timing: [],
      media: []
    };

    let currentMedia: SdpMedia | null = null;

    for (const line of lines) {
      const type = line.charAt(0);
      const value = line.substring(2);

      switch (type) {
        case 'v':
          session.version = parseInt(value);
          break;

        case 'o':
          session.origin = this.parseOrigin(value);
          break;

        case 's':
          session.sessionName = value;
          break;

        case 'i':
          if (currentMedia) {
            currentMedia.attributes.set('title', [value]);
          } else {
            session.sessionInfo = value;
          }
          break;

        case 'u':
          session.uri = value;
          break;

        case 'e':
          session.email = value;
          break;

        case 'p':
          session.phone = value;
          break;

        case 'c':
          const connection = this.parseConnection(value);
          if (currentMedia) {
            currentMedia.connection = connection;
          } else {
            session.connection = connection;
          }
          break;

        case 'b':
          const [bwType, bandwidth] = value.split(':');
          const bwValue = parseInt(bandwidth);
          if (currentMedia) {
            if (!currentMedia.bandwidth) {
              currentMedia.bandwidth = new Map();
            }
            currentMedia.bandwidth.set(bwType, bwValue);
          } else {
            if (!session.bandwidth) {
              session.bandwidth = new Map();
            }
            session.bandwidth.set(bwType, bwValue);
          }
          break;

        case 't':
          const [start, stop] = value.split(' ').map(Number);
          session.timing!.push({ start, stop });
          break;

        case 'm':
          if (currentMedia) {
            session.media!.push(currentMedia);
          }
          currentMedia = this.parseMedia(value);
          break;

        case 'a':
          const [attrName, attrValue] = this.parseAttribute(value);
          if (currentMedia) {
            if (!currentMedia.attributes.has(attrName)) {
              currentMedia.attributes.set(attrName, []);
            }
            currentMedia.attributes.get(attrName)!.push(attrValue || '');
          } else {
            if (!session.attributes!.has(attrName)) {
              session.attributes!.set(attrName, []);
            }
            session.attributes!.get(attrName)!.push(attrValue || '');
          }
          break;
      }
    }

    if (currentMedia) {
      session.media!.push(currentMedia);
    }

    return session as SdpSession;
  }

  private static parseOrigin(value: string): SdpOrigin {
    const parts = value.split(' ');
    return {
      username: parts[0],
      sessionId: parts[1],
      sessionVersion: parts[2],
      netType: parts[3],
      addrType: parts[4],
      address: parts[5]
    };
  }

  private static parseConnection(value: string): SdpConnection {
    const parts = value.split(' ');
    const addressParts = parts[2].split('/');

    return {
      netType: parts[0],
      addrType: parts[1],
      address: addressParts[0],
      ttl: addressParts[1] ? parseInt(addressParts[1]) : undefined,
      addressCount: addressParts[2] ? parseInt(addressParts[2]) : undefined
    };
  }

  private static parseMedia(value: string): SdpMedia {
    const parts = value.split(' ');
    const portParts = parts[1].split('/');

    return {
      media: parts[0],
      port: parseInt(portParts[0]),
      portCount: portParts[1] ? parseInt(portParts[1]) : undefined,
      protocol: parts[2],
      formats: parts.slice(3),
      attributes: new Map()
    };
  }

  private static parseAttribute(value: string): [string, string] {
    const colonIndex = value.indexOf(':');
    if (colonIndex === -1) {
      return [value, ''];
    }
    return [value.substring(0, colonIndex), value.substring(colonIndex + 1)];
  }

  static stringify(session: SdpSession): string {
    let sdp = '';

    // Version
    sdp += `v=${session.version}\r\n`;

    // Origin
    const o = session.origin;
    sdp += `o=${o.username} ${o.sessionId} ${o.sessionVersion} ${o.netType} ${o.addrType} ${o.address}\r\n`;

    // Session name
    sdp += `s=${session.sessionName}\r\n`;

    // Session information
    if (session.sessionInfo) {
      sdp += `i=${session.sessionInfo}\r\n`;
    }

    // URI
    if (session.uri) {
      sdp += `u=${session.uri}\r\n`;
    }

    // Email
    if (session.email) {
      sdp += `e=${session.email}\r\n`;
    }

    // Phone
    if (session.phone) {
      sdp += `p=${session.phone}\r\n`;
    }

    // Connection
    if (session.connection) {
      sdp += this.stringifyConnection(session.connection);
    }

    // Bandwidth
    if (session.bandwidth) {
      for (const [type, value] of session.bandwidth) {
        sdp += `b=${type}:${value}\r\n`;
      }
    }

    // Timing
    for (const timing of session.timing) {
      sdp += `t=${timing.start} ${timing.stop}\r\n`;
    }

    // Session attributes
    for (const [name, values] of session.attributes) {
      for (const value of values) {
        sdp += value ? `a=${name}:${value}\r\n` : `a=${name}\r\n`;
      }
    }

    // Media
    for (const media of session.media) {
      sdp += this.stringifyMedia(media);
    }

    return sdp;
  }

  private static stringifyConnection(conn: SdpConnection): string {
    let line = `c=${conn.netType} ${conn.addrType} ${conn.address}`;
    if (conn.ttl !== undefined) {
      line += `/${conn.ttl}`;
      if (conn.addressCount !== undefined) {
        line += `/${conn.addressCount}`;
      }
    }
    return line + '\r\n';
  }

  private static stringifyMedia(media: SdpMedia): string {
    let sdp = `m=${media.media} ${media.port}`;
    if (media.portCount) {
      sdp += `/${media.portCount}`;
    }
    sdp += ` ${media.protocol} ${media.formats.join(' ')}\r\n`;

    // Media connection
    if (media.connection) {
      sdp += this.stringifyConnection(media.connection);
    }

    // Media bandwidth
    if (media.bandwidth) {
      for (const [type, value] of media.bandwidth) {
        sdp += `b=${type}:${value}\r\n`;
      }
    }

    // Media attributes
    for (const [name, values] of media.attributes) {
      for (const value of values) {
        sdp += value ? `a=${name}:${value}\r\n` : `a=${name}\r\n`;
      }
    }

    return sdp;
  }
}
```

## Codec Negotiation

### Codec Registry and Management

```typescript
interface Codec {
  payloadType: number;
  name: string;
  clockRate: number;
  channels?: number;
  parameters?: Map<string, string>;
}

class CodecRegistry {
  private static staticCodecs = new Map<number, Codec>([
    // Audio codecs (RFC 3551)
    [0, { payloadType: 0, name: 'PCMU', clockRate: 8000 }],
    [3, { payloadType: 3, name: 'GSM', clockRate: 8000 }],
    [4, { payloadType: 4, name: 'G723', clockRate: 8000 }],
    [5, { payloadType: 5, name: 'DVI4', clockRate: 8000 }],
    [6, { payloadType: 6, name: 'DVI4', clockRate: 16000 }],
    [7, { payloadType: 7, name: 'LPC', clockRate: 8000 }],
    [8, { payloadType: 8, name: 'PCMA', clockRate: 8000 }],
    [9, { payloadType: 9, name: 'G722', clockRate: 8000 }],
    [10, { payloadType: 10, name: 'L16', clockRate: 44100, channels: 2 }],
    [11, { payloadType: 11, name: 'L16', clockRate: 44100 }],
    [12, { payloadType: 12, name: 'QCELP', clockRate: 8000 }],
    [13, { payloadType: 13, name: 'CN', clockRate: 8000 }],
    [14, { payloadType: 14, name: 'MPA', clockRate: 90000 }],
    [15, { payloadType: 15, name: 'G728', clockRate: 8000 }],
    [16, { payloadType: 16, name: 'DVI4', clockRate: 11025 }],
    [17, { payloadType: 17, name: 'DVI4', clockRate: 22050 }],
    [18, { payloadType: 18, name: 'G729', clockRate: 8000 }],

    // Video codecs
    [26, { payloadType: 26, name: 'JPEG', clockRate: 90000 }],
    [31, { payloadType: 31, name: 'H261', clockRate: 90000 }],
    [32, { payloadType: 32, name: 'MPV', clockRate: 90000 }],
    [33, { payloadType: 33, name: 'MP2T', clockRate: 90000 }],
    [34, { payloadType: 34, name: 'H263', clockRate: 90000 }]
  ]);

  private dynamicCodecs = new Map<number, Codec>();

  // Register dynamic codec from rtpmap attribute
  registerCodec(payloadType: number, rtpmap: string): void {
    const [encodingName, clockRateAndChannels] = rtpmap.split('/');
    const parts = clockRateAndChannels.split('/');
    const clockRate = parseInt(parts[0]);
    const channels = parts[1] ? parseInt(parts[1]) : undefined;

    this.dynamicCodecs.set(payloadType, {
      payloadType,
      name: encodingName,
      clockRate,
      channels
    });
  }

  // Get codec by payload type
  getCodec(payloadType: number): Codec | undefined {
    return this.dynamicCodecs.get(payloadType) ||
           CodecRegistry.staticCodecs.get(payloadType);
  }

  // Add format parameters (fmtp)
  addFormatParameters(payloadType: number, fmtp: string): void {
    const codec = this.getCodec(payloadType);
    if (!codec) {
      return;
    }

    if (!codec.parameters) {
      codec.parameters = new Map();
    }

    // Parse format parameters
    const params = fmtp.split(';').map(p => p.trim());
    for (const param of params) {
      const [key, value] = param.split('=').map(s => s.trim());
      codec.parameters.set(key, value);
    }
  }

  // Get all supported codecs
  getSupportedCodecs(): Codec[] {
    const codecs: Codec[] = [];
    codecs.push(...CodecRegistry.staticCodecs.values());
    codecs.push(...this.dynamicCodecs.values());
    return codecs;
  }

  // Find common codecs between local and remote
  findCommonCodecs(
    localFormats: string[],
    remoteFormats: string[],
    remoteSdp: SdpMedia
  ): Codec[] {
    const common: Codec[] = [];

    for (const format of localFormats) {
      if (remoteFormats.includes(format)) {
        const payloadType = parseInt(format);
        const codec = this.getCodec(payloadType);
        if (codec) {
          common.push(codec);
        }
      }
    }

    return common;
  }
}
```

## Offer/Answer Model Implementation

### Complete Offer/Answer Handler

```typescript
class SdpOfferAnswer {
  private localSession?: SdpSession;
  private remoteSession?: SdpSession;
  private negotiatedCodecs = new Map<string, Codec[]>();
  private codecRegistry = new CodecRegistry();

  // Create initial offer
  createOffer(options: {
    audio?: boolean;
    video?: boolean;
    localIp: string;
    audioPort?: number;
    videoPort?: number;
  }): SdpSession {
    const sessionId = this.generateSessionId();
    const sessionVersion = sessionId;

    const session: SdpSession = {
      version: 0,
      origin: {
        username: 'user',
        sessionId,
        sessionVersion,
        netType: 'IN',
        addrType: 'IP4',
        address: options.localIp
      },
      sessionName: 'SIP Call',
      connection: {
        netType: 'IN',
        addrType: 'IP4',
        address: options.localIp
      },
      timing: [{ start: 0, stop: 0 }],
      attributes: new Map(),
      media: []
    };

    // Add audio media
    if (options.audio !== false) {
      const audioMedia: SdpMedia = {
        media: 'audio',
        port: options.audioPort || 49170,
        protocol: 'RTP/AVP',
        formats: ['0', '8', '96', '97'],
        attributes: new Map([
          ['rtpmap', [
            '0 PCMU/8000',
            '8 PCMA/8000',
            '96 opus/48000/2',
            '97 telephone-event/8000'
          ]],
          ['fmtp', [
            '96 minptime=10;useinbandfec=1',
            '97 0-16'
          ]],
          ['ptime', ['20']],
          ['maxptime', ['150']],
          ['sendrecv', ['']]
        ])
      };

      // Register dynamic codecs
      this.codecRegistry.registerCodec(96, 'opus/48000/2');
      this.codecRegistry.registerCodec(97, 'telephone-event/8000');

      session.media.push(audioMedia);
    }

    // Add video media
    if (options.video) {
      const videoMedia: SdpMedia = {
        media: 'video',
        port: options.videoPort || 49172,
        protocol: 'RTP/AVP',
        formats: ['98', '99', '100'],
        attributes: new Map([
          ['rtpmap', [
            '98 VP8/90000',
            '99 H264/90000',
            '100 rtx/90000'
          ]],
          ['fmtp', [
            '99 profile-level-id=42e01f;packetization-mode=1',
            '100 apt=99'
          ]],
          ['rtcp-fb', [
            '98 nack',
            '98 nack pli',
            '98 ccm fir',
            '99 nack',
            '99 nack pli',
            '99 ccm fir'
          ]],
          ['sendrecv', ['']]
        ])
      };

      this.codecRegistry.registerCodec(98, 'VP8/90000');
      this.codecRegistry.registerCodec(99, 'H264/90000');
      this.codecRegistry.registerCodec(100, 'rtx/90000');

      session.media.push(videoMedia);
    }

    this.localSession = session;
    return session;
  }

  // Process remote offer and create answer
  createAnswer(remoteOffer: SdpSession, options: {
    localIp: string;
    audioPort?: number;
    videoPort?: number;
  }): SdpSession {
    this.remoteSession = remoteOffer;

    const sessionId = this.generateSessionId();
    const sessionVersion = sessionId;

    const answer: SdpSession = {
      version: 0,
      origin: {
        username: 'user',
        sessionId,
        sessionVersion,
        netType: 'IN',
        addrType: 'IP4',
        address: options.localIp
      },
      sessionName: 'SIP Call',
      connection: {
        netType: 'IN',
        addrType: 'IP4',
        address: options.localIp
      },
      timing: [{ start: 0, stop: 0 }],
      attributes: new Map(),
      media: []
    };

    // Process each media stream from offer
    for (const remoteMedia of remoteOffer.media) {
      const answerMedia = this.createAnswerMedia(remoteMedia, options);
      if (answerMedia) {
        answer.media.push(answerMedia);
      }
    }

    this.localSession = answer;
    return answer;
  }

  private createAnswerMedia(
    remoteMedia: SdpMedia,
    options: {
      audioPort?: number;
      videoPort?: number;
    }
  ): SdpMedia | null {
    // Parse remote codecs
    const remoteCodecs = this.parseMediaCodecs(remoteMedia);

    // Get our supported codecs
    const localCodecs = this.getSupportedCodecs(remoteMedia.media);

    // Find common codecs
    const commonCodecs = this.findCommonCodecs(localCodecs, remoteCodecs);

    if (commonCodecs.length === 0) {
      // No common codecs, reject media
      return {
        media: remoteMedia.media,
        port: 0,
        protocol: remoteMedia.protocol,
        formats: ['0'],
        attributes: new Map()
      };
    }

    // Store negotiated codecs
    this.negotiatedCodecs.set(remoteMedia.media, commonCodecs);

    // Build answer media
    const port = remoteMedia.media === 'audio'
      ? (options.audioPort || 49170)
      : (options.videoPort || 49172);

    const answerMedia: SdpMedia = {
      media: remoteMedia.media,
      port,
      protocol: remoteMedia.protocol,
      formats: commonCodecs.map(c => c.payloadType.toString()),
      attributes: new Map()
    };

    // Add rtpmap attributes
    const rtpmaps: string[] = [];
    const fmtps: string[] = [];

    for (const codec of commonCodecs) {
      let rtpmap = `${codec.payloadType} ${codec.name}/${codec.clockRate}`;
      if (codec.channels && codec.channels > 1) {
        rtpmap += `/${codec.channels}`;
      }
      rtpmaps.push(rtpmap);

      // Copy format parameters if present
      if (codec.parameters && codec.parameters.size > 0) {
        const params = Array.from(codec.parameters.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join(';');
        fmtps.push(`${codec.payloadType} ${params}`);
      }
    }

    answerMedia.attributes.set('rtpmap', rtpmaps);
    if (fmtps.length > 0) {
      answerMedia.attributes.set('fmtp', fmtps);
    }

    // Copy direction attribute or use sendrecv
    const direction = remoteMedia.attributes.get('sendrecv') ? 'sendrecv' :
                      remoteMedia.attributes.get('sendonly') ? 'recvonly' :
                      remoteMedia.attributes.get('recvonly') ? 'sendonly' :
                      remoteMedia.attributes.get('inactive') ? 'inactive' :
                      'sendrecv';

    answerMedia.attributes.set(direction, ['']);

    // Add ptime if present in offer
    const ptime = remoteMedia.attributes.get('ptime');
    if (ptime) {
      answerMedia.attributes.set('ptime', ptime);
    }

    return answerMedia;
  }

  // Process remote answer
  processAnswer(remoteAnswer: SdpSession): void {
    this.remoteSession = remoteAnswer;

    // Process each media stream
    for (const remoteMedia of remoteAnswer.media) {
      if (remoteMedia.port === 0) {
        // Media rejected
        console.log(`Media ${remoteMedia.media} rejected`);
        continue;
      }

      // Parse negotiated codecs
      const codecs = this.parseMediaCodecs(remoteMedia);
      this.negotiatedCodecs.set(remoteMedia.media, codecs);
    }
  }

  private parseMediaCodecs(media: SdpMedia): Codec[] {
    const codecs: Codec[] = [];

    // Get rtpmap attributes
    const rtpmaps = media.attributes.get('rtpmap') || [];
    for (const rtpmap of rtpmaps) {
      const match = rtpmap.match(/^(\d+)\s+(.+)$/);
      if (match) {
        const payloadType = parseInt(match[1]);
        this.codecRegistry.registerCodec(payloadType, match[2]);
      }
    }

    // Get fmtp attributes
    const fmtps = media.attributes.get('fmtp') || [];
    for (const fmtp of fmtps) {
      const match = fmtp.match(/^(\d+)\s+(.+)$/);
      if (match) {
        const payloadType = parseInt(match[1]);
        this.codecRegistry.addFormatParameters(payloadType, match[2]);
      }
    }

    // Build codec list
    for (const format of media.formats) {
      const payloadType = parseInt(format);
      const codec = this.codecRegistry.getCodec(payloadType);
      if (codec) {
        codecs.push(codec);
      }
    }

    return codecs;
  }

  private getSupportedCodecs(mediaType: string): Codec[] {
    if (mediaType === 'audio') {
      return [
        { payloadType: 0, name: 'PCMU', clockRate: 8000 },
        { payloadType: 8, name: 'PCMA', clockRate: 8000 },
        { payloadType: 96, name: 'opus', clockRate: 48000, channels: 2 },
        { payloadType: 97, name: 'telephone-event', clockRate: 8000 }
      ];
    } else if (mediaType === 'video') {
      return [
        { payloadType: 98, name: 'VP8', clockRate: 90000 },
        { payloadType: 99, name: 'H264', clockRate: 90000 }
      ];
    }
    return [];
  }

  private findCommonCodecs(localCodecs: Codec[], remoteCodecs: Codec[]): Codec[] {
    const common: Codec[] = [];

    for (const remoteCodec of remoteCodecs) {
      const match = localCodecs.find(local =>
        local.name.toLowerCase() === remoteCodec.name.toLowerCase() &&
        local.clockRate === remoteCodec.clockRate &&
        (local.channels || 1) === (remoteCodec.channels || 1)
      );

      if (match) {
        // Use remote payload type
        common.push({
          ...match,
          payloadType: remoteCodec.payloadType,
          parameters: remoteCodec.parameters
        });
      }
    }

    return common;
  }

  private generateSessionId(): string {
    return Date.now().toString();
  }

  // Get negotiated codec for media type
  getNegotiatedCodecs(mediaType: string): Codec[] {
    return this.negotiatedCodecs.get(mediaType) || [];
  }

  // Get selected codec (first in negotiated list)
  getSelectedCodec(mediaType: string): Codec | undefined {
    const codecs = this.negotiatedCodecs.get(mediaType);
    return codecs && codecs.length > 0 ? codecs[0] : undefined;
  }
}
```

## Advanced Media Features

### ICE Candidate Handling

```typescript
interface IceCandidate {
  foundation: string;
  component: number;
  transport: string;
  priority: number;
  address: string;
  port: number;
  type: 'host' | 'srflx' | 'prflx' | 'relay';
  relAddr?: string;
  relPort?: number;
}

class IceCandidateHandler {
  // Parse ICE candidate from SDP attribute
  static parseCandidate(attr: string): IceCandidate | null {
    // a=candidate:foundation component transport priority address port typ type [raddr reladdr] [rport relport]
    const parts = attr.split(' ');

    if (parts.length < 8) {
      return null;
    }

    const candidate: IceCandidate = {
      foundation: parts[0],
      component: parseInt(parts[1]),
      transport: parts[2],
      priority: parseInt(parts[3]),
      address: parts[4],
      port: parseInt(parts[5]),
      type: parts[7] as IceCandidate['type']
    };

    // Parse optional parameters
    for (let i = 8; i < parts.length; i += 2) {
      const key = parts[i];
      const value = parts[i + 1];

      if (key === 'raddr') {
        candidate.relAddr = value;
      } else if (key === 'rport') {
        candidate.relPort = parseInt(value);
      }
    }

    return candidate;
  }

  // Generate ICE candidate attribute
  static generateCandidate(candidate: IceCandidate): string {
    let attr = `candidate:${candidate.foundation} ${candidate.component} ` +
               `${candidate.transport} ${candidate.priority} ` +
               `${candidate.address} ${candidate.port} typ ${candidate.type}`;

    if (candidate.relAddr && candidate.relPort) {
      attr += ` raddr ${candidate.relAddr} rport ${candidate.relPort}`;
    }

    return attr;
  }

  // Calculate candidate priority (RFC 5245)
  static calculatePriority(
    type: IceCandidate['type'],
    component: number,
    localPreference: number = 65535
  ): number {
    const typePreference = {
      'host': 126,
      'srflx': 100,
      'prflx': 110,
      'relay': 0
    }[type];

    return (2 ** 24) * typePreference +
           (2 ** 8) * localPreference +
           (256 - component);
  }

  // Add ICE candidates to SDP
  static addCandidatesToSdp(sdp: SdpSession, candidates: IceCandidate[]): void {
    for (const media of sdp.media) {
      const mediaCandidates = candidates.filter(c =>
        c.component === (media.media === 'audio' ? 1 : 2)
      );

      const candidateAttrs = mediaCandidates.map(c => this.generateCandidate(c));
      media.attributes.set('candidate', candidateAttrs);
    }
  }
}
```

### RTCP Feedback Configuration

```typescript
class RtcpFeedback {
  // Add RTCP feedback attributes for video
  static addVideoFeedback(media: SdpMedia, payloadTypes: number[]): void {
    const feedbackTypes = [
      'nack',           // Generic NACK
      'nack pli',       // Picture Loss Indication
      'ccm fir',        // Full Intra Request
      'goog-remb',      // Google Receiver Estimated Maximum Bitrate
      'transport-cc'    // Transport-wide congestion control
    ];

    const rtcpFb: string[] = [];

    for (const pt of payloadTypes) {
      for (const fb of feedbackTypes) {
        rtcpFb.push(`${pt} ${fb}`);
      }
    }

    media.attributes.set('rtcp-fb', rtcpFb);
  }

  // Parse RTCP feedback
  static parseFeedback(attr: string): { payloadType: number; type: string; parameter?: string } | null {
    const match = attr.match(/^(\d+|\*)\s+([^\s]+)(?:\s+(.+))?$/);
    if (!match) {
      return null;
    }

    return {
      payloadType: match[1] === '*' ? -1 : parseInt(match[1]),
      type: match[2],
      parameter: match[3]
    };
  }
}
```

## Media Capability Negotiation

### Simulcast and SVC Support

```typescript
class MediaCapabilities {
  // Add simulcast support
  static addSimulcast(media: SdpMedia, sendRids: string[]): void {
    // Add RID attributes
    const ridAttrs = sendRids.map(rid => `${rid} send`);
    media.attributes.set('rid', ridAttrs);

    // Add simulcast attribute
    const simulcastAttr = `send ${sendRids.join(';')}`;
    media.attributes.set('simulcast', [simulcastAttr]);
  }

  // Parse simulcast configuration
  static parseSimulcast(attr: string): {
    send?: string[];
    recv?: string[];
  } {
    const result: { send?: string[]; recv?: string[] } = {};

    // Parse "send rid1;rid2;rid3 recv rid4;rid5"
    const parts = attr.split(/\s+/);

    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'send' && parts[i + 1]) {
        result.send = parts[i + 1].split(';');
        i++;
      } else if (parts[i] === 'recv' && parts[i + 1]) {
        result.recv = parts[i + 1].split(';');
        i++;
      }
    }

    return result;
  }

  // Add SVC (Scalable Video Coding) support
  static addSvcSupport(media: SdpMedia, payloadType: number): void {
    // Add dependency descriptor extension
    media.attributes.set('extmap', [
      '1 urn:ietf:params:rtp-hdrext:sdes:mid',
      '2 http://www.webrtc.org/experiments/rtp-hdrext/generic-frame-descriptor-00'
    ]);

    // Add SVC format parameters
    const fmtps = media.attributes.get('fmtp') || [];
    const svcParams = 'scalability-mode=L3T3';

    const existingIndex = fmtps.findIndex(f => f.startsWith(`${payloadType} `));
    if (existingIndex >= 0) {
      fmtps[existingIndex] += `;${svcParams}`;
    } else {
      fmtps.push(`${payloadType} ${svcParams}`);
    }

    media.attributes.set('fmtp', fmtps);
  }
}
```

## Complete SIP Offer/Answer Example

```typescript
class SipMediaSession {
  private offerAnswer = new SdpOfferAnswer();

  // UAC (caller) creates offer
  async initiateCall(callee: string, localIp: string): Promise<string> {
    // Create SDP offer
    const offer = this.offerAnswer.createOffer({
      audio: true,
      video: false,
      localIp,
      audioPort: 49170
    });

    // Build SIP INVITE
    const sdpBody = SdpParser.stringify(offer);

    const invite = `INVITE sip:${callee} SIP/2.0\r
Via: SIP/2.0/UDP ${localIp}:5060;branch=z9hG4bK${this.generateBranch()}\r
Max-Forwards: 70\r
To: <sip:${callee}>\r
From: <sip:caller@example.com>;tag=${this.generateTag()}\r
Call-ID: ${this.generateCallId()}\r
CSeq: 1 INVITE\r
Contact: <sip:caller@${localIp}:5060>\r
Content-Type: application/sdp\r
Content-Length: ${sdpBody.length}\r
\r
${sdpBody}`;

    return invite;
  }

  // UAS (callee) creates answer
  async acceptCall(inviteMessage: string, localIp: string): Promise<string> {
    // Parse INVITE and extract SDP
    const sdpStart = inviteMessage.indexOf('v=0');
    const sdpBody = inviteMessage.substring(sdpStart);
    const offer = SdpParser.parse(sdpBody);

    // Create SDP answer
    const answer = this.offerAnswer.createAnswer(offer, {
      localIp,
      audioPort: 49170
    });

    // Get negotiated codec
    const codec = this.offerAnswer.getSelectedCodec('audio');
    console.log('Selected codec:', codec);

    // Build SIP 200 OK
    const answerSdp = SdpParser.stringify(answer);

    const response = `SIP/2.0 200 OK\r
Via: SIP/2.0/UDP ${localIp}:5060;branch=z9hG4bK${this.generateBranch()}\r
To: <sip:callee@example.com>;tag=${this.generateTag()}\r
From: <sip:caller@example.com>;tag=caller-tag\r
Call-ID: call-id\r
CSeq: 1 INVITE\r
Contact: <sip:callee@${localIp}:5060>\r
Content-Type: application/sdp\r
Content-Length: ${answerSdp.length}\r
\r
${answerSdp}`;

    return response;
  }

  // UAC processes answer
  processAnswer(responseMessage: string): void {
    // Parse 200 OK and extract SDP
    const sdpStart = responseMessage.indexOf('v=0');
    const sdpBody = responseMessage.substring(sdpStart);
    const answer = SdpParser.parse(sdpBody);

    // Process answer
    this.offerAnswer.processAnswer(answer);

    // Get negotiated codecs
    const audioCodecs = this.offerAnswer.getNegotiatedCodecs('audio');
    console.log('Negotiated audio codecs:', audioCodecs);
  }

  private generateBranch(): string {
    return Math.random().toString(36).substring(7);
  }

  private generateTag(): string {
    return Math.random().toString(36).substring(7);
  }

  private generateCallId(): string {
    return `${Date.now()}@example.com`;
  }
}
```

## When to Use This Skill

Use sip-media-negotiation when building applications that require:

- Setting up audio/video calls with codec negotiation
- Implementing SDP offer/answer model
- Parsing and generating SDP messages
- Negotiating media capabilities between endpoints
- Handling multiple codec support
- Implementing ICE for NAT traversal
- Configuring RTCP feedback for video
- Supporting advanced features like simulcast
- Building WebRTC-SIP gateways
- Creating multi-party conferencing systems

## Best Practices

1. **Always validate SDP structure** - Parse and validate before processing
2. **Support multiple codecs** - Offer fallback options for compatibility
3. **Use payload type 96+ for dynamic codecs** - Follow RFC 3551 guidelines
4. **Include rtpmap for dynamic types** - Even if well-known, be explicit
5. **Add format parameters (fmtp)** - Specify codec configuration details
6. **Respect media direction attributes** - sendrecv, sendonly, recvonly, inactive
7. **Handle rejected media (port=0)** - Gracefully handle unsupported media
8. **Update session version on modification** - Increment o= version field
9. **Include timing information** - Required t= line even if permanent (0 0)
10. **Set appropriate ptime** - Balance latency vs packet overhead
11. **Support telephone-event** - Enable DTMF transmission (RFC 4733)
12. **Add ICE candidates when using ICE** - Include all candidate types
13. **Configure RTCP feedback for video** - Enable error resilience features
14. **Order codecs by preference** - Most preferred first in format list
15. **Preserve codec parameters in answer** - Match offerer's fmtp settings

## Common Pitfalls

1. **Missing rtpmap for dynamic payloads** - Causes codec mismatch
2. **Incorrect payload type numbering** - Use 96-127 for dynamic, 0-95 for static
3. **Not handling rejected media** - Assumes all media accepted
4. **Ignoring format parameters** - Codec may not work correctly
5. **Wrong clock rate in rtpmap** - Audio uses 8000, video uses 90000 typically
6. **Missing required SDP lines** - v=, o=, s=, t= are mandatory
7. **Not updating session version** - Causes confusion on re-INVITE
8. **Mismatched payload types** - Using different PT for same codec
9. **Forgetting Content-Length** - SIP requires accurate body length
10. **Not escaping special characters** - URI parameters must be encoded
11. **Wrong media direction logic** - sendonly should be answered with recvonly
12. **Missing connection information** - c= required at session or media level
13. **Incorrect component numbers** - RTP=1, RTCP=2 for ICE candidates
14. **Not prioritizing secure codecs** - Prefer encrypted over plaintext
15. **Hardcoded ports** - Use dynamic port allocation for multiple sessions

## Resources

- [RFC 3264 - SDP Offer/Answer Model](https://datatracker.ietf.org/doc/html/rfc3264)
- [RFC 4566 - Session Description Protocol (SDP)](https://datatracker.ietf.org/doc/html/rfc4566)
- [RFC 3551 - RTP Profile for Audio and Video](https://datatracker.ietf.org/doc/html/rfc3551)
- [RFC 4733 - RTP Payload for DTMF](https://datatracker.ietf.org/doc/html/rfc4733)
- [RFC 5245 - Interactive Connectivity Establishment (ICE)](https://datatracker.ietf.org/doc/html/rfc5245)
- [RFC 5506 - Reduced-Size RTCP](https://datatracker.ietf.org/doc/html/rfc5506)
- [RFC 5761 - Multiplexing RTP and RTCP](https://datatracker.ietf.org/doc/html/rfc5761)
- [RFC 8866 - SDP Update](https://datatracker.ietf.org/doc/html/rfc8866)
- [WebRTC SDP Documentation](https://webrtc.org/getting-started/media-capture-and-constraints)
