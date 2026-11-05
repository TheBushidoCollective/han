#!/usr/bin/env python3
"""Check the Location header that /auth/github returns.

han-server percent-encodes redirect_uri (auth/oauth.rs), so the raw header
never contains the callback URL in plain form. Compare decoded query values,
the same way GitHub reads them, not the raw string.

Usage: check_redirect.py <location-url> <client-id> <callback-url>
Exit 0 when the URL goes to github.com's authorize endpoint with the expected
client_id and redirect_uri. Exit 1 otherwise.
"""

from __future__ import annotations

import sys
from urllib.parse import parse_qs, urlsplit

AUTHORIZE_HOST = "github.com"
AUTHORIZE_PATH = "/login/oauth/authorize"


def check(location: str, client_id: str, callback: str) -> tuple[bool, str]:
    parts = urlsplit(location)
    if parts.scheme != "https" or parts.hostname != AUTHORIZE_HOST:
        return False, f"not a GitHub authorize URL: {location!r}"
    if parts.path != AUTHORIZE_PATH:
        return False, f"unexpected path {parts.path!r}"
    query = parse_qs(parts.query, keep_blank_values=True)
    got_client = query.get("client_id", [""])[0]
    if got_client != client_id:
        return False, f"client_id is {got_client!r}, expected {client_id!r}"
    got_redirect = query.get("redirect_uri", [""])[0]
    if got_redirect != callback:
        return False, f"redirect_uri is {got_redirect!r}, expected {callback!r}"
    return True, "authorize URL has the expected client_id and redirect_uri"


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    ok, reason = check(argv[0], argv[1], argv[2])
    print(reason)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
