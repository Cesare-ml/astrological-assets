import { lstatSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

function sameOrDescendant(file, root) {
  const normalize = value => process.platform === 'win32' ? value.toLowerCase() : value;
  const candidate = normalize(file), parent = normalize(root);
  return candidate === parent || candidate.startsWith(parent + sep);
}

/** Write a local diagnostic without overwriting inputs or following symlinks. */
export function writeCollisionReport(outFile, content, { legacyRoot, packRoot, manifestPath }) {
  if (typeof outFile !== 'string' || !outFile.trim() || typeof content !== 'string' ||
      !legacyRoot || !packRoot || !manifestPath) throw new Error('Invalid report destination or inputs');
  const destination = resolve(outFile);
  if ([legacyRoot, packRoot].some(root => sameOrDescendant(destination, resolve(root))) ||
      sameOrDescendant(destination, resolve(manifestPath)))
    throw new Error('Report output must not overwrite or enter an input asset tree or manifest');

  let current = destination;
  for (;;) {
    let stat;
    try { stat = lstatSync(current); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat?.isSymbolicLink()) throw new Error('Symlink in report destination: ' + current);
    if (stat && current !== destination && !stat.isDirectory())
      throw new Error('Non-directory report parent: ' + current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  // wx atomically refuses existing destinations (including final symlinks).
  writeFileSync(destination, content, { flag: 'wx', mode: 0o600 });
  return destination;
}
