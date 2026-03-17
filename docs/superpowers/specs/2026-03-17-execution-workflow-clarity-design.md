# Execution Workflow Clarity

**Workflow State:** Draft
**Spec Revision:** 1
**Last Reviewed By:** brainstorming

## Summary

Add a small execution-stage runtime helper that keeps approved plan markdown truthful during implementation and makes execution handoffs opinionated instead of passive. The plan file becomes the authoritative record of execution progress, interrupted work, and resume state; the new helper enforces that contract and recommends either `superpowers:subagent-driven-development` or `superpowers:executing-plans` at handoff time.

This spec deliberately absorbs these active TODOs into one workflow project:

- `Enforce Plan Checklist State During Execution`
- `Execution Handoff Recommendation Flow`

## Problem

The current execution workflow has two related clarity failures:

1. Approved plans are written as executable checklists, but execution skills track progress in a separate task tracker and often leave the plan's `- [ ]` steps stale.
2. Execution handoff exposes both `superpowers:subagent-driven-development` and `superpowers:executing-plans`, but the user still has to infer which one fits the plan, session, and workspace constraints.

Those failures compound each other:

- if work is interrupted, the repo does not clearly show where execution stopped
- if a later agent resumes the work, it must reconstruct progress from commits, test output, or chat history
- if the handoff is vague, different agents can pick different execution paths for the same plan

The result is avoidable ambiguity at the exact point where Superpowers should be most operationally clear.

## Goals

- Make the approved plan markdown the single authoritative execution-state record.
- Enforce truthful checklist state during execution, not only at the very end.
- Preserve a simple binary checklist contract: `- [ ]` pending, `- [x]` complete.
- Make interrupted or blocked work explicit in the plan file without introducing a second progress ledger.
- Add an opinionated execution recommendation that still allows override.
- Keep the execution-state contract machine-parseable and easy to test.
- Preserve the existing workflow split:
  - `superpowers-workflow-status` owns routing up to `implementation_ready`
  - execution skills own implementation
  - `plan-eng-review` owns the execution handoff

## Not In Scope

- Replacing approved plans with manifest-authoritative execution state.
- Reworking the spec/plan approval workflow before `implementation_ready`.
- Introducing a full execution event log or local runtime progress database.
- Changing plan authoring away from markdown checklist steps.
- Automatically choosing an execution skill with no user-visible override.

## Existing Workflow Issues

Current behavior creates three concrete failure modes:

- A step is functionally done, but the plan still shows it unchecked.
- A step is partly done, but the plan gives no visible resume point.
- The handoff recommends both execution paths informally, so the real routing decision is deferred to later judgment instead of being expressed at handoff time.

These are workflow clarity issues, not architecture issues. The fix should harden the execution contract without introducing hidden local truth.

## Decisions

The design locks these decisions:

- One combined follow-up covers checklist enforcement and execution-handoff recommendation together.
- Enforcement is strict: execution state must remain accurate during execution, not only before final branch completion.
- The plan markdown is authoritative for execution state.
- The execution handoff is opinionated: recommend one path first, but still show the other valid option as an override.
- In-progress or blocked work does not get a third checkbox state.
- A started-but-incomplete step stays unchecked and gains one adjacent execution note.
- The helper should be a dedicated execution helper, not an overload of `superpowers-workflow-status`.

## Proposed Architecture

Add a new helper:

1. `bin/superpowers-plan-execution`
2. `bin/superpowers-plan-execution.ps1` for wrapper parity if this helper becomes a supported runtime surface

Responsibility split:

- `superpowers-workflow-status`
  - decides whether the workflow may proceed to execution
  - ends at `implementation_ready`
- `superpowers-plan-execution`
  - reads the exact approved plan path
  - validates execution-state syntax in the plan markdown
  - mutates plan checklist and execution-note state
  - recommends the default execution path

This keeps execution-state enforcement and execution recommendation in one place without creating another source of truth.

## Plan File Contract

Approved plan markdown remains the execution record.

Checklist rules:

- `- [ ]` means the step is not complete
- `- [x]` means the step is complete
- no third checklist state is introduced

If work starts on a step but stops before completion, the step stays unchecked and must include one adjacent execution note directly under that step:

```markdown
- [ ] **Step 3: Run the full helper regression suite**

  **Execution Note:** Interrupted - helper tests are partly green; resume by rerunning `bash tests/codex-runtime/test-superpowers-workflow-status.sh`
```

Rules for execution notes:

- allowed note states in v1: `Interrupted` and `Blocked`
- notes are only valid on unchecked steps
- checked steps must not retain execution notes
- each unchecked step may have at most one execution note
- notes must be adjacent to the step they describe
- orphan notes, duplicate notes, or malformed note prefixes are invalid execution state

This gives a readable and parseable resume contract while keeping the visible plan simple.

## Helper Contract

Suggested interface:

