#!/usr/bin/env bash
# Replace the RAILWAY_TOKEN variable on the Terraform Cloud workspace that owns
# the Han Railway stack, then verify with a speculative (read-only) plan.
#
# The new token is never printed, never passed on a command line, and never
# written to disk. It is read from the macOS clipboard, checked against the
# Railway API, uploaded as a sensitive variable, and the clipboard is cleared
# only when it still holds the exact value that was used.
#
# Usage:
#   scripts/ops/railway-token-capture.sh check   # read-only: state and clipboard shape
#   scripts/ops/railway-token-capture.sh apply   # disable auto-apply, upload, plan, restore
#
# Nothing here runs `terraform apply` or queues an apply. Speculative plans
# never apply. The Terraform Cloud token is read from the credentials file that
# `terraform login` writes; it is used by this script and never printed.

set -euo pipefail
umask 077

ORG="${TFC_ORG:-thebushido-co}"
WS_NAME="${TFC_WORKSPACE:-han-guru}"
RAILWAY_PROJECT_ID="${RAILWAY_PROJECT_ID:-24bcc47a-dadf-464b-887f-bcccaf3e25e2}"
TFC_API="https://app.terraform.io/api/v2"
RAILWAY_API="https://backboard.railway.com/graphql/v2"
CRED_FILE="${TF_CRED_FILE:-$HOME/.terraform.d/credentials.tfrc.json}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/han-railway-capture"
STATE_FILE="$STATE_DIR/auto-apply-state"

mode="${1:-check}"
case "$mode" in
  check|apply) ;;
  *) echo "usage: $0 check|apply" >&2; exit 64 ;;
esac

die() { echo "error: $*" >&2; exit 1; }

tfc_token() {
  [ -f "$CRED_FILE" ] || die "no Terraform Cloud credentials file at $CRED_FILE"
  jq -r '.credentials["app.terraform.io"].token // empty' "$CRED_FILE"
}

# Calls the TFC API. The bearer token reaches curl through a process-substituted
# config file, so it never appears on a command line. A request body, when
# given, is sent on stdin.
tfc() {
  local method="$1" path="$2" body="${3-}" tok
  tok="$(tfc_token)"
  [ -n "$tok" ] || die "no Terraform Cloud token in $CRED_FILE"
  if [ -n "$body" ]; then
    curl -sS -K <(printf 'header = "Authorization: Bearer %s"\nheader = "Content-Type: application/vnd.api+json"\nheader = "Accept: application/vnd.api+json"\n' "$tok") \
      -X "$method" --data-binary @- "$TFC_API$path" <<<"$body"
  else
    curl -sS -K <(printf 'header = "Authorization: Bearer %s"\nheader = "Accept: application/vnd.api+json"\n' "$tok") \
      -X "$method" "$TFC_API$path"
  fi
}

# Asks Railway whether the candidate token can read the Han project, the same
# read the Terraform provider performs. The token travels in the curl config.
railway_project_ok() {
  local tok="$1" resp
  resp="$(curl -sS -K <(printf 'header = "Authorization: Bearer %s"\nheader = "Content-Type: application/json"\n' "$tok") \
    -X POST "$RAILWAY_API" \
    --data-binary "{\"query\":\"query { project(id: \\\"$RAILWAY_PROJECT_ID\\\") { id name } }\"}")"
  printf '%s' "$resp" | jq -e --arg id "$RAILWAY_PROJECT_ID" \
    '.data.project.id == $id and (.errors | not)' >/dev/null
}

# Clipboard text, read without echo. Empty when the clipboard holds no text.
clipboard() { pbpaste 2>/dev/null || true; }

token_shape_ok() {
  # Railway tokens are UUIDs. Multi-line text, prose and empty values are refused.
  printf '%s' "$1" | grep -Eq '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
}

workspace_id() {
  tfc GET "/organizations/$ORG/workspaces/$WS_NAME" | jq -r '.data.id // empty'
}

workspace_auto_apply() {
  tfc GET "/workspaces/$1" | jq -r '.data.attributes["auto-apply"]'
}

var_id() {
  tfc GET "/workspaces/$1/vars" \
    | jq -r '.data[] | select(.attributes.key == "RAILWAY_TOKEN" and .attributes.category == "env") | .id'
}

active_runs() {
  tfc GET "/workspaces/$1/runs?page%5Bsize%5D=10" \
    | jq -r '.data[] | select(.attributes.status | test("pending|plan_queued|planning|planned$|cost_estimating|policy|apply_queued|applying|confirmed|queued")) | .id'
}

