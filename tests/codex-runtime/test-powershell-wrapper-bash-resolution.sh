#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HELPER="$REPO_ROOT/bin/superpowers-pwsh-common.ps1"
WORKFLOW_WRAPPER="$REPO_ROOT/bin/superpowers-workflow-status.ps1"

pwsh_bin="$(command -v pwsh || command -v powershell || true)"
if [[ -z "$pwsh_bin" ]]; then
  echo "Skipping PowerShell wrapper bash-resolution test: no pwsh or powershell binary found."
  exit 0
fi

tmp_root="$(mktemp -d)"
trap 'rm -rf "$tmp_root"' EXIT

generic_dir="$tmp_root/generic"
git_cmd_dir="$tmp_root/Git/cmd"
git_bin_dir="$tmp_root/Git/bin"
override_dir="$tmp_root/override"

mkdir -p "$generic_dir" "$git_cmd_dir" "$git_bin_dir" "$override_dir"

cat > "$generic_dir/bash" <<'SH'
#!/bin/bash
exit 0
SH

cat > "$git_cmd_dir/git" <<'SH'
#!/bin/bash
exit 0
SH

cat > "$git_bin_dir/bash.exe" <<'SH'
#!/bin/bash
exit 0
SH

cat > "$override_dir/bash" <<'SH'
#!/bin/bash
exit 0
SH

chmod +x "$generic_dir/bash" "$git_cmd_dir/git" "$git_bin_dir/bash.exe" "$override_dir/bash"

selected="$(
  PATH="$generic_dir:$git_cmd_dir:$PATH" \
    "$pwsh_bin" -NoLogo -NoProfile -Command ". '$HELPER'; Get-SuperpowersBashPath"
)"
if [[ "$selected" != "$git_bin_dir/bash.exe" ]]; then
  echo "Expected PowerShell helper to prefer Git Bash over a generic bash on PATH"
  echo "Actual selection: $selected"
  exit 1
fi

selected="$(
  PATH="$generic_dir:$git_cmd_dir:$PATH" \
    SUPERPOWERS_BASH_PATH="$override_dir/bash" \
    "$pwsh_bin" -NoLogo -NoProfile -Command ". '$HELPER'; Get-SuperpowersBashPath"
)"
if [[ "$selected" != "$override_dir/bash" ]]; then
  echo "Expected SUPERPOWERS_BASH_PATH to override wrapper bash resolution"
  echo "Actual selection: $selected"
  exit 1
fi

if [[ ! -f "$WORKFLOW_WRAPPER" ]]; then
  echo "Expected workflow-status PowerShell wrapper to exist: $WORKFLOW_WRAPPER"
  exit 1
fi

bash_log="$tmp_root/workflow-wrapper-bash.log"
cat > "$git_bin_dir/bash.exe" <<'SH'
#!/bin/bash
set -euo pipefail

log_file="${SUPERPOWERS_TEST_BASH_LOG:?}"
: > "$log_file"
for arg in "$@"; do
  printf '%s\n' "$arg" >> "$log_file"
done

if [[ "${1:-}" == *"superpowers-workflow-status" ]]; then
  printf '{"status":"needs_brainstorming","next_skill":"superpowers:brainstorming","root":"/c/tmp/workspace"}\n'
fi
SH
chmod +x "$git_bin_dir/bash.exe"

wrapper_output="$(
  PATH="$generic_dir:$git_cmd_dir:$PATH" \
    SUPERPOWERS_TEST_BASH_LOG="$bash_log" \
    "$pwsh_bin" -NoLogo -NoProfile -Command "& '$WORKFLOW_WRAPPER' status --refresh"
)"
if [[ "$wrapper_output" != *'"root":"C:\\tmp\\workspace"'* ]]; then
  echo "Expected workflow-status wrapper to convert JSON root field to Windows path"
  echo "Actual output: $wrapper_output"
  exit 1
fi

first_arg="$(sed -n '1p' "$bash_log")"
second_arg="$(sed -n '2p' "$bash_log")"
third_arg="$(sed -n '3p' "$bash_log")"
if [[ "$first_arg" != *"/bin/superpowers-workflow-status" ]]; then
  echo "Expected wrapper to invoke Git Bash with the workflow-status bash script"
  echo "Actual first arg: $first_arg"
  exit 1
fi
if [[ "$second_arg" != "status" || "$third_arg" != "--refresh" ]]; then
  echo "Expected wrapper to forward CLI arguments to bash script"
  echo "Actual args:"
  cat "$bash_log"
  exit 1
fi

cat > "$git_bin_dir/bash.exe" <<'SH'
#!/bin/bash
exit 7
SH
chmod +x "$git_bin_dir/bash.exe"

set +e
PATH="$generic_dir:$git_cmd_dir:$PATH" \
  "$pwsh_bin" -NoLogo -NoProfile -Command "& '$WORKFLOW_WRAPPER' status"
wrapper_exit=$?
set -e

if [[ $wrapper_exit -ne 7 ]]; then
  echo "Expected workflow-status wrapper to preserve nonzero bash exit code"
  echo "Expected: 7"
  echo "Actual:   $wrapper_exit"
  exit 1
fi

echo "PowerShell wrapper bash-resolution regression test passed."
