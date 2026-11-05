#!/usr/bin/env bash
# Replace the RAILWAY_TOKEN variable on the Terraform Cloud workspace that owns
# the Han Railway stack, then verify with a plan-only (read-only) run.
#
# The new token is never printed, never passed on a command line, and never
# written to disk. It is read from the macOS clipboard, checked against the
# Railway API, uploaded as a sensitive variable, and the clipboard is cleared
# once the upload has been accepted.
#
# Auto-apply policy (approved): auto-apply is disabled only for the verification
# window. It is restored only when the plan-only run completes with no changes.
# Any failure, and any plan that has changes, leaves auto-apply DISABLED and the
# script reports it. There is no restore on exit. Restoring is a human decision.
#
# Usage:
#   scripts/ops/railway-token-capture.sh check   # read-only: state and clipboard shape
#   scripts/ops/railway-token-capture.sh apply   # disable auto-apply, upload, plan-only verify
#
# Exit codes for apply:
#   0  plan-only run finished with no changes; auto-apply restored to its prior value
#   2  plan finished with changes or is awaiting confirmation; auto-apply left DISABLED
#   1  any failure; auto-apply left DISABLED (or never changed, if the failure came first)
#
# The verification run is created with plan-only=true, and the script refuses to
# trust it unless the API echoes plan-only=true back. Nothing here runs apply or
# confirms a run. The Terraform Cloud token is read from the credentials file that
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

# Reports, on any non-zero exit after auto-apply may have been disabled, that it
# is still disabled. It only reports; it never restores.
# shellcheck disable=SC2329  # invoked by the EXIT trap below
report_on_exit() {
  local rc=$?
  if [ "$rc" -ne 0 ] && [ -f "$STATE_FILE" ]; then
    echo "NOTICE: auto-apply on $WS_NAME may still be DISABLED (prior value recorded in $STATE_FILE)" >&2
  fi
  exit "$rc"
}
trap report_on_exit EXIT

tfc_token() {
  [ -f "$CRED_FILE" ] || die "no Terraform Cloud credentials file at $CRED_FILE"
  jq -r '.credentials["app.terraform.io"].token // empty' "$CRED_FILE"
}

# Calls the TFC API. The bearer token reaches curl through a process-substituted
# config file, so it never appears on a command line. A request body, when
# given, is sent through a pipe on stdin.
tfc() {
  local method="$1" path="$2" body="${3-}" tok
  tok="$(tfc_token)"
  [ -n "$tok" ] || die "no Terraform Cloud token in $CRED_FILE"
  if [ -n "$body" ]; then
    printf '%s' "$body" | curl -sS -K <(printf 'header = "Authorization: Bearer %s"\nheader = "Content-Type: application/vnd.api+json"\nheader = "Accept: application/vnd.api+json"\n' "$tok") \
      -X "$method" --data-binary @- "$TFC_API$path"
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
  local re='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  [[ "$1" =~ $re ]]
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

# Every run that has not reached a final state. A run in any other state is
# treated as active, so an unrecognised state blocks the apply rather than passing.
active_runs() {
  tfc GET "/workspaces/$1/runs?page%5Bsize%5D=20" \
    | jq -r '.data[] | select(.attributes.status as $s | ["applied","planned_and_finished","errored","canceled","discarded","force_canceled","policy_soft_failed","policy_checked"] | index($s) | not) | .id'
}

set_auto_apply() {
  local ws="$1" value="$2" resp
  resp="$(tfc PATCH "/workspaces/$ws" "$(jq -nc --argjson v "$value" \
    '{data:{type:"workspaces",attributes:{"auto-apply":$v}}}')")"
  printf '%s' "$resp" | jq -e --arg id "$ws" --argjson v "$value" \
    '.data.id == $id and .data.attributes["auto-apply"] == $v' >/dev/null \
    || die "could not set auto-apply to $value on $ws"
}

if [ "$mode" = check ]; then
  ws="$(workspace_id)"; [ -n "$ws" ] || die "workspace $WS_NAME not found in $ORG"
  echo "workspace: $WS_NAME ($ws)"
  echo "auto-apply: $(workspace_auto_apply "$ws")"
  if [ -f "$STATE_FILE" ]; then
    echo "WARNING: an earlier apply left auto-apply disabled; prior value was $(cat "$STATE_FILE")"
  fi
  echo "RAILWAY_TOKEN variable: $(var_id "$ws" | sed 's/^$/absent/')"
  runs="$(active_runs "$ws")"
  echo "active runs: $(printf '%s' "$runs" | grep -c . || true)"
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
runs="$(active_runs "$ws")"
[ -z "$runs" ] || die "a run is not final on $WS_NAME ($(printf '%s' "$runs" | tr '\n' ' ')); nothing changed"
[ ! -f "$STATE_FILE" ] || die "$STATE_FILE exists: an earlier apply left auto-apply disabled. Resolve it before running again; nothing changed"

prior_auto="$(workspace_auto_apply "$ws")"
case "$prior_auto" in
  true|false) ;;
  *) die "could not read the prior auto-apply value (got '$prior_auto'); nothing changed" ;;
