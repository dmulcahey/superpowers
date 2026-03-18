#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKFLOW_BIN="$REPO_ROOT/bin/superpowers-workflow"
STATUS_BIN="$REPO_ROOT/bin/superpowers-workflow-status"
STATE_DIR="$(mktemp -d)"
REPO_DIR="$(mktemp -d)"
trap 'rm -rf "$STATE_DIR" "$REPO_DIR"' EXIT
export SUPERPOWERS_STATE_DIR="$STATE_DIR"

# cover:
# - status / next / artifacts / explain / help
# - every supported workflow state
# - outside-repo failure
# - --debug output
# - non-mutation of repo docs and manifest files

require_helpers() {
  if [[ ! -x "$WORKFLOW_BIN" ]]; then
    echo "Expected workflow CLI to exist and be executable: $WORKFLOW_BIN"
    exit 1
  fi
  if [[ ! -x "$STATUS_BIN" ]]; then
    echo "Expected internal workflow helper to exist and be executable: $STATUS_BIN"
    exit 1
  fi
}

assert_contains() {
  local output="$1"
  local expected="$2"
  local label="$3"
  if [[ "$output" != *"$expected"* ]]; then
    echo "Expected ${label} output to contain '${expected}'"
    printf '%s\n' "$output"
    exit 1
  fi
}

assert_same_bytes() {
  local before="$1"
  local after="$2"
  local label="$3"
  if ! cmp -s "$before" "$after"; then
    echo "Expected ${label} to remain byte-identical"
    exit 1
  fi
}

run_command_fails() {
  local repo_dir="$1"
  local label="$2"
  local expected_output="$3"
  local output
  local status=0
  shift 3
  output="$(cd "$repo_dir" && "$WORKFLOW_BIN" "$@" 2>&1)" || status=$?
  if [[ $status -eq 0 ]]; then
    echo "Expected command to fail for: $label"
    printf '%s\n' "$output"
    exit 1
  fi
  if [[ -n "$expected_output" && "$output" != *"$expected_output"* && "${output,,}" != *"${expected_output,,}"* ]]; then
    echo "Expected failure output for ${label} to mention '${expected_output}'"
    printf '%s\n' "$output"
    exit 1
  fi
}

init_repo() {
  local repo_dir="$1"

  mkdir -p "$repo_dir"
  git -C "$repo_dir" init >/dev/null 2>&1
  git -C "$repo_dir" config user.name "Superpowers Test"
  git -C "$repo_dir" config user.email "superpowers-tests@example.com"
  printf '# workflow CLI regression fixture\n' > "$repo_dir/README.md"
  git -C "$repo_dir" add README.md
  git -C "$repo_dir" commit -m "init" >/dev/null 2>&1
}

snapshot_if_exists() {
  local path="$1"
  local snapshot="$2"
  if [[ -e "$path" ]]; then
    cp "$path" "$snapshot"
  else
    : > "$snapshot"
  fi
}

run_no_manifest_creation() {
  local repo="$REPO_DIR/no-manifest-creation"
  local manifest_path="$STATE_DIR/no-manifest-creation.json"
  init_repo "$repo"

  if [[ -e "$manifest_path" ]]; then
    echo "Expected no test manifest before running command"
    exit 1
  fi

  (cd "$repo" && "$WORKFLOW_BIN" status >/dev/null 2>&1) || true

  if [[ -e "$manifest_path" ]]; then
    echo "Expected public status command to avoid creating a manifest"
    exit 1
  fi
}

run_corrupt_manifest_no_backup() {
  local repo="$REPO_DIR/corrupt-manifest"
  local manifest_path="$STATE_DIR/corrupt-manifest.json"
  local before_snapshot="$REPO_DIR/corrupt-before.json"
  init_repo "$repo"
  printf '%s\n' '{ "broken": true' > "$manifest_path"
  snapshot_if_exists "$manifest_path" "$before_snapshot"

  (cd "$repo" && "$WORKFLOW_BIN" status >/dev/null 2>&1) || true

  assert_same_bytes "$before_snapshot" "$manifest_path" "corrupt manifest"
  if compgen -G "${manifest_path}.corrupt-*" >/dev/null; then
    echo "Expected public CLI to avoid writing corrupt manifest backups"
    exit 1
  fi
}

run_existing_manifest_unchanged() {
  local repo="$REPO_DIR/existing-manifest"
  local manifest_path="$STATE_DIR/existing-manifest.json"
  local before_snapshot="$REPO_DIR/existing-before.json"
  init_repo "$repo"
  printf '%s\n' '{"version":1,"status":"needs_brainstorming"}' > "$manifest_path"
  snapshot_if_exists "$manifest_path" "$before_snapshot"

  (cd "$repo" && "$WORKFLOW_BIN" artifacts >/dev/null 2>&1) || true

  assert_same_bytes "$before_snapshot" "$manifest_path" "existing manifest"
}

run_repo_docs_unchanged() {
  local repo="$REPO_DIR/repo-docs-unchanged"
  local spec_path="$repo/docs/superpowers/specs/2026-03-18-red-spec.md"
  local spec_snapshot="$REPO_DIR/repo-docs-before.md"
  init_repo "$repo"
  mkdir -p "$(dirname "$spec_path")"
  cat > "$spec_path" <<'EOF'
# Red Spec

**Workflow State:** Draft
**Spec Revision:** 1
**Last Reviewed By:** brainstorming
EOF
  snapshot_if_exists "$spec_path" "$spec_snapshot"

  (cd "$repo" && "$WORKFLOW_BIN" explain >/dev/null 2>&1) || true

  assert_same_bytes "$spec_snapshot" "$spec_path" "repo-tracked spec"
}

run_outside_repo_status_failure() {
  local outside_repo="$REPO_DIR/outside-repo"
  mkdir -p "$outside_repo"

  run_command_fails "$outside_repo" "outside repo status" "repo" status
}

run_invalid_command_failure() {
  local repo="$REPO_DIR/invalid-command"
  init_repo "$repo"

  run_command_fails "$repo" "invalid command" "Unsupported" nonsense
}

run_debug_failure_class() {
  local repo="$REPO_DIR/debug-failure"
  init_repo "$repo"

  local output
  local status=0
  output="$(cd "$repo" && env SUPERPOWERS_WORKFLOW_RESOLVE_TEST_FAILPOINT=runtime_failure "$WORKFLOW_BIN" status --debug 2>&1)" || status=$?
  if [[ $status -eq 0 ]]; then
    echo "Expected debug failure-class scenario to fail"
    printf '%s\n' "$output"
    exit 1
  fi
  assert_contains "$output" "failure_class" "debug failure-class output"
}

require_helpers

echo "workflow CLI regression scaffold not implemented yet"
exit 1
