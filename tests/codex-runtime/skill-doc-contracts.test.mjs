import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  REPO_ROOT,
  SKILLS_DIR,
  listGeneratedSkills,
  readUtf8,
  parseFrontmatter,
  extractBashBlockUnderHeading,
  extractSection,
  normalizeWhitespace,
  countOccurrences,
} from './helpers/markdown-test-helpers.mjs';

function getTemplatePath(skill) {
  return path.join(SKILLS_DIR, skill, 'SKILL.md.tmpl');
}

function getSkillPath(skill) {
  return path.join(SKILLS_DIR, skill, 'SKILL.md');
}

test('templates declare exactly one base or review preamble placeholder', () => {
  for (const skill of listGeneratedSkills()) {
    const template = readUtf8(getTemplatePath(skill));
    const hasBase = template.includes('{{BASE_PREAMBLE}}');
    const hasReview = template.includes('{{REVIEW_PREAMBLE}}');
    assert.notEqual(hasBase, hasReview, `${skill} should declare exactly one preamble placeholder`);
  }
});

test('generated preamble bash block includes shared runtime-root, session, and contributor state', () => {
  for (const skill of listGeneratedSkills()) {
    const content = readUtf8(getSkillPath(skill));
    const bashBlock = extractBashBlockUnderHeading(content, 'Preamble (run first)');
    assert.ok(bashBlock, `${skill} should include a preamble bash block`);
    assert.match(bashBlock, /_IS_SUPERPOWERS_RUNTIME_ROOT\(\)/, `${skill} should define runtime-root detection`);
    assert.match(bashBlock, /_SESSIONS=/, `${skill} should track session count`);
    assert.match(bashBlock, /_CONTRIB=/, `${skill} should load contributor state`);
  }
});

