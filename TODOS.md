# TODOS

## Review

### Harden Session-Entry Bootstrap And Branch-Safety Guarantees

**What:** Add true end-to-end enforcement and regression coverage so Superpowers cannot skip the first-turn `using-superpowers` bypass/opt-in gate and cannot write repo artifacts or commit on `main` or another protected branch without an explicit, auditable escape hatch.

**Why:** This session exposed two concrete guarantee gaps at once: the initial opt-in question did not appear before normal Superpowers behavior, and repo-writing work reached `main` before being pulled back to a feature branch. Recent workflow commits strengthened the helper-backed state machine after bootstrap, but they did not harden the bootstrap boundary or branch-safety preflight enough to make those guarantees real in the outer harness. If this remains soft, Superpowers will continue to over-promise “conservative workflow state machine” behavior at the exact points where users most expect it to be strict.

**Context:** The investigation in this session narrowed the problem precisely enough to turn into a targeted hardening item rather than a vague “make preflight better” note.

- What the recent commits did correctly:
  - `f683aef` added the dedicated `using-superpowers` bypass gate contract and the dedicated generated-doc bootstrap sections.
  - `7428349` tightened the actual workflow state machine by requiring source-spec path plus revision matching, and `bin/superpowers-plan-execution` now rejects same-revision stale source-spec path cases.
  - The checked-in helper-backed workflow routing and execution-state checks therefore do not look weakened; they are stricter than before once those helpers are in control.

- What the current tests still do not prove:
  - `tests/codex-runtime/test-using-superpowers-bypass.sh` validates generated-doc wording plus shell decision-path derivation, but it does not prove that a fresh real session actually routes through `using-superpowers` before the first assistant response.
  - The routing eval intentionally starts after the bypass decision is already pre-seeded to `enabled`, so it explicitly does not cover the first-turn opt-in question.
  - There is no end-to-end gate today that fails when the outer harness neglects to load the `using-superpowers` entry skill before normal conversation behavior begins.

- What the session evidence says the real gap is:
  - The weakness is at entry into the state machine, not in the helper-backed state machine itself.
  - Branch/worktree safety is still mostly instructional and skill-driven. `using-git-worktrees` is optional/manual, and there is no single helper-backed preflight that says “this workflow stage is about to write repo state; refuse to continue on `main` unless the user explicitly approved that risk.”
  - That means a user can reasonably believe Superpowers will protect them from first-turn bootstrap drift and protected-branch writes, while the current implementation only protects them after the workflow runtime is already active.

- Required design scope for the follow-up:
  - Define a single bootstrap invariant: before any normal Superpowers work happens, the runtime must either ask the bypass/opt-in question, honor an existing valid decision file, or honor an explicit re-entry request. Any other path is a contract violation.
  - Decide where that invariant is enforced for real: generator output alone is not enough if the outer harness can skip it. The fix may need a harness-facing shim, an integration contract test surface, or another runtime-owned entrypoint that the platform must call.
  - Add a single repo-writing branch-safety preflight shared by all workflow stages that can mutate repo state or commit. At minimum, this includes spec writing/review approval writes, plan writing/review approval writes, execution flows, release-doc flows, and branch-finishing flows.
  - Make the branch-safety rule fail closed on `main` and any configured protected branches unless one of the following is true:
    - the user explicitly approved writing on that branch for the current task
    - the workflow stage is read-only
    - the task is running in an approved feature branch or dedicated worktree
  - Ensure the rule is auditable: the escape hatch should be explicit in output and testable, not hidden in vague prompt wording.
  - Keep the safety boundary narrow enough that it does not block legitimate read-only inspection flows such as `superpowers-workflow`, `superpowers-workflow-status`, and non-writing review/investigation work.

- Concrete implementation expectations:
  - Introduce a runtime-owned preflight contract for “session entry” and another for “repo-writing branch safety,” rather than scattering more prose rules across many skills.
  - Update the generated `using-superpowers` contract to reference the stronger bootstrap owner and failure behavior.
  - Update all repo-writing workflow skills to call the shared branch-safety preflight before they create artifacts, mutate approval headers, or commit.
  - Decide whether protected-branch detection is hardcoded to `main` initially or configurable through existing repo/user instructions. Default should remain conservative.
  - Ensure branch-safety checks do not silently auto-create worktrees or auto-switch branches; they should stop, explain, and route to `using-git-worktrees` or explicit user approval.

