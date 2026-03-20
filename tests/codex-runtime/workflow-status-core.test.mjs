import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const require = createRequire(path.join(repoRoot, 'runtime/core-helpers/package.json'));
const { build } = require('esbuild');

async function loadModule(relativeEntryPath) {
  const entryPoint = path.join(repoRoot, relativeEntryPath);
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });

  const bundledSource = result.outputFiles[0].text;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(bundledSource).toString('base64')}`;
  return import(dataUrl);
}

test('normalizeRepoRelativePath preserves repo-relative paths and rejects escapes', async () => {
  const module = await loadModule('runtime/core-helpers/src/core/workflow-status.ts');

  assert.equal(typeof module.normalizeRepoRelativePath, 'function');
  assert.equal(
    module.normalizeRepoRelativePath('docs\\superpowers\\specs\\example.md'),
    'docs/superpowers/specs/example.md',
  );
  assert.equal(module.normalizeRepoRelativePath('../outside.md'), null);
  assert.equal(module.normalizeRepoRelativePath('/tmp/example.md'), null);
});

test('parse header helpers reject malformed files and classify stale plans conservatively', async () => {
  const module = await loadModule('runtime/core-helpers/src/core/workflow-status.ts');

  assert.equal(typeof module.parseSpecHeaders, 'function');
  assert.equal(typeof module.parsePlanHeaders, 'function');
  assert.equal(typeof module.classifyWorkflowState, 'function');

  assert.equal(
    module.parseSpecHeaders([
      '# Missing Revision',
      '',
      '**Workflow State:** CEO Approved',
      '**Last Reviewed By:** plan-ceo-review',
    ].join('\n')),
    null,
  );

  assert.equal(
    module.parsePlanHeaders([
      '# Missing Source Revision',
      '',
      '**Workflow State:** Engineering Approved',
      '**Source Spec:** `docs/superpowers/specs/example.md`',
      '**Last Reviewed By:** plan-eng-review',
    ].join('\n')),
    null,
  );

  const ready = module.classifyWorkflowState({
    resolvedSpecPath: 'docs/superpowers/specs/example-design.md',
    specExists: true,
    specHeaders: {
      state: 'CEO Approved',
      revision: '2',
      reviewer: 'plan-ceo-review',
    },
    resolvedPlanPath: 'docs/superpowers/plans/example.md',
    planExists: true,
    planHeaders: {
      state: 'Engineering Approved',
      sourceSpec: 'docs/superpowers/specs/example-design.md',
      sourceRevision: '2',
      reviewer: 'plan-eng-review',
    },
    specAmbiguous: false,
    specExpectedMissing: false,
    planAmbiguous: false,
    planExpectedMissing: false,
  });
  assert.deepEqual(ready, {
    statusCode: 'implementation_ready',
    nextSkill: '',
    reason: 'implementation_ready',
  });

  const stale = module.classifyWorkflowState({
    resolvedSpecPath: 'docs/superpowers/specs/example-design.md',
    specExists: true,
    specHeaders: {
      state: 'CEO Approved',
      revision: '2',
      reviewer: 'plan-ceo-review',
    },
    resolvedPlanPath: 'docs/superpowers/plans/example.md',
    planExists: true,
    planHeaders: {
      state: 'Engineering Approved',
      sourceSpec: 'docs/superpowers/specs/example-design.md',
      sourceRevision: '1',
      reviewer: 'plan-eng-review',
    },
    specAmbiguous: false,
    specExpectedMissing: false,
    planAmbiguous: false,
    planExpectedMissing: false,
  });
  assert.deepEqual(stale, {
    statusCode: 'stale_plan',
    nextSkill: 'superpowers:writing-plans',
    reason: '',
  });

  const missingExpectedSpec = module.classifyWorkflowState({
    resolvedSpecPath: 'docs/superpowers/specs/missing.md',
    specExists: false,
    specHeaders: null,
    resolvedPlanPath: '',
    planExists: false,
    planHeaders: null,
    specAmbiguous: false,
    specExpectedMissing: true,
    planAmbiguous: false,
    planExpectedMissing: false,
  });
  assert.deepEqual(missingExpectedSpec, {
    statusCode: 'needs_brainstorming',
    nextSkill: 'superpowers:brainstorming',
    reason: 'missing_expected_spec',
  });
});
