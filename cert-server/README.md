# Retired certificate distribution service

`/coordinator/latest` returns HTTP 410 with `UPGRADE_REQUIRED`. It does not read or distribute certificate material. `/health` remains available for the existing service health check. The image does not request or renew certificates.

Deploy this response only as part of the protected client and coordinator cutover. Existing unupgraded daemons remain insecure and need an upgrade and verified restart. This source change does not revoke the disclosed certificate or remove any service, secret, or DNS record. Revoke the disclosed certificate where supported and retire infrastructure only through its owning deployment rail after cutover.