test('review skills include review-only preamble contract', () => {
  for (const skill of listGeneratedSkills()) {
    const template = readUtf8(getTemplatePath(skill));
    if (!template.includes('{{REVIEW_PREAMBLE}}')) continue;

    const content = readUtf8(getSkillPath(skill));
    const bashBlock = extractBashBlockUnderHeading(content, 'Preamble (run first)');
    assert.match(bashBlock, /_TODOS_FORMAT=/, `${skill} should load TODO format state`);
    assert.match(content, /## Agent Grounding/, `${skill} should include Agent Grounding`);
  }
});

test('interactive question contract appears once per generated skill in normalized form', () => {
  const expectedBits = [
    '1. Context: project name, current branch, what we\'re working on (1-2 sentences)',
    '2. The specific question or decision point',
    '3. `RECOMMENDATION: Choose [X] because [one-line reason]`',
    '4. Lettered options: `A) ... B) ... C) ...`',
  ];

  for (const skill of listGeneratedSkills()) {
    const content = readUtf8(getSkillPath(skill));
    assert.equal(countOccurrences(content, '## Interactive User Question Format'), 1, `${skill} should define the interactive question format once`);
    const section = extractSection(content, 'Interactive User Question Format');
    assert.ok(section, `${skill} should include the interactive question format section`);
    const normalized = normalizeWhitespace(section);
    for (const bit of expectedBits) {
      assert.match(normalized, new RegExp(bit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${skill} should include ${bit}`);
    }
  }
});

test('workflow sequencing test uses local fixtures instead of historical docs paths', () => {
  const content = readUtf8(path.join(REPO_ROOT, 'tests/codex-runtime/test-workflow-sequencing.sh'));
  const stripped = content
    .replace(/^require_pattern docs\/superpowers\/specs\/2026-03-17-workflow-state-runtime-design\.md .*$/gm, '')
    .replace(/^require_pattern docs\/superpowers\/plans\/2026-03-17-workflow-state-runtime\.md .*$/gm, '');
  assert.match(content, /WORKFLOW_FIXTURE_DIR="tests\/codex-runtime\/fixtures\/workflow-artifacts"/);
  assert.doesNotMatch(stripped, /docs\/superpowers\/specs\/2026-/);
  assert.doesNotMatch(stripped, /docs\/superpowers\/plans\/2026-/);
});

test('workflow-critical skill descriptions encode approval-stage prerequisites', () => {
  const expected = {
    'writing-plans': /CEO-approved Superpowers spec/,
    'plan-eng-review': /CEO-approved spec/,
    'subagent-driven-development': /engineering-approved Superpowers implementation plan/,
    'executing-plans': /engineering-approved Superpowers implementation plan/,
  };

  for (const [skill, pattern] of Object.entries(expected)) {
    const frontmatter = parseFrontmatter(readUtf8(getSkillPath(skill)));
    assert.ok(frontmatter, `${skill} should have frontmatter`);
    assert.match(frontmatter.description, pattern, `${skill} description should encode the required workflow gate`);
  }
});

test('workflow handoff skills make terminal ownership explicit', () => {
  const usingSuperpowers = readUtf8(getSkillPath('using-superpowers'));
  assert.doesNotMatch(usingSuperpowers, /brainstorming first, then implementation skills/);
  assert.match(
    usingSuperpowers,
    /brainstorming first, then follow the artifact-state workflow: plan-ceo-review -> writing-plans -> plan-eng-review -> execution\./,
  );
  assert.match(
    usingSuperpowers,
    /Do NOT jump from brainstorming straight to implementation\. For workflow-routed work, every stage owns the handoff into the next one\./,
  );
  assert.match(
    usingSuperpowers,
    /"Fix this bug" → debugging first, then if it changes Superpowers product or workflow behavior follow the artifact-state workflow; otherwise continue to the appropriate implementation skill\./,
  );
  assert.match(
    usingSuperpowers,
    /For feature requests, bugfixes that materially change Superpowers product or workflow behavior, product requests, or workflow-change requests inside a Superpowers project, route by artifact state instead of skipping ahead based on the user's wording alone\./,
  );
  assert.match(
    usingSuperpowers,
    /First, if `\$_SUPERPOWERS_ROOT\/bin\/superpowers-workflow-status` is available, call `\$_SUPERPOWERS_ROOT\/bin\/superpowers-workflow-status status --refresh`\./,
  );
  assert.match(
    usingSuperpowers,
    /If the JSON result contains a non-empty `next_skill`, use that route\./,
  );
  assert.match(
    usingSuperpowers,
    /If the JSON result reports `status` `implementation_ready`, proceed to the normal execution handoff: use `superpowers:subagent-driven-development` when isolated-agent workflows are available in the current platform\/session; otherwise use `superpowers:executing-plans`\./,
  );
  assert.match(
    usingSuperpowers,
    /Only fall back to manual artifact inspection if the helper itself is unavailable or fails\./,
  );

  const ceoReview = readUtf8(getSkillPath('plan-ceo-review'));
  assert.match(ceoReview, /\*\*The terminal state is invoking writing-plans\.\*\*/);
  assert.match(ceoReview, /Do not draft a plan or offer implementation options from `plan-ceo-review`\./);
  assert.match(ceoReview, /runs `sync --artifact spec`/);

  const engReview = readUtf8(getSkillPath('plan-eng-review'));
  assert.match(engReview, /\*\*The terminal state is presenting the execution handoff with the approved plan path\.\*\*/);
  assert.match(engReview, /Do not start implementation inside `plan-eng-review`\./);
  assert.match(
    engReview,
    /if `\$_SUPERPOWERS_ROOT\/bin\/superpowers-workflow-status` is available, call `\$_SUPERPOWERS_ROOT\/bin\/superpowers-workflow-status status --refresh`/,
  );
  assert.match(engReview, /If the helper returns a non-empty `next_skill`, use that route instead of re-deriving state manually\./);
  assert.match(engReview, /If the helper returns `status` `implementation_ready`, present the normal execution handoff below\./);

  const brainstorming = readUtf8(getSkillPath('brainstorming'));
  assert.match(brainstorming, /record the intended spec path with `expect`/);
  assert.match(brainstorming, /"\$_SUPERPOWERS_ROOT\/bin\/superpowers-workflow-status" expect --artifact spec --path/);
  assert.match(brainstorming, /runs `sync --artifact spec`/);

  const writingPlans = readUtf8(getSkillPath('writing-plans'));
  assert.match(writingPlans, /record the intended plan path with `expect`/);
  assert.match(writingPlans, /"\$_SUPERPOWERS_ROOT\/bin\/superpowers-workflow-status" expect --artifact plan --path/);
  assert.match(writingPlans, /runs `sync --artifact plan`/);

  const ceoReviewWithSyncPath = readUtf8(getSkillPath('plan-ceo-review'));
  assert.match(ceoReviewWithSyncPath, /"\$_SUPERPOWERS_ROOT\/bin\/superpowers-workflow-status" sync --artifact spec --path/);

  const sdd = readUtf8(getSkillPath('subagent-driven-development'));
  assert.match(sdd, /"Have engineering-approved implementation plan\?" \[shape=diamond\];/);
  assert.match(sdd, /"Return to using-superpowers artifact-state routing" \[shape=box\];/);
  assert.match(sdd, /"Have engineering-approved implementation plan\?" -> "Return to using-superpowers artifact-state routing" \[label="no"\];/);
  assert.match(sdd, /"Tasks mostly independent\?" -> "executing-plans" \[label="no - tightly coupled or better handled in one coordinator session"\];/);
});

test('approved workflow-state artifacts document the finalized helper contract', () => {
  const specDoc = readUtf8(path.join(REPO_ROOT, 'docs/superpowers/specs/2026-03-17-workflow-state-runtime-design.md'));
  assert.match(
    specDoc,
    /skills call `\$_SUPERPOWERS_ROOT\/bin\/superpowers-workflow-status`/,
    'approved spec should describe runtime-root-aware helper invocation',
  );
  assert.match(
    specDoc,
    /`next_skill` is only used when non-empty/,
    'approved spec should describe non-empty next_skill consumption',
  );
  assert.match(
    specDoc,
    /`implementation_ready` is a terminal status/,
    'approved spec should describe implementation_ready as terminal',
  );
  assert.match(
    specDoc,
    /`status --summary` is human-oriented/,
    'approved spec should describe summary mode as human-oriented',
  );
  assert.match(
    specDoc,
    /`reason` is the canonical diagnostic field/,
    'approved spec should describe canonical reason diagnostics',
  );

  const planDoc = readUtf8(path.join(REPO_ROOT, 'docs/superpowers/plans/2026-03-17-workflow-state-runtime.md'));
  assert.match(
    planDoc,
    /`\$_SUPERPOWERS_ROOT\/bin\/superpowers-workflow-status status --refresh`/,
    'approved plan should describe runtime-root-aware helper invocation',
  );
  assert.match(
    planDoc,
    /If the helper returns a non-empty `next_skill`, use that route\./,
    'approved plan should describe non-empty next_skill consumption',
  );
  assert.match(
    planDoc,
    /If the helper returns `status` `implementation_ready`, present the normal execution handoff\./,
    'approved plan should describe terminal implementation_ready handling',
  );
  assert.match(
    planDoc,
    /`status --summary` is human-oriented/,
    'approved plan should describe summary mode as human-oriented',
  );
  assert.match(
    planDoc,
    /`reason` is the canonical diagnostic field/,
    'approved plan should describe canonical reason diagnostics',
  );
});
