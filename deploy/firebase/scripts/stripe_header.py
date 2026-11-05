#!/usr/bin/env python3
"""Print a Stripe-Signature header value for a body, signed with a secret.

Usage: stripe_header.py <secret> <body-file> [timestamp]

The format matches billing/stripe.rs verify_signature: `t=<ts>,v1=<hex>`, where
the HMAC-SHA256 is over "<ts>.<body>". Smoke tests use it to send a correctly
signed event and a deliberately wrong one.
"""

from __future__ import annotations

import hashlib
import hmac
import sys
import time


def header(secret: str, body: bytes, timestamp: int) -> str:
    signed = f"{timestamp}.".encode() + body
    digest = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={digest}"


def main(argv: list[str]) -> int:
    if len(argv) not in (2, 3):
        print(__doc__.strip(), file=sys.stderr)
        return 2
    with open(argv[1], "rb") as fh:
        body = fh.read()
    ts = int(argv[2]) if len(argv) == 3 else int(time.time())
    print(header(argv[0], body, ts))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
