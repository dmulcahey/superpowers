import fs from 'node:fs';
import path from 'node:path';

export function pathExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function isFilePath(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function ensureDirectoryExists(directoryPath: string): void {
  fs.mkdirSync(directoryPath, { recursive: true });
}

export function readTextFileIfExists(filePath: string): string {
  if (!pathExists(filePath)) {
    return '';
  }

  return fs.readFileSync(filePath, 'utf8');
}

export function writeTextFileAtomic(filePath: string, contents: string): void {
  ensureDirectoryExists(path.dirname(filePath));
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, contents, 'utf8');
  fs.renameSync(tempPath, filePath);
}

export function movePath(sourcePath: string, destinationPath: string): void {
  ensureDirectoryExists(path.dirname(destinationPath));
  fs.renameSync(sourcePath, destinationPath);
}

export function listNewestFiles(
  directoryPath: string,
  options: { extension?: string; limit?: number } = {},
): string[] {
  if (!pathExists(directoryPath)) {
    return [];
  }

  const extension = options.extension ?? '';
  const limit = options.limit ?? Number.MAX_SAFE_INTEGER;

  return fs
    .readdirSync(directoryPath)
    .filter((entry) => (extension.length > 0 ? entry.endsWith(extension) : true))
    .map((entry) => path.join(directoryPath, entry))
    .filter((entryPath) => isFilePath(entryPath))
    .sort((left, right) => {
      const timeDifference = fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs;
      if (timeDifference !== 0) {
        return timeDifference;
      }

      return left.localeCompare(right);
    })
    .slice(0, limit);
}
