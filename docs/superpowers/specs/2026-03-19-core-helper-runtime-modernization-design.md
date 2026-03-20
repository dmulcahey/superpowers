# Core Helper Runtime Modernization

**Workflow State:** Draft
**Spec Revision:** 1
**Last Reviewed By:** brainstorming

## Summary

Modernize the core Superpowers helper runtime by moving the workflow, execution, and config helpers from shell-first implementations to a TypeScript/Node core while preserving the existing command names and external CLI behavior.

The goal is not a CLI redesign. The goal is to keep the public helper surface stable while making the implementation easier to test, easier to maintain, and easier to run consistently across macOS and Windows.

The migration starts with the highest-leverage core helpers:

1. `bin/superpowers-config`
2. `bin/superpowers-workflow-status`
3. `bin/superpowers-plan-execution`

Shell and PowerShell entrypoints remain in place initially as compatibility shims. Over time, the Windows path should stop depending on Git Bash for these core helpers and invoke Node-backed implementations directly.

## Problem

Superpowers is currently shell-heavy in the places where correctness and cross-platform behavior matter most:

- workflow-state derivation
- execution-state mutation
- config read/write behavior
- path normalization and temporary-file handling

That has three costs:

- tests are slower and more integration-heavy than they need to be
- behavior is harder to express and verify with precise fixtures and assertions
- Windows support depends on PowerShell wrappers delegating into Bash, which adds avoidable complexity

The repository already gets value from deterministic Node-based tests and generators, but the most stateful helper behavior is still implemented in Bash. That leaves too much logic in a language that is awkward for structured data, typed invariants, atomic file updates, and rich test tooling.

## Goals

- Keep the existing helper command names and wrapper entrypoints stable.
- Move core helper logic into a more expressive implementation language with stronger testing tools.
- Make most helper behavior testable as deterministic module logic instead of long shell transcripts.
- Reduce the size and importance of the shell integration suite.
- Improve Windows support for core helpers and make removal of the Git Bash dependency the long-term direction.
- Keep the migration incremental so the runtime can be verified command-by-command.

## Not In Scope

- Redesigning the public helper CLI surface.
- Renaming existing commands or changing the basic wrapper layout in `bin/`.
- Migrating optional UX helpers such as the brainstorming visual companion in this first phase.
- Rewriting every shell script in the repository immediately.
- Committing to a compiled-language rewrite such as Go or Rust for this effort.

## Chosen Direction

Three options were considered:

1. Keep shell as the primary implementation language and improve only the test harness.
2. Move the core helper logic to TypeScript/Node while keeping the existing CLI surface.
3. Rebuild the helper runtime as compiled binaries.

The chosen direction is option 2.

This is the best balance for the current repository:

- it materially improves testability and maintainability
- it preserves the user-visible command surface
- it fits the repository's existing use of Node for deterministic tests and generators
- it avoids the rollout cost of an immediate compiled-runtime rewrite

## Target Architecture

The new runtime should be organized around small modules with clear ownership rather than one-for-one ports of the existing shell scripts.

### CLI adapters

Each helper gets a thin CLI adapter responsible for:

- parsing arguments
- selecting output mode
- mapping typed failures to exit codes and user-facing output
- calling one core module

The CLI layer should own presentation, not business logic.

### Core modules

The initial module split should be:

- `core/config`
  - read, write, and list config state under `~/.superpowers/config.yaml`
- `core/workflow`
  - manifest loading
  - repo artifact discovery
  - workflow header parsing
  - conservative routing
  - supported public inspection rendering inputs
- `core/execution`
  - approved-plan state machine
  - evidence-path derivation
  - step transitions
  - rollback-safe mutation planning
- `core/platform`
  - path normalization
  - temp file and atomic write helpers
  - repo-root detection
  - filesystem and process helpers that differ across platforms

This boundary keeps stateful logic separate from CLI formatting and makes the behavioral core directly testable.

## Command Flow

Each migrated helper should follow the same path:

1. The existing command in `bin/` is invoked.
2. A thin compatibility shim forwards arguments into the Node-backed entrypoint.
3. The Node CLI adapter parses the invocation and calls a typed core module.
4. The core module returns structured success data or a typed failure.
5. The CLI adapter renders the existing output contract: JSON, human-readable text, stderr, and exit status.

This structure preserves compatibility while removing most logic from the wrapper layer.

