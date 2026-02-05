---
description: Manage Cloudflare DNS records for a zone
---

# Manage Cloudflare DNS

## Name

cloudflare:manage-dns - Manage Cloudflare DNS records for a zone

## Synopsis

```
/manage-dns <zone> [action] [record-details]
```

## Description

List, add, update, or delete DNS records for a Cloudflare zone. Supports all record types (A, AAAA, CNAME, MX, TXT, etc.).

## Arguments

- `zone` - Domain name or zone ID (required)
- `action` - Optional action: list, add, update, delete (default: list)
- `record-details` - Required for add/update/delete actions

## Implementation

1. Authenticate using Cloudflare API token
2. Look up zone by name or ID
3. Perform requested action:
   - list: Show all DNS records
   - add: Create new record
   - update: Modify existing record
   - delete: Remove record
4. Return confirmation and updated record state

## Example Interaction

```
User: /manage-dns example.com

Claude: DNS records for example.com:

| Type  | Name                 | Content              | Proxied | TTL   |
|-------|----------------------|----------------------|---------|-------|
| A     | example.com          | 192.0.2.1            | Yes     | Auto  |
| A     | www                  | 192.0.2.1            | Yes     | Auto  |
| CNAME | blog                 | blog.ghost.io        | Yes     | Auto  |
| MX    | example.com          | mail.example.com     | -       | 3600  |
| TXT   | example.com          | v=spf1 include:...   | -       | 3600  |
| TXT   | _dmarc               | v=DMARC1; p=reject   | -       | 3600  |

Total: 6 records

User: /manage-dns example.com add CNAME api api.railway.app

Claude: Created DNS record:
- Type: CNAME
- Name: api.example.com
- Content: api.railway.app
- Proxied: Yes
- TTL: Auto

Record is now active.
```

## Notes

- Requires CLOUDFLARE_API_TOKEN with Zone:Edit permission
- Proxied records (orange cloud) benefit from Cloudflare CDN/WAF
- Some record types (MX, TXT) cannot be proxied
