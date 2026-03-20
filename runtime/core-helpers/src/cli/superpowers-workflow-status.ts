import path from 'node:path';
import { runWorkflowStatusCommand } from '../core/workflow-status';
import { resolveRuntimeRoot } from '../platform/paths';
import { runCli } from '../platform/process';

declare const require: undefined | { main: unknown };
declare const module: unknown;

export function main(argv: string[] = process.argv): number {
  const entryPath = argv[1] ?? path.join(process.cwd(), 'runtime/core-helpers/dist/superpowers-workflow-status.cjs');
  const result = runWorkflowStatusCommand(argv.slice(2), {
    cwd: process.cwd(),
    env: process.env,
    runtimeRoot: resolveRuntimeRoot(entryPath, process.env.SUPERPOWERS_RUNTIME_ROOT),
  });

  if (result.stdout.length > 0) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr.length > 0) {
    process.stderr.write(result.stderr);
  }

  return result.exitCode;
}

if (typeof require !== 'undefined' && require.main === module) {
  runCli(main);
}
