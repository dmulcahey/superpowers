import path from 'node:path';

export function resolveFromRuntimeRoot(runtimeRoot: string, relativePath: string): string {
  return path.resolve(runtimeRoot, relativePath);
}

export function resolveRuntimeRoot(entryPath: string, runtimeRootOverride?: string): string {
  if (runtimeRootOverride && runtimeRootOverride.length > 0) {
    return path.resolve(runtimeRootOverride);
  }

  return path.resolve(path.dirname(entryPath), '../../..');
}

export function normalizeRelativePath(input: string): string | null {
  if (input.length === 0 || path.isAbsolute(input)) {
    return null;
  }

  const normalizedParts: string[] = [];
  for (const part of input.replace(/\\/g, '/').split('/')) {
    if (part === '' || part === '.') {
      continue;
    }
    if (part === '..') {
      return null;
    }

    normalizedParts.push(part);
  }

  if (normalizedParts.length === 0) {
    return null;
  }

  return normalizedParts.join('/');
}

export function isPathInsideRoot(rootPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}
