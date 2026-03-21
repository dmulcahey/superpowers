# Skill-Layer Delivery Governance

**Workflow State:** Draft
**Spec Revision:** 1
**Last Reviewed By:** brainstorming

## Summary

Incorporate the highest-value parts of the delivery SOP into Superpowers without changing the current runtime authority model.

This change is intentionally narrow:

1. keep spec, plan, and execution truth exactly where they already live
2. raise the quality bar through stronger skill guidance and approval-blocking review criteria
3. update a small set of docs, tests, and reference artifacts so the new standard is visible and durable

The approved direction for this project is:

- skill-layer only, not helper-backed workflow expansion
- approval-blocking review criteria, not advisory-only guidance
- update active reference artifacts, not broad historical backfill

## Problem

Superpowers already has strong workflow governance for routing, approvals, stale-plan detection, and execution evidence, but it is uneven in one important way: the quality bar for what a good spec or plan must contain is not yet consistently enforced.

Today:

- the runtime enforces exact approval headers and conservative stage routing
- execution truth is strict and fail-closed
- many checked-in specs and plans are already high quality
- but the workflow does not consistently require explicit treatment of interfaces, failure behavior, observability, rollout, rollback, risks, and acceptance criteria
- the repo does not yet express those expectations as a durable contributor standard across the relevant skills, docs, and examples

That gap matters because Superpowers is strongest when repo truth is simple and fail-closed while human review is rigorous. Missing delivery-content expectations weaken the written artifacts without any runtime failure ever surfacing it.

## Goals

- Preserve the current Superpowers runtime boundary and authority model.
- Raise the minimum quality bar for written specs before CEO approval.
- Raise the minimum quality bar for written plans before engineering approval.
- Make richer delivery content approval-blocking at review time without making authored markdown parser-fragile.
- Add lightweight domain overlays that sharpen review and QA expectations by change type.
- Strengthen release-readiness expectations through existing skills rather than new authoritative artifact classes.
- Update docs, tests, and a small number of reference artifacts so the new standard is discoverable in-repo.

## Not In Scope

- Extending `superpowers-workflow-status` beyond its current product-workflow boundary.
- Extending `superpowers-plan-execution` into review, QA, release, or closeout state ownership.
- Adding new authoritative artifact classes such as `reviews/`, `releases/`, or `retros/`.
- Replacing the current exact-header markdown contract with YAML-frontmatter approval state.
- Broad historical backfill of all existing checked-in specs and plans.
- Changing the current execution handoff boundary at `implementation_ready`.

## Architecture Boundary

This change preserves the current Superpowers authority model:

- spec approval truth remains the exact spec headers in repo docs
- plan approval truth remains the exact plan headers in repo docs
- execution truth remains the approved plan checklist plus execution evidence
- branch-scoped manifests remain rebuildable local indexes, not approval authorities

No runtime helper becomes responsible for broader delivery lifecycle state. In particular:

- `superpowers-workflow-status` continues to reason only about bootstrap, spec, plan, and implementation handoff state
- `superpowers-plan-execution` continues to own only execution-state truth after an approved plan handoff
- `implementation_ready` remains the terminal routing state before execution handoff

The delivery SOP is incorporated through skill behavior, review expectations, documentation, and examples rather than through expanded helper-owned state.

## Existing Context

The existing Superpowers workflow already provides the right substrate for this work:

- `brainstorming` writes draft specs and hands off to CEO review
- `plan-ceo-review` owns written-spec approval
- `writing-plans` writes draft implementation plans from CEO-approved specs
- `plan-eng-review` owns plan approval and execution handoff
- `document-release` audits documentation and release-history changes after implementation
- `finishing-a-development-branch` already enforces review and execution-state gates before completion

This means the right abstraction is to improve what those stages require from human-authored artifacts, not to invent parallel workflow state.

## Proposed Changes

### 1. Stronger Spec Expectations

Update `brainstorming` so its design output guidance explicitly expects the written spec to cover:

- scope and out-of-scope
- affected users, systems, and interfaces
- current versus desired behavior when relevant
- failure and edge-case behavior
- observability expectations
- rollout and rollback expectations
- risks and mitigations
- testable acceptance criteria

These expectations are content requirements for the written artifact, not new approval headers.

### 2. CEO Review As the Approval Gate for Delivery Content

Update `plan-ceo-review` so approval is blocked when a written spec materially lacks:

- clear scope boundaries
- explicit failure-mode thinking
- observability expectations when new behavior or operations are introduced
- rollout and rollback expectations
- credible risks
- testable acceptance criteria

The written spec may vary in section naming or exact prose shape as long as the content is present and reviewable.

### 3. Stronger Plan Expectations

Update `writing-plans` so implementation plans explicitly cover:

- change surface
- preconditions
- execution strategy
- evidence expectations
- validation strategy
- documentation updates
- rollout plan
- rollback plan
- risks and mitigations

The existing exact plan header contract stays unchanged.

### 4. ENG Review As the Approval Gate for Plan Readiness

Update `plan-eng-review` so engineering approval is blocked when a plan materially lacks:

- a clear change surface
- meaningful validation strategy
- documentation update expectations
- rollout and rollback thinking
- evidence expectations for meaningful work slices
- explicit risks where the planned change introduces operational, architectural, or delivery risk

This enforcement remains review-based, not parser-based. Missing content blocks approval; alternate heading names do not.

### 5. Domain Overlays As Review Guidance

Add lightweight domain overlays to sharpen review and QA expectations by change type.

Initial overlays:

- web/UI
- API/service/backend
- data/ETL
- infrastructure/IaC
- library/SDK

These overlays do not become standalone workflow stages or standalone artifact classes. They are review lenses that help:

- `plan-eng-review` ask better domain-specific questions
- `qa-only` receive more useful handoff guidance
- contributors understand what domain-specific completeness looks like

### 6. Release-Readiness Through Existing Skills

Strengthen `document-release` with an explicit release-readiness pass that checks for:

- refreshed docs where behavior changed
- release notes or equivalent release-history updates where appropriate
- rollout notes when the change meaningfully affects release or operations
- rollback notes when rollback is non-trivial
- known risks or operator-facing caveats when they matter

Optionally strengthen `finishing-a-development-branch` so it reminds the agent to confirm that release-facing documentation has been handled when the diff clearly warrants it.

Neither change introduces a new authoritative release artifact.

## Skill-by-Skill Ownership

### `brainstorming`

- owns producing richer draft specs
- does not own approving them
- does not change runtime helper behavior

### `plan-ceo-review`

- owns approval of the richer written spec
- blocks approval when required delivery content is materially missing
- does not change the exact approval header contract

### `writing-plans`

- owns producing richer implementation plans from approved specs
- keeps the current exact plan header contract
- does not create new workflow state or artifact types

### `plan-eng-review`

- owns approval of the richer written plan
- applies domain overlays as review lenses
- writes better QA handoff artifacts where applicable
- does not change execution-state ownership

### `document-release`

- owns the stronger release-readiness documentation pass
- remains conservative and diff-driven
- does not become an approval authority

### `finishing-a-development-branch`

- may reinforce that release-facing documentation was handled
- remains downstream of review/execution truth
- does not become a new delivery-state router

## Review Model

The enforcement model for this project is:

- approval-blocking review criteria
- flexible authored markdown structure
- unchanged parser-critical headers

This means:

- reviewers must fail closed when key delivery content is absent
- contributors may express that content with different section names when the material is still explicit and reviewable
- runtime helpers do not parse new freeform content areas

That balance preserves Superpowers' strongest current property: simple, exact machine-readable workflow truth with richer human review discipline layered on top.

## Docs, Tests, and Reference Artifacts

### Tests

Update workflow-contract tests so they assert that the relevant skills now require richer delivery content.

Primary test surfaces:

- `tests/codex-runtime/test-workflow-sequencing.sh`
- `tests/codex-runtime/test-runtime-instructions.sh`

The tests should verify skill-contract presence and doc-surface alignment, not exact user-authored markdown section names inside arbitrary specs or plans.

No new helper-state regression matrix is required because helper behavior is intentionally unchanged.

### Docs

Update contributor-facing docs, including `README.md`, so the repo explains:

- the runtime authority model is unchanged
- the workflow now expects richer spec and plan content
- review approval blocks on missing delivery-critical content

### Reference Artifacts

Update a small set of active checked-in examples so the new standard is visible in-repo.

The reference-artifact update policy for this change is:

- prefer active or recent examples
- update only a small representative set
- avoid broad historical cleanup

## Failure Modes

| Failure mode | Handling |
| --- | --- |
| A spec has correct approval headers but omits rollout, rollback, or acceptance criteria | `plan-ceo-review` must keep it in `Draft` until fixed |
| A plan has correct headers but weak validation or missing rollout/rollback thinking | `plan-eng-review` must keep it in `Draft` until fixed |
| A spec or plan uses different headings but still contains the required material | approval may proceed |
| Contributors assume runtime helpers will enforce the new content | docs and skill text must state clearly that enforcement is review-based |
| Domain overlays grow into parallel workflow stages | reject; overlays remain guidance inside existing review skills |
| This work accidentally expands runtime ownership | reject; helpers and routing boundaries remain unchanged |

## Rollout

Roll this out in one focused workflow change:

1. update the relevant skills and generated skill docs
2. update the contributor-facing docs
3. update workflow contract tests
4. update a small set of representative reference artifacts

There is no runtime-state migration, manifest migration, or execution migration required.

## Rollback

Rollback is straightforward because this project does not change helper-owned state:

- revert the skill/doc/test/reference-artifact changes
- keep existing runtime helpers unchanged
- no delivery-state repair is required

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The new expectations become vague prompt bloat instead of a real review gate | Medium | High | Make the criteria explicit in `plan-ceo-review` and `plan-eng-review`, and back them with workflow tests |
| The repo drifts into parser-enforced prose structure accidentally | Medium | Medium | Preserve the current exact-header contract and state clearly that new sections are review-enforced, not parser-enforced |
| Contributors do not see examples of the new standard | Medium | Medium | Update a small set of active reference artifacts |
| The work expands into runtime-state redesign | Low | High | Keep helper binaries and state-machine boundaries explicitly out of scope |

## Acceptance Criteria

1. Superpowers skills for brainstorming, CEO review, plan writing, ENG review, and release documentation explicitly require the new delivery-content areas appropriate to their stage.
2. CEO and ENG approval guidance fails closed on materially missing delivery-critical content while preserving the current exact approval-header contracts.
3. The runtime helpers and workflow-state machine remain unchanged in scope and authority.
4. Contributor-facing docs explain the richer workflow expectations without implying new helper-owned state.
5. Workflow-contract tests are updated to enforce the new skill/doc expectations.
6. A small set of active reference artifacts is updated so the new standard is visible in-repo.

## Open Questions

- Whether `finishing-a-development-branch` should only remind about release-readiness or should also contain an explicit lightweight checklist.
- Which current spec/plan examples are the best representative artifacts to update in the first pass.

## Decision Log

### Revision 1

- Preserve the current runtime boundary at `implementation_ready`
- Implement the SOP incorporation at the skill layer only
- Make the new delivery-content requirements approval-blocking review criteria
- Update a small set of active reference artifacts instead of doing a broad historical backfill