esac

mkdir -p "$STATE_DIR"
printf '%s' "$prior_auto" > "$STATE_FILE"

set_auto_apply "$ws" false
echo "auto-apply DISABLED for verification (prior: $prior_auto)"

# The value goes through stdin into jq, never onto a command line.
upload_body="$(printf '%s' "$clip" | jq -Rs --arg id "$var" \
  '{data:{type:"vars",id:$id,attributes:{value:., sensitive:true}}}')"
resp="$(tfc PATCH "/workspaces/$ws/vars/$var" "$upload_body")"
printf '%s' "$resp" | jq -e '.data.attributes.sensitive == true and .data.attributes.key == "RAILWAY_TOKEN"' >/dev/null \
  || die "variable upload was rejected; auto-apply is left DISABLED"
echo "RAILWAY_TOKEN variable replaced (value not shown)"

# Clear the clipboard only when it still holds the value that was just accepted.
clip_hash="$(printf '%s' "$clip" | shasum -a 256 | cut -d' ' -f1)"
if [ "$(clipboard | shasum -a 256 | cut -d' ' -f1)" = "$clip_hash" ]; then
  printf '' | pbcopy && echo "clipboard cleared (it held the consumed token)"
else
  echo "NOTICE: the clipboard no longer holds the consumed token and was not changed"
fi

run_body="$(jq -nc --arg ws "$ws" \
  '{data:{type:"runs",attributes:{"plan-only":true,"auto-apply":false,message:"railway token verification (plan-only, read-only)"},relationships:{workspace:{data:{type:"workspaces",id:$ws}}}}}')"
resp="$(tfc POST "/runs" "$run_body")"
run_id="$(printf '%s' "$resp" | jq -r '.data.id // empty')"
[ -n "$run_id" ] || die "could not create a verification run; auto-apply is left DISABLED"

# Refuse to trust the run unless the API echoes plan-only. Otherwise discard it.
if [ "$(printf '%s' "$resp" | jq -r '.data.attributes["plan-only"]')" != "true" ]; then
  tfc POST "/runs/$run_id/actions/discard" '{"comment":"not plan-only"}' >/dev/null 2>&1 \
    || tfc POST "/runs/$run_id/actions/cancel" '{"comment":"not plan-only"}' >/dev/null 2>&1 || true
  die "API did not confirm plan-only for run $run_id; run discarded; auto-apply is left DISABLED"
fi
echo "verification run (plan-only): $run_id"

status=""
for _ in $(seq 1 180); do
  status="$(tfc GET "/runs/$run_id" | jq -r '.data.attributes.status')"
  case "$status" in
    planned_and_finished|policy_soft_failed|errored|canceled|force_canceled|discarded) break ;;
  esac
  sleep 5
done
echo "verification run status: $status"

has_changes="$(tfc GET "/runs/$run_id" | jq -r '.data.attributes["has-changes"]')"
echo "verification run has-changes: $has_changes"

case "$status" in
  planned_and_finished)
    if [ "$has_changes" = "false" ]; then
      set_auto_apply "$ws" "$prior_auto"
      rm -f "$STATE_FILE"
      echo "verification: plan-only run has no changes; auto-apply RESTORED to $prior_auto"
      exit 0
    fi
    echo "verification: plan has changes; auto-apply left DISABLED for a human decision (run $run_id)"
    exit 2
    ;;
  *)
    echo "verification did not finish cleanly (status $status, run $run_id); auto-apply left DISABLED"
    exit 1
    ;;
esac