set_auto_apply() {
  local ws="$1" value="$2" resp
  resp="$(tfc PATCH "/workspaces/$ws" "$(jq -nc --argjson v "$value" \
    '{data:{type:"workspaces",attributes:{"auto-apply":$v}}}')")"
  printf '%s' "$resp" | jq -e '.data.attributes["auto-apply"] == '"$value" >/dev/null \
    || die "could not set auto-apply to $value"
}

if [ "$mode" = check ]; then
  ws="$(workspace_id)"; [ -n "$ws" ] || die "workspace $WS_NAME not found in $ORG"
  echo "workspace: $WS_NAME ($ws)"
  echo "auto-apply: $(workspace_auto_apply "$ws")"
  echo "RAILWAY_TOKEN variable: $(var_id "$ws" | sed 's/^$/absent/')"
  echo "active runs: $(active_runs "$ws" | wc -l | tr -d ' ')"
  clip="$(clipboard)"
  if [ -z "$clip" ]; then
    echo "clipboard: empty"
  elif token_shape_ok "$clip"; then
    if railway_project_ok "$clip"; then
      echo "clipboard: token-shaped value that Railway accepts for project $RAILWAY_PROJECT_ID"
    else
      echo "clipboard: token-shaped value that Railway does NOT accept for project $RAILWAY_PROJECT_ID"
    fi
  else
    echo "clipboard: no token-shaped value"
  fi
  exit 0
fi

# ---- apply ------------------------------------------------------------------

clip="$(clipboard)"
token_shape_ok "$clip" || die "clipboard does not hold a token-shaped value; nothing changed"
railway_project_ok "$clip" || die "Railway does not accept the clipboard token for project $RAILWAY_PROJECT_ID; nothing changed"

ws="$(workspace_id)"; [ -n "$ws" ] || die "workspace $WS_NAME not found; nothing changed"
var="$(var_id "$ws")"; [ -n "$var" ] || die "RAILWAY_TOKEN variable not found; nothing changed"
[ -z "$(active_runs "$ws")" ] || die "a run is active on $WS_NAME; nothing changed"

restore_auto_apply() {
  if [ -f "$STATE_FILE" ]; then
    local prior; prior="$(cat "$STATE_FILE")"
    set_auto_apply "$ws" "$prior" && rm -f "$STATE_FILE" && echo "auto-apply restored to $prior"
  fi
}

mkdir -p "$STATE_DIR"
prior_auto="$(workspace_auto_apply "$ws")"
printf '%s' "$prior_auto" > "$STATE_FILE"
trap restore_auto_apply EXIT

set_auto_apply "$ws" false
echo "auto-apply disabled for verification (prior: $prior_auto)"

# The value goes through stdin into jq, never onto a command line.
upload_body="$(printf '%s' "$clip" | jq -Rs --arg id "$var" \
  '{data:{type:"vars",id:$id,attributes:{value:., sensitive:true}}}')"
resp="$(tfc PATCH "/workspaces/$ws/vars/$var" "$upload_body")"
printf '%s' "$resp" | jq -e '.data.attributes.sensitive == true and .data.attributes.key == "RAILWAY_TOKEN"' >/dev/null \
  || die "variable upload was rejected; auto-apply will be restored"
echo "RAILWAY_TOKEN variable replaced (value not shown)"

run_body="$(jq -nc --arg ws "$ws" \
  '{data:{type:"runs",attributes:{speculative:true,message:"railway token verification (speculative, read-only)"},relationships:{workspace:{data:{type:"workspaces",id:$ws}}}}}')"
run_id="$(tfc POST "/runs" "$run_body" | jq -r '.data.id // empty')"
[ -n "$run_id" ] || die "could not create a speculative run; auto-apply will be restored"
echo "speculative run: $run_id"

status=""
for _ in $(seq 1 120); do
  status="$(tfc GET "/runs/$run_id" | jq -r '.data.attributes.status')"
  case "$status" in
    planned|planned_and_finished|errored|canceled|discarded|policy_checked) break ;;
  esac
  sleep 5
done
echo "speculative run status: $status"

clip_hash="$(printf '%s' "$clip" | shasum -a 256 | cut -d' ' -f1)"
if [ "$(clipboard | shasum -a 256 | cut -d' ' -f1)" = "$clip_hash" ]; then
  printf '' | pbcopy && echo "clipboard cleared (it held the consumed token)"
fi

case "$status" in
  planned|planned_and_finished|policy_checked) echo "verification: speculative plan produced without error" ;;
  *) die "verification failed with status $status; see run $run_id in Terraform Cloud" ;;
esac
