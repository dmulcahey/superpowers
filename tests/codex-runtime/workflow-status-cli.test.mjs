import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const require = createRequire(path.join(repoRoot, 'runtime/core-helpers/package.json'));
const { build } = require('esbuild');

async function bundleCli() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'superpowers-workflow-status-cli-'));
  const bundledPath = path.join(tmpDir, 'superpowers-workflow-status.cjs');
  await build({
    entryPoints: [path.join(repoRoot, 'runtime/core-helpers/src/cli/superpowers-workflow-status.ts')],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile: bundledPath,
    write: true,
  });

  return { tmpDir, bundledPath };
}

async function withBundledCli(fn) {
  const { tmpDir, bundledPath } = await bundleCli();
  try {
    await fn(bundledPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

function runCli(bundledPath, args, options = {}) {
  const { cwd = repoRoot, env = {} } = options;
  return spawnSync(process.execPath, [bundledPath, ...args], {
    cwd,
    env: {
      ...process.env,
      SUPERPOWERS_RUNTIME_ROOT: repoRoot,
      ...env,
    },
    encoding: 'utf8',
  });
}

async function initRepo(repoDir) {
  await fs.mkdir(repoDir, { recursive: true });
  let result = spawnSync('git', ['init'], { cwd: repoDir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('git', ['config', 'user.name', 'Superpowers Test'], { cwd: repoDir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('git', ['config', 'user.email', 'superpowers-tests@example.com'], { cwd: repoDir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  await fs.writeFile(path.join(repoDir, 'README.md'), '# workflow status cli fixture\n', 'utf8');
  result = spawnSync('git', ['add', 'README.md'], { cwd: repoDir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('git', ['commit', '-m', 'init'], { cwd: repoDir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

async function writeFile(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, 'utf8');
}

test('status preserves the manifest-backed fast path until refresh is requested', async () => {
  await withBundledCli(async (bundledPath) => {
    const repoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'superpowers-workflow-status-fast-path-'));
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'superpowers-workflow-status-state-'));

    try {
      await initRepo(repoDir);
      await writeFile(
        path.join(repoDir, 'docs/superpowers/specs/2026-03-19-fast-path-design.md'),
        [
          '# Fast Path Draft Spec',
          '',
          '**Workflow State:** Draft',
          '**Spec Revision:** 1',
          '**Last Reviewed By:** brainstorming',
          '',
        ].join('\n'),
      );

      let result = runCli(bundledPath, ['status', '--refresh'], {
        cwd: repoDir,
        env: { SUPERPOWERS_STATE_DIR: stateDir },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /"status":"spec_draft"/);

      await writeFile(
        path.join(repoDir, 'docs/superpowers/specs/2026-03-19-fast-path-design.md'),
        [
          '# Fast Path Approved Spec',
          '',
          '**Workflow State:** CEO Approved',
          '**Spec Revision:** 2',
          '**Last Reviewed By:** plan-ceo-review',
          '',
        ].join('\n'),
      );
      await writeFile(
        path.join(repoDir, 'docs/superpowers/plans/2026-03-19-fast-path.md'),
        [
          '# Fast Path Approved Plan',
          '',
          '**Workflow State:** Engineering Approved',
          '**Source Spec:** `docs/superpowers/specs/2026-03-19-fast-path-design.md`',
          '**Source Spec Revision:** 2',
          '**Last Reviewed By:** plan-eng-review',
          '',
        ].join('\n'),
      );

      result = runCli(bundledPath, ['status'], {
        cwd: repoDir,
        env: { SUPERPOWERS_STATE_DIR: stateDir },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /"status":"spec_draft"/);
      assert.doesNotMatch(result.stdout, /implementation_ready/);

      result = runCli(bundledPath, ['status', '--refresh'], {
        cwd: repoDir,
        env: { SUPERPOWERS_STATE_DIR: stateDir },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /"status":"implementation_ready"/);
      assert.match(result.stdout, /"reason":"implementation_ready"/);
    } finally {
      await fs.rm(repoDir, { recursive: true, force: true });
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });
});

test('resolve outside a repo fails with a stable runtime_failure payload on stdout', async () => {
  await withBundledCli(async (bundledPath) => {
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'superpowers-workflow-status-outside-'));
    try {
      const result = runCli(bundledPath, ['resolve'], { cwd: outsideDir });

      assert.equal(result.status, 1);
      assert.match(result.stdout, /"outcome":"runtime_failure"/);
      assert.match(result.stdout, /"failure_class":"RepoContextUnavailable"/);
      assert.equal(result.stderr, '');
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });
});