- Regression coverage expectations:
  - Add at least one end-to-end first-turn integration gate that fails if a fresh session with no decision file does not emit the bypass/opt-in question before normal Superpowers behavior.
  - Add explicit coverage for valid `enabled`, valid `bypassed`, malformed decision-file content, and explicit re-entry when persistence fails.
  - Add branch-safety tests proving repo-writing stages fail on `main` by default, allow safe feature-branch execution, and allow explicit user-approved override only when the contract says they may.
  - Add negative tests proving read-only workflow helpers are not accidentally blocked by the new branch-safety gate.
  - Update docs and testing guidance so the distinction is explicit:
    - helper-backed workflow state machine guarantees
    - bootstrap-entry guarantees
    - protected-branch preflight guarantees

- Acceptance criteria for completion:
  - A fresh session cannot enter normal Superpowers workflow behavior without first resolving the bypass gate.
  - A missing or malformed session decision state is fail-closed and visible in tests.
  - Repo-writing workflow stages cannot mutate repo state or commit on `main` by accident.
  - The escape hatch for protected-branch writes is explicit, narrow, and logged/testable.
  - The existing workflow-state helper guarantees remain intact and are not diluted into soft prompt guidance.
  - The new tests would have caught both failures seen in this session.

**Effort:** XL
**Priority:** P0
**Depends on:** None

### Revisit Borrowed-Layer Drift Policy If Gstack Surface Grows

**What:** Re-evaluate whether Superpowers needs an explicit recurring review policy for gstack-derived borrowed-layer drift if more upstream surface area continues landing here.

**Why:** The current alignment spec intentionally stays narrow and tactical. If the borrowed layer keeps expanding, relying on one-off comparisons may stop being disciplined enough.

**Context:** Deferred explicitly by `docs/superpowers/specs/2026-03-18-gstack-borrowed-layer-alignment-design.md`. This is not required for the current change and should stay out of the initial implementation plan.

**Effort:** S
**Priority:** P3
**Depends on:** Shipping and operating the current 4-item alignment package first

### Public Inspection Surface For Accelerator Packets

**What:** Add a supported CLI or status/debug surface for persisted accelerated-review packets, resume eligibility, stale-fingerprint reasons, and retention state.

**Why:** Once accelerated CEO/ENG review ships, operators will eventually need a safer and clearer way to inspect saved review state than reading raw files under `~/.superpowers/projects/...`.

**Context:** The approved review-accelerator design intentionally keeps persisted packet state inside skill instructions, markdown artifacts, and deterministic tests. This should stay out of the current PR, but after real usage we should decide whether `superpowers-workflow` or `superpowers-workflow-status` needs a read-only inspection surface for packet history, resume diagnostics, and cleanup visibility.

**Effort:** M
**Priority:** P3
**Depends on:** Shipping and exercising the core accelerated review flow first

## Completed

### Supported User-Facing Workflow CLI

Completed in the workflow runtime. Superpowers now ships `bin/superpowers-workflow` and `bin/superpowers-workflow.ps1` as the supported public read-only inspection CLI for `status`, `next`, `artifacts`, `explain`, and `help`, backed by the side-effect-free internal `resolve` path in `bin/superpowers-workflow-status`.

### Enforce Plan Checklist State During Execution

Completed in the execution-workflow helper plus execution/review workflow skills. Execution now flips approved-plan step checkboxes through `superpowers-plan-execution`, the execution skills treat the approved plan checklist as the execution progress record, and the review/branch-finish gates fail closed when checked steps or evidence drift out of truth.

### Execution Handoff Recommendation Flow

Completed in the execution-workflow helper. `superpowers-plan-execution recommend --plan <approved-plan-path>` now derives `tasks_independent` from task `**Files:**` write scopes, combines that with the session-context inputs, and recommends either `superpowers:subagent-driven-development` or `superpowers:executing-plans` through the approved handoff flow.