```text
superpowers-plan-execution status --plan <approved-plan-path>
superpowers-plan-execution recommend --plan <approved-plan-path>
superpowers-plan-execution complete --plan <approved-plan-path> --task <n> --step <n>
superpowers-plan-execution note --plan <approved-plan-path> --task <n> --step <n> --state interrupted|blocked --message <text>
```

Behavior:

- `status`
  - parses the approved plan
  - validates checklist and execution-note state
  - returns machine-readable execution-state information
- `recommend`
  - analyzes the plan and current session/workspace context
  - returns the recommended execution skill, alternate skill, and rationale
- `complete`
  - changes the exact step from `- [ ]` to `- [x]`
  - removes any adjacent execution note for that step
- `note`
  - leaves the step unchecked
  - creates or updates exactly one adjacent execution note

The helper must never persist execution progress outside the plan file.

## Enforcement Model

Execution is fail-closed once it begins.

Rules:

- execution preflight must validate the plan through `status`
- malformed execution state stops execution immediately
- after a step finishes, the execution skill must call `complete`
- if work is interrupted or blocked mid-step, the execution skill must call `note`
- any evidence of completed work not reflected in the plan is a workflow defect
- any checked step with an execution note is invalid
- any unresolved malformed execution state blocks further execution, review, and branch completion

Why strict enforcement:

- if a step fails midstream, the plan must still show the true resume point
- later agents should not have to reconstruct progress from commits or memory
- a strict rule is easier to enforce and test than “best effort” hygiene

## Recommendation Model

The execution recommendation is opinionated, not mandatory.

The helper should consider:

- whether tasks are mostly independent
- whether same-session execution is viable
- whether isolated-agent workflows are available in the current platform/session
- whether the workspace is already intentionally prepared for in-place execution

Default policy:

- recommend `superpowers:subagent-driven-development` when tasks are mostly independent and same-session isolated execution is viable
- recommend `superpowers:executing-plans` when work is tightly coupled, better coordinated by one agent, or intentionally being handed to a separate session

Suggested output fields:

- `recommended_skill`
- `alternate_skill`
- `reason`
- decision flags for debuggability

The handoff should present one recommended path first, then show the alternate valid option as an override.

## Skill Integration

### `plan-eng-review`

- calls `superpowers-plan-execution recommend --plan <approved-plan-path>` during execution handoff
- presents:
  - exact approved plan path
  - recommended skill
  - alternate valid skill
  - short rationale

### `subagent-driven-development`

- calls `status --plan ...` during preflight
- calls `complete` after each completed step
- calls `note` when work is interrupted or blocked
- must not treat an external task tracker as the authoritative execution-state record

### `executing-plans`

- adopts the same execution-state helper contract as `subagent-driven-development`
- differs only in session style, not in execution-state semantics

### `requesting-code-review`

- rejects final review if the plan has invalid execution state or required unfinished work not truthfully represented

### `finishing-a-development-branch`

- rejects branch-completion handoff if the approved plan is execution-dirty or malformed

### `writing-plans`

- keeps writing plans as checkbox-based execution documents
- documents helper-compatible checklist structure and execution-note syntax

### `using-superpowers`

- continues routing to execution at the workflow level
- does not take over the execution-skill recommendation logic

## Testing

Add a dedicated helper suite, likely:

- `tests/codex-runtime/test-superpowers-plan-execution.sh`

Required coverage:

- valid approved plan with untouched unchecked steps
- `complete` toggles only the requested step
- `note` writes or updates the adjacent execution note for the requested unchecked step
- checked steps reject execution notes
- duplicate notes and orphan notes fail validation
- malformed note state fails validation
- strict preflight failure on malformed execution state
- recommendation cases for mostly independent work vs tightly coupled work
- handoff-facing skill docs include the recommendation contract
- execution skills call the helper in preflight and on step transitions

Add skill/doc contract assertions so the execution skills and handoff skills stay aligned with the helper contract.

## Rollout

- Ship as an internal helper/runtime contract first.
- Do not introduce a separate execution manifest.
- Existing approved plans remain valid as authored.
- Execution notes appear only when execution has actually started and been interrupted or blocked.
- Update docs, tests, and release notes to describe:
  - plan markdown as the authoritative execution-state record
  - required execution notes for interrupted or blocked unchecked steps
  - opinionated execution-handoff recommendation

## TODOs Pulled Into Scope

This spec absorbs and should eventually resolve these active TODOs in `TODOS.md`:

- `Enforce Plan Checklist State During Execution`
- `Execution Handoff Recommendation Flow`

The separate `Supported User-Facing Workflow CLI` TODO remains out of scope.

## Success Criteria

This work is successful when:

- an interrupted execution always leaves a clear resume point in the approved plan
- execution skills cannot silently drift from plan checklist truth
- the handoff presents one recommended execution path plus one explicit override
- later agents can determine real execution state from the plan file alone
- no local runtime execution ledger is required to understand what is complete
