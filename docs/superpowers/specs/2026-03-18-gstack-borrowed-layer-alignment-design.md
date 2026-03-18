# Gstack Borrowed Layer Alignment
**Workflow State:** Draft
**Spec Revision:** 1
**Last Reviewed By:** brainstorming

## Summary

Selectively align four recent `gstack` improvements into Superpowers' already-borrowed runtime/skill layer without changing Superpowers' workflow authority model:

1. more natural trigger-phrase skill descriptions
2. a shared repo/branch slug helper
3. fresher update-check cache behavior with `--force`
4. shared branch grounding in the generated preamble

This is a narrow alignment spec. It does not create an ongoing upstream-sync policy, does not expand Superpowers into newer `gstack` product surfaces, and does not weaken helper-owned workflow routing.

## Problem

Superpowers already includes a borrowed-from-`gstack` layer: shared preamble behavior, runtime helper patterns, and some skill/review assets. That layer has diverged in healthy ways where Superpowers added stronger workflow-state ownership, explicit artifact contracts, execution evidence, and supported helper boundaries.

But the divergence is uneven. Recent `gstack` changes surfaced four improvements that would materially help Superpowers without requiring a broader product shift:

- descriptions that better match real user phrasing
- centralized repo/branch identity derivation
- fresher release visibility in update checks
- consistent branch capture in the shared preamble

Today those areas are split across templates, generated docs, and helpers in a way that creates avoidable drift:

- some skill descriptions are still more formal than users' actual requests
- repo slug and sanitized branch derivation are duplicated in multiple places
- update-check caching is coarser than it needs to be for release visibility
- branch grounding is not consistently provided from one shared runtime source

The goal is not "make Superpowers more like `gstack`." The goal is to absorb the useful parts of recent upstream changes into the borrowed layer while preserving the reasons Superpowers intentionally diverged.

## Goals

- Improve skill discoverability from natural language without changing workflow-stage authority.
- Centralize repo slug and sanitized branch derivation behind one shared helper.
- Make release detection fresher while preserving Superpowers-specific semver handling.
- Provide one shared branch-grounding source for generated skill preambles.
- Keep this work as a narrow alignment package with a minimal diff.

## Not In Scope

- A general upstream-sync policy for future `gstack` changes.
- Importing newer `gstack` product surfaces such as office hours, design review, or design consultation flows.
- Changing workflow stages, approval rules, or execution recommendation semantics.
- Making a new public slug CLI contract in v1.
- Replacing Superpowers' current semver comparison or local-ahead behavior.
- Using branch identity as an approval signal.

## Existing Context

Superpowers already has the key architectural boundaries this spec must preserve:

- `bin/superpowers-workflow-status`, `bin/superpowers-workflow`, and `bin/superpowers-plan-execution` own workflow progression and execution-state authority.
- generated skill docs come from `scripts/gen-skill-docs.mjs` and template `SKILL.md.tmpl` files
- the shared preamble already centralizes runtime root detection, update checks, and session bookkeeping
- repo-relative specs and plans remain the approval record; local manifests are rebuildable indexes

This matters because the four changes belong to different ownership layers:

- description matching belongs to templates and routing tests
- repo/branch identity belongs to shared helper logic and generated preambles
- update freshness belongs to `bin/superpowers-update-check`
- workflow progression stays where it already lives

## Design Principles

### Preserve Workflow Authority

The workflow helpers remain the only authority for stage progression. A skill description may help the agent notice a candidate skill, but it may not become an alternate router.

### Align At The Right Boundary

Take useful `gstack` behavior only at the layer Superpowers actually owns:

- templates/frontmatter for discovery text
- shared helper/generator layer for repo and branch identity
- update-check helper for release freshness

Do not import broader behavior from unrelated `gstack` product surfaces.

### Fail Closed

When alignment work touches routing-sensitive areas, the system must prefer the earlier safe stage over guessing. This especially applies to Item 1.

### Keep The Diff Small

Prefer centralization over new abstractions. This spec should remove duplication and tighten contracts, not create a large new subsystem.

## Dream State Delta

```text
CURRENT STATE                         THIS SPEC                               12-MONTH IDEAL
partial borrowed-layer drift          narrow borrowed-layer alignment          intentional sync policy only if the
and duplicated identity logic         with helper-owned workflow preserved     borrowed surface keeps expanding
```

## Proposed Architecture

This spec adds or changes behavior in three places:

1. template/generator layer
2. shared helper layer
3. update-check helper layer

It explicitly does not add a new workflow-routing authority.

### Ownership Diagram

```text
user request
   |
   v
using-superpowers
   |
   v
workflow helpers ------------------------------+
   |                                           |
   | owns stage progression                    |
   |                                           |
   +--> template descriptions (candidate only) |
   +--> generated preamble (_BRANCH grounding) |
   +--> shared slug helper                     |
   +--> update-check freshness                 |
```

### Authority Rule

```text
description text -> suggests a skill candidate
workflow helper  -> decides whether that skill is valid now
approved docs    -> decide approval state
execution helper -> decides execution handoff path
```

## Proposed Changes

### 1. Trigger-Phrase Skill Descriptions

Rewrite selected `description:` fields in template frontmatter so they better match natural user phrasing, but only within strict classes:

- broad-safe skills may gain broader natural-language triggers
- stage-gated skills may gain natural phrasing only if they still name the prerequisite artifact or approval state
- execution/completion skills must remain clearly post-approval and post-implementation

This allows better discovery for requests like "review this implementation plan" or "qa this without fixing anything" while keeping generic phrases like "build this" or "start implementing" away from late-stage skills.

