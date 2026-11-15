// Private, metadata-only catalog snapshot writer. Never modifies the authoritative catalog.
import { lstatSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const PROTECTED_DIRECTORIES = new Set([
  '.git', 'catalog', 'docs', 'manifests', 'public', 'scripts', 'tests',
]);

function isWithin(root, path) {
  const relativePath = relative(resolve(root), path);
  return relativePath === '' || (relativePath !== '..' &&
    !relativePath.startsWith('..' + sep) && !isAbsolute(relativePath));
}

export function writeLocalCatalogSnapshot({ output, catalog, repositoryRoot, sourceRepoRoot }) {
  if (typeof output !== 'string' || !output.endsWith('.local.json'))
    throw new Error('Snapshot output must end in .local.json');
  if (typeof repositoryRoot !== 'string' || !repositoryRoot ||
      typeof sourceRepoRoot !== 'string' || !sourceRepoRoot)
    throw new Error('Both repository roots are required');
  if (catalog?.schemaVersion !== 1 || catalog.rightsStatus !== 'unreviewed' ||
      catalog.source?.repository !== 'Cesare-ml/virgo-stars' ||
      catalog.source?.assetRoot !== 'public/assets' ||
      !/^[a-f0-9]{40}$/.test(catalog.source?.commit || '') ||
      !Array.isArray(catalog.files) || !catalog.files.length ||
      catalog.fileCount !== catalog.files.length)
    throw new Error('Only nonempty, unreviewed source catalog metadata can be written');

  const target = resolve(output);
  const workspace = resolve(repositoryRoot);
  if (isWithin(sourceRepoRoot, target))
    throw new Error('Refusing to write a snapshot inside the source repository');
  if (isWithin(workspace, target)) {
    const firstPart = relative(workspace, target).split(sep)[0];
    if (PROTECTED_DIRECTORIES.has(firstPart))
      throw new Error('Refusing to write a snapshot into protected repository directory: ' + firstPart);
  }

  // Check each ancestor without following a symlink/junction, including those outside
  // this repository. A trusted local workspace is required to avoid path races.
  let parent = dirname(target);
  while (true) {
    const entry = lstatSync(parent);
    if (entry.isSymbolicLink() || !entry.isDirectory())
      throw new Error('Unsafe snapshot output parent: ' + parent);
    const next = dirname(parent);
    if (next === parent) break;
    parent = next;
  }

  // Exclusive create also rejects a pre-existing symlink as the final component.
  writeFileSync(target, JSON.stringify(catalog, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return target;
}
