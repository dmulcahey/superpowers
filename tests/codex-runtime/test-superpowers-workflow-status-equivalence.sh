#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LEGACY_STATUS_BIN="$REPO_ROOT/bin/superpowers-workflow-status"
TMP_ROOT="$(mktemp -d)"
STATE_DIR="$TMP_ROOT/state"
REPO_DIR="$TMP_ROOT/repos"
NODE_BUNDLE="$TMP_ROOT/superpowers-workflow-status.cjs"
trap 'rm -rf "$TMP_ROOT"' EXIT

mkdir -p "$STATE_DIR" "$REPO_DIR"

npm --prefix "$REPO_ROOT/runtime/core-helpers" exec esbuild -- \
  "$REPO_ROOT/runtime/core-helpers/src/cli/superpowers-workflow-status.ts" \
  --bundle \
  --platform=node \
  --format=cjs \
  --log-level=warning \
  --outfile="$NODE_BUNDLE" >/dev/null

assert_same_output() {
  local label="$1"
  local legacy_status="$2"
  local legacy_output="$3"
  local node_status="$4"
  local node_output="$5"

  if [[ "$legacy_status" -ne "$node_status" ]]; then
    echo "Expected legacy helper and bundled CLI to return the same exit code for: $label"
    echo "legacy: $legacy_status"
    echo "node:   $node_status"
    printf '%s\n' "$legacy_output"
    printf '%s\n' "$node_output"
    exit 1
  fi

  if [[ "$legacy_output" != "$node_output" ]]; then
    echo "Expected legacy helper and bundled CLI to match for: $label"
    diff -u <(printf '%s\n' "$legacy_output") <(printf '%s\n' "$node_output") || true
    exit 1
  fi
}

init_repo() {
  local repo_dir="$1"
  mkdir -p "$repo_dir"
  git -C "$repo_dir" init >/dev/null 2>&1
  git -C "$repo_dir" config user.name "Superpowers Test"
  git -C "$repo_dir" config user.email "superpowers-tests@example.com"
  printf '# workflow status equivalence fixture\n' > "$repo_dir/README.md"
  git -C "$repo_dir" add README.md
  git -C "$repo_dir" commit -m "init" >/dev/null 2>&1
}

write_file() {
  local path="$1"
  mkdir -p "$(dirname "$path")"
  cat > "$path"
}

run_case() {
  local label="$1"
  local repo_dir="$2"
  local legacy_output
  local node_output
  local legacy_status=0
  local node_status=0
  shift 2

  rm -rf "$STATE_DIR"
  mkdir -p "$STATE_DIR"
  legacy_output="$(cd "$repo_dir" && SUPERPOWERS_STATE_DIR="$STATE_DIR" "$LEGACY_STATUS_BIN" "$@" 2>&1)" || legacy_status=$?

  rm -rf "$STATE_DIR"
  mkdir -p "$STATE_DIR"
  node_output="$(cd "$repo_dir" && SUPERPOWERS_STATE_DIR="$STATE_DIR" SUPERPOWERS_RUNTIME_ROOT="$REPO_ROOT" node "$NODE_BUNDLE" "$@" 2>&1)" || node_status=$?

  assert_same_output "$label" "$legacy_status" "$legacy_output" "$node_status" "$node_output"
}

run_draft_spec_case() {
  local repo="$REPO_DIR/draft-spec"
  init_repo "$repo"
  write_file "$repo/docs/superpowers/specs/2026-03-19-draft-design.md" <<'EOF'
# Draft Spec

**Workflow State:** Draft
**Spec Revision:** 1
**Last Reviewed By:** brainstorming
EOF

  run_case "draft spec status refresh" "$repo" status --refresh
}

run_approved_spec_no_plan_case() {
  local repo="$REPO_DIR/approved-spec-no-plan"
  init_repo "$repo"
  write_file "$repo/docs/superpowers/specs/2026-03-19-approved-design.md" <<'EOF'
# Approved Spec

**Workflow State:** CEO Approved
**Spec Revision:** 1
**Last Reviewed By:** plan-ceo-review
EOF

  run_case "approved spec without plan status refresh" "$repo" status --refresh
}

run_implementation_ready_case() {
  local repo="$REPO_DIR/implementation-ready"
  init_repo "$repo"
  write_file "$repo/docs/superpowers/specs/2026-03-19-ready-design.md" <<'EOF'
# Ready Spec

**Workflow State:** CEO Approved
**Spec Revision:** 3
**Last Reviewed By:** plan-ceo-review
EOF
  write_file "$repo/docs/superpowers/plans/2026-03-19-ready.md" <<'EOF'
# Ready Plan

**Workflow State:** Engineering Approved
**Source Spec:** `docs/superpowers/specs/2026-03-19-ready-design.md`
**Source Spec Revision:** 3
**Last Reviewed By:** plan-eng-review
EOF

  run_case "implementation ready summary" "$repo" status --refresh --summary
  run_case "implementation ready resolve" "$repo" resolve
}

run_draft_spec_case
run_approved_spec_no_plan_case
run_implementation_ready_case

echo "workflow-status legacy/bundled equivalence checks passed."