#### Hard Constraints

- descriptions may not authorize a workflow transition
- late-stage skills must continue to encode prerequisites in the description text
- routing must still fail closed to the earliest safe stage when helper state disagrees with user wording

#### Explicit Non-Changes

- no new workflow status values
- no relaxation of helper-first routing
- no broadening of `plan-eng-review`, `executing-plans`, or `finishing-a-development-branch` into generic implementation triggers

### 2. Shared Repo/Branch Slug Helper

Add an internal `bin/superpowers-slug` helper that emits:

- `SLUG`
- `BRANCH`
- `SAFE_BRANCH`

This becomes the single source of truth for the narrow set of places that currently re-derive repo slug and sanitized branch names separately.

The helper is internal-first in v1. It exists to centralize identity derivation for runtime artifacts and skill-local shell snippets, not to create a new public CLI contract.

#### Primary Effect

- fewer duplicated regex fragments
- consistent artifact paths across workflow state, QA artifacts, and branch-finish flows
- easier future changes to slug sanitization rules because there is only one derivation point

#### Explicit Non-Changes

- no public compatibility promise for the helper output beyond internal use
- no repo fingerprint or UUID work in this spec
- no change to which artifacts are authoritative

### 3. Update-Check Freshness

Adopt the useful parts of `gstack`'s newer cache policy inside `bin/superpowers-update-check`:

- shorter TTL for cached `UP_TO_DATE`
- longer sticky TTL for cached `UPGRADE_AVAILABLE`
- explicit `--force` cache busting

Superpowers keeps the behavior it already does better:

- semver-aware version comparison
- normalization for versions with prefixes
- local-ahead handling
- existing snooze semantics unless tests force a targeted change

#### Primary Effect

- users learn about new releases sooner
- troubleshooting and direct refresh become easier with `--force`
- upgrade prompts stay informative without becoming noisy

#### Explicit Non-Changes

- no replacement of `compare_versions()`
- no change in ownership away from `bin/superpowers-update-check`
- no separate release-notification subsystem

### 4. Shared Branch Grounding In The Preamble

Extend the generated shared preamble so it captures `_BRANCH` once, centrally, instead of leaving branch discovery to scattered skill-local snippets.

This is a grounding improvement, not a workflow-state change. It makes interactive questions and branch-aware messaging more consistently anchored to the current checkout.

#### Primary Effect

- all generated skills have one shared branch context
- less duplicated shell in skill docs
- better branch grounding in long-lived or multi-session work

#### Explicit Non-Changes

- branch name is not an approval signal
- no new state-machine transitions
- no change to the branch-scoped manifest model

## Coupling And Sequencing

Items 2 and 4 should be designed and implemented together because both are really about shared repo/branch identity and grounding. Item 1 should come after that foundation because it is routing-sensitive and benefits from a cleaner shared preamble. Item 3 is comparatively isolated and can land after the routing-sensitive work.

Recommended sequence:

1. shared slug helper + generated `_BRANCH`
2. description alignment + routing guardrails
3. update-check freshness
4. regeneration, docs, and release notes

## Risks And Failure Modes

| Risk | Trigger | Failure Mode | Required Protection |
| --- | --- | --- | --- |
| Description drift becomes routing drift | broad late-stage wording | users get nudged toward later skills too early | wording constraints plus routing regressions |
| Internal helper becomes accidental public surface | docs or tests over-promote `superpowers-slug` | future compatibility burden | keep helper internal-first and document sparingly |
| Update freshness regresses current semantics | port mirrors `gstack` too literally | local-ahead or semver normalization breaks | preserve existing comparison logic and expand tests |
| Branch grounding leaks into workflow authority | `_BRANCH` is treated as more than context | approval semantics become muddled | keep branch capture informational only |

## Test And Verification Requirements

This spec requires deterministic coverage, and Item 1 also benefits from eval coverage.

### Deterministic Tests

- helper tests for `superpowers-slug` covering normal remotes, missing remotes, slash branches, and detached HEAD fallback
- contract tests that generated preambles include `_BRANCH`
- contract tests that late-stage skill descriptions still encode prerequisites
- update-check tests for `--force`, split TTL behavior, semver normalization, and local-ahead handling
- workflow sequencing tests that helper-first routing language remains intact

### Optional Eval Coverage

Expand routing evals so prompts that sound late-stage still route to the earlier safe stage when helper state requires it.

Examples:

- "review the architecture" while state is still pre-spec
- "write the plan" while spec is still draft
- "start implementing" while plan is still draft
- "finish this branch" before completion prerequisites are satisfied

## Acceptance Criteria

- workflow helpers remain the sole authority for stage progression
- late-stage skill descriptions still encode prerequisites and do not become generic implementation triggers
- duplicated repo/branch derivation is removed from the known borrowed-layer sites and centralized
- generated skills share branch grounding from one preamble source
- update checks detect new versions faster while preserving current Superpowers version semantics
- the change remains a narrow alignment package rather than expanding into broader upstream-sync policy or product-surface growth

## Alternatives Considered

### Direct Parity Backport

Rejected because it would import `gstack` behavior too literally and increase the chance that Item 1 competes with helper-owned routing.

### Infrastructure-Only Sync

Rejected because it avoids the riskiest piece, but also leaves a real borrowed-layer usability gap unresolved.

### Broader Upstream-Sync Strategy

Rejected because it is a different project. This spec is intentionally narrow and tactical.

## Deferred Work

If Superpowers continues borrowing substantial new `gstack` surface area, a separate future spec may define how recurring upstream drift should be reviewed. That is explicitly deferred from this change.

