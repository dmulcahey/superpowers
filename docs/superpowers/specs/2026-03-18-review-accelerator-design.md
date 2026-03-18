# Review Accelerator

**Workflow State:** Draft
**Spec Revision:** 1
**Last Reviewed By:** brainstorming

## Summary

Add an opt-in accelerated review mode for:

- `superpowers:plan-ceo-review`
- `superpowers:plan-eng-review`

The accelerator uses a reviewer subagent to pressure-test one review section at a time, draft a structured section packet, and prepare a staged patch for the current spec or plan. The human remains the only approval authority:

- only the user can enable acceleration mode
- only the user can approve a section
- only the user can approve the final review outcome

Acceleration mode is not a new workflow stage. It is a faster path inside the existing CEO and ENG review stages.

## Problem

The current CEO and ENG review skills are deliberately rigorous, but the review loop can become slow and repetitive when many issues are straightforward once a strong reviewer has pressure-tested the artifact.

Today:

- review sections are designed around direct human interaction
- many routine issues still require serial question-by-question handling
- the repo has strong review and fail-closed contracts, but no first-class fast path for trusted users who want help drafting section outcomes
- a naive "YOLO" mode would be dangerous because it would weaken the approval gates that make the workflow trustworthy

The leverage point is not replacing human approval. It is compressing the routine parts of review while preserving the written artifact as the source of truth and keeping human approval at the section and final-review boundaries.

## Goals

- Add an explicit-user-only accelerated mode to both CEO review and ENG review.
- Keep the normal review path as the default.
- Use a reviewer subagent with the correct persona for the active review stage.
- Produce a section packet for each accelerated review section.
- Persist section packets as review artifacts under `~/.superpowers/projects/<slug>/...`.
- Apply a staged section patch only after the user approves that section.
- Break high-judgment issues out into direct human questions before section approval.
- Keep the written spec or plan current as the review progresses by applying approved section patches immediately.
- Preserve all existing approval and handoff invariants.
- Update `README.md` and its Mermaid workflow diagrams to document the accelerated review path accurately.

## Not In Scope

- A new public workflow stage or router status for acceleration mode.
- Automatic or heuristic activation of accelerated review.
- Sticky acceleration defaults that carry across sessions or reviews without fresh user approval.
- Automatic CEO or Engineering approval.
- Letting persisted accelerator artifacts override the written spec or plan.
- Replacing the normal question-by-question review path.
- Extending acceleration mode to execution, QA, code review, or branch-finishing flows in v1.

## Existing Context

- `plan-ceo-review` and `plan-eng-review` already own the review loops and the handoffs into the next stages.
- `superpowers-workflow-status` already keeps product-work routing conservative and fail-closed.
- The execution workflow already uses subagent review loops and treats reviewer findings as blocking until resolved.
- The repo already stores cross-session artifacts under `~/.superpowers/projects/<slug>/...`.
- The root `README.md` already documents the product workflow and its Mermaid diagrams as the supported mental model for the system.

## Decisions Captured During Brainstorming

The design locks these product decisions:

- activation is explicit and per review
- acceleration lives inside the existing `plan-ceo-review` and `plan-eng-review` skills
- the implementation shape uses shared subagent prompt/reference assets instead of a new top-level workflow skill
- high-judgment issues break out into direct human questions inside an otherwise accelerated section
- approved section patches apply immediately
- section packets persist as review artifacts
- only the user may initiate acceleration mode

## User Experience

### Activation Model

Acceleration mode must be activated explicitly by the user in the current review request.

Valid activation examples:

- "run CEO review in accelerated mode"
- "use accelerated ENG review"
- equivalent explicit wording that clearly opts into acceleration for that review

Invalid activation sources:

- agent suggestion alone
- repo state
- branch name
- remembered session preference
- prior use of acceleration mode in another review
- heuristics based on artifact size or issue count

The user may request acceleration for CEO review, ENG review, or both, but each review invocation must be explicitly enabled by the user.

### Section Packet UX

Each accelerated section produces:

1. a terminal-facing section packet
2. a persisted section artifact

The terminal packet should include:

- review kind (`CEO` or `ENG`)
- section name
- reviewer persona used
- routine issues included in the proposed patch
- high-judgment issues escalated to the human
- proposed artifact changes
- residual risks
- unresolved decisions
- the section approval question

The user decisions for a section are:

- approve section
- reopen one escalated issue
- fall back to manual review for this section
- stop review

### High-Judgment Mixed Mode

Acceleration mode is mixed-mode within a section:

- routine issues stay in the section packet
- high-judgment issues are broken out into direct human questions before section approval

This keeps the fast path fast without burying material product or architecture choices inside a single bundled section approval.

## Architecture

### Ownership Model

The main agent still owns the review. The reviewer subagent does not own approval and does not mutate approval state directly.

Responsibilities:

- main agent:
  - detects explicit user opt-in
  - dispatches the reviewer subagent
  - renders the section packet
  - asks any escalated direct human questions
  - applies approved section patches
  - runs the normal artifact sync flow
  - controls final approval and handoff behavior
- reviewer subagent:
  - pressure-tests the current review section
  - proposes routine resolutions
  - flags high-judgment issues
  - drafts the staged patch
  - returns a structured section packet

### Reviewer Personas

Reviewer persona depends on the active review stage:

