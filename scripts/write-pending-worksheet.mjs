// Local-only, fail-closed output for a PENDING human rights-review worksheet.
// This is not a public redistribution approval or an artwork license.
import { lstatSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const PROTECTED_REPO_DIRECTORIES = new Set([
  '.git', 'catalog', 'docs', 'manifests', 'public', 'scripts', 'tests',
]);

export function writePendingWorksheet({ destination, repositoryRoot, worksheet }) {
  if (typeof destination !== 'string' || !destination.endsWith('.local.json'))
    throw new Error('Worksheet output must end in .local.json');
  if (typeof repositoryRoot !== 'string' || !repositoryRoot)
    throw new Error('A repository root is required');
  if (worksheet?.schemaVersion !== 1 || !Array.isArray(worksheet.assets) ||
      worksheet.assets.some(asset => asset?.status !== 'pending' || asset.permissionScope !== 'not-yet-granted'))
    throw new Error('Only pending, non-authorizing worksheets may be written');

  const target = resolve(destination);
  const root = resolve(repositoryRoot);
  const inside = relative(root, target);
  if (inside !== '' && inside !== '..' && !inside.startsWith('..' + sep) && !isAbsolute(inside)) {
    const topLevel = inside.split(sep)[0];
    if (PROTECTED_REPO_DIRECTORIES.has(topLevel))
      throw new Error('Worksheet output is forbidden in a tracked repository directory: ' + topLevel);
  }

  // lstat every ancestor: a symlink/junction anywhere in the output path could
  // redirect a private worksheet to an unexpected location.
  let parent = dirname(target);
  while (true) {
    const stat = lstatSync(parent);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error('Unsafe worksheet output parent: ' + parent);
    const next = dirname(parent);
    if (next === parent) break;
    parent = next;
  }

  // 'wx' is exclusive: refuse overwrites and existing symlink destinations.
  // New files are private to the invoking user where POSIX modes are supported.
  writeFileSync(target, JSON.stringify(worksheet, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return target;
}