## Compatibility Rules

The external contract should remain stable during the migration.

Preserve:

- current command names
- current flag shapes
- current JSON field names where they are already part of the contract
- current core diagnostic wording unless a deliberate compatibility break is separately approved

The compatibility target is behavioral equivalence at the command boundary, not source-level parity with the shell implementations.

The new implementation may introduce:

- stronger internal typing
- clearer error modeling
- more explicit state transitions
- safer file-write behavior

## Error Handling

The Node core should replace ad hoc shell failures with a small explicit failure taxonomy.

Initial user-facing categories should cover:

- invalid arguments
- missing repo context
- malformed workflow headers
- stale or invalid workflow linkage
- invalid execution state
- file-write conflicts
- missing runtime dependencies at the wrapper boundary

Where the public contract already exposes machine-readable fields such as `failure_class` or `reason`, the new implementation must preserve that behavior.

Filesystem mutations, especially for plan and evidence updates, should use atomic write patterns with explicit backup and restore behavior rather than implicit shell pipelines.

## Testing Strategy

The new testing model should invert the current balance:

- most coverage should live in fast deterministic TypeScript/Node tests
- a small shell suite should remain only for wrapper and launch contracts

### Node-heavy coverage

Add deterministic tests for:

- workflow header parsing
- manifest derivation and validation
- routing decisions
- plan-step transitions
- evidence-path handling
- config read/write/list behavior
- platform path conversion and normalization

Add fixture-driven integration tests that invoke the Node CLI entrypoints against temporary repositories and assert on:

- stdout
- stderr
- exit status
- mutated files

### Thin shell coverage

Keep a smaller shell-focused contract layer for:

- Unix wrapper argument forwarding
- PowerShell wrapper argument forwarding
- Windows path normalization at the wrapper boundary
- verification that the installed command names still behave as expected

### Migration equivalence tests

For the riskiest helpers, temporarily run old and new implementations against the same fixture inputs and assert on equivalence for representative success and failure cases.

This is the main anti-regression mechanism during the rewrite.

## Migration Plan

The migration should proceed helper-by-helper.

### Phase 1: `superpowers-config`

Port the smallest helper first to establish:

- the Node entrypoint pattern
- shell and PowerShell shim behavior
- test harness conventions
- config file round-trip expectations

### Phase 2: `superpowers-workflow-status`

Port the workflow-state helper next because it has high logic density and large test payoff.

This phase should introduce:

- typed workflow status derivation
- fixture-driven repo-state tests
- explicit malformed-header and fallback behavior tests

### Phase 3: `superpowers-plan-execution`

Port the execution helper last because it is the most stateful and mutation-heavy surface.

This phase must prioritize:

- state machine correctness
- evidence and plan mutation safety
- rollback and recovery behavior
- exact compatibility for reviewed execution flows

## Windows Direction

For the targeted core helpers, the long-term Windows direction is to stop requiring Git Bash.

During migration:

- existing PowerShell wrappers may remain as compatibility shims
- wrappers may continue to call the existing shell path while equivalence testing is in progress

After compatibility is established for each targeted helper:

- PowerShell wrappers should invoke the Node-backed implementation directly
- Git Bash should no longer be a required dependency for those migrated core helpers

This change is a major part of the platform payoff and should not be treated as optional cleanup.

## Risks

- A compatibility-focused migration can still accidentally drift in output wording or exit behavior.
- Temporary dual implementations increase maintenance cost while equivalence gates are active.
- `superpowers-plan-execution` is stateful enough that unsafe partial migration could create subtle corruption or evidence drift.
- Introducing Node as a core runtime dependency changes the install/runtime contract and must be documented clearly.

## Success Criteria

- Core helper behavior is primarily implemented in TypeScript/Node rather than Bash.
- Most behavioral coverage runs as deterministic parallel Node tests.
- The shell suite becomes a narrow wrapper-contract layer instead of the main behavioral test surface.
- The public helper CLI surface remains stable throughout the migration.
- Windows execution for the migrated core helpers no longer depends on Git Bash.

## Open Questions

- What minimum supported Node version should become part of the runtime contract?
- Should the new runtime use plain JavaScript with JSDoc types or full TypeScript compilation for shipped helpers?
- Which current diagnostics are implicitly user-facing enough that wording changes should be treated as compatibility breaks?