- CEO review:
  - founder/product/principal-strategy reviewer
- ENG review:
  - principal engineer reviewer

These personas are shared prompt/reference assets used by the existing review skills when accelerated mode is active.

### Control Flow

```text
user explicitly enables accelerated review
   |
   v
existing review skill owns the session
   |
   v
run review section
   |
   v
dispatch reviewer subagent for that section
   |
   v
section packet + staged patch + escalations
   |
   +--> high-judgment issue? --> direct human question(s)
   |
   v
human approves section?
   |                |
   | yes            | no
   v                v
apply section patch  fall back / reopen / stop
sync artifact
move to next section
```

### Internal Section State

Acceleration mode uses internal session state only. It does not add a public workflow stage.

Section states:

- `draft_packet`
- `awaiting_human_issue_decision`
- `awaiting_section_approval`
- `section_approved`
- `section_fallback_manual`
- `review_stopped`

## Artifact Model

### Authority Split

Authority remains unchanged:

- written spec and plan headers are the only approval truth
- accelerated review artifacts are diagnostic and resumable review aids only

Accelerator artifacts must never:

- mark a spec as `CEO Approved`
- mark a plan as `Engineering Approved`
- override the written artifact contents
- override workflow helper routing

### Persisted Section Artifacts

Persist section packets under `~/.superpowers/projects/<slug>/...`.

Recommended v1 naming shape:

```text
~/.superpowers/projects/<slug>/{user}-{safe-branch}-{review-kind}-accelerator-{datetime}-{section-slug}.md
```

Each artifact should record:

- repo slug
- repo root
- branch
- review kind
- source artifact path
- source artifact workflow state
- source artifact revision
- section name
- reviewer persona
- whether acceleration was explicitly user-initiated
- routine findings
- escalated issues
- staged patch summary
- human decision for the section
- timestamp

### Immediate Section Application

When a section is approved:

1. apply the staged patch immediately to the draft spec or plan
2. run the normal sync flow for that artifact
3. continue with the next section using the updated written artifact

This keeps the draft current throughout review and matches the existing review model of updating the artifact before continuing.

## Safety Boundaries

The accelerator must preserve the existing review invariants:

- acceleration mode never changes workflow routing
- acceleration mode never changes approval authority
- only the user can initiate acceleration mode
- only the user can approve a section
- only the user can approve the final review outcome
- the written spec or plan remains in `Draft` until the review is fully resolved
- the normal execution handoff only happens after final explicit approval

## Failure Handling

Acceleration mode must fail closed back to manual review behavior.

If any of these happen:

- reviewer subagent failure
- malformed reviewer output
- incoherent section packet
- staged patch apply failure
- missing or stale accelerator artifact
- resume state inconsistency

Then the main agent must:

- keep the written artifact authoritative
- keep the artifact in `Draft`
- surface the failure clearly to the user
- fall back to normal manual review handling for that section

No silent defaults are allowed.

## README And Mermaid Updates

This change must update the root `README.md` so the documented workflow matches the shipped behavior.

Documentation updates must include:

- text describing accelerated review as an opt-in path inside CEO and ENG review
- a clear statement that only the user can initiate acceleration mode
- a clear statement that acceleration mode does not change approval authority
- Mermaid diagram updates showing accelerated review as a branch inside `plan-ceo-review` and `plan-eng-review`, not as a separate workflow stage

Documentation must not imply:

- a parallel review workflow
- automatic approval
- agent-triggered acceleration

## Testing

### Required Coverage

- normal CEO review remains unchanged when acceleration mode is not explicitly requested
- normal ENG review remains unchanged when acceleration mode is not explicitly requested
- acceleration mode cannot be entered by heuristic, remembered state, or agent suggestion alone
- section packets persist under `~/.superpowers/projects/<slug>/...` with repo and branch identity
- approved section patches apply immediately
- rejected or reopened sections do not silently mutate approval state
- high-judgment issues become direct human questions before section approval
- reviewer subagent failure falls back to manual review for that section
- patch-apply failure falls back to manual review for that section
- final approval headers still require explicit human approval
- README text and Mermaid diagrams stay aligned with the implementation

### Review/Test Diagram

```text
accelerated review request
   |
   +--> explicit user opt-in? -- no --> normal review path
   |                              |
   |                              yes
   v
dispatch reviewer subagent
   |
   +--> valid packet?
   |       |
   |       no --> manual review fallback
   |       |
   |       yes
   v
high-judgment issue present?
   |                |
   | yes            | no
   v                v
direct human issue  section approval
question(s)         |
   |                |
   +-------> section approved?
                    |
           +--------+--------+
           |                 |
           yes               no
           |                 |
           v                 v
apply patch + sync      reopen/fallback/stop
```

## Rollout

V1 ships support for both CEO and ENG review acceleration from day one, but remains explicitly opt-in.

Rollout posture:

- normal review remains the default and the source of behavioral compatibility
- accelerated review is documented as an accelerator, not a replacement workflow
- no workflow migration is required
- if acceleration mode proves noisy or brittle, users can fall back to the normal path immediately

## Dream State Delta

```text
CURRENT STATE                      THIS SPEC                               12-MONTH IDEAL
question-by-question review        opt-in accelerated section review       trusted fast review path with
with strong human control          with preserved human approval           resumable artifacts and clear
                                   and fail-closed fallback               documentation for every stage
```
