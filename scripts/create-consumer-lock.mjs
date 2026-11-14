#!/usr/bin/env node
/**
 * Create a reproducible, metadata-only lock for a verified PRIVATE asset subset.
 * No image bytes are copied or embedded, and no publication rights are granted.
 */
import { createHash } from 'node:crypto';
import { constants, lstatSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectConsumerAssets } from './check-consumer-assets.mjs';

const repoRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const digest = value => createHash('sha256').update(value).digest('hex');
const within = (base, candidate) => {
  const diff = relative(base, candidate);
  return diff === '' || (diff !== '..' && !diff.startsWith('..' + sep) && !isAbsolute(diff));
};

export function prepareConsumerLock({ assetRoot, manifest, requirements }) {
  const report = inspectConsumerAssets({ assetRoot, manifest, requirements });
  if (report.verdict !== 'verified') return { report, lock: null };

  const source = manifest.source;
  if (!source || typeof source.repository !== 'string' ||
      !/^[\w.-]+\/[\w.-]+$/.test(source.repository) ||
      typeof source.commit !== 'string' || !/^[a-f0-9]{40}$/.test(source.commit) ||
      source.assetRoot !== 'public/assets')
    throw new Error('A lock requires an exact source repository, 40-character Git commit and public/assets root');

  const identity = {
    schemaVersion: 1,
    format: 'virgostars.consumer-assets.lock',
    consumer: report.consumer,
    source: {
      repository: source.repository,
      commit: source.commit,
      assetRoot: source.assetRoot,
    },
    assets: report.verified.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
  };
  const lock = {
    ...identity,
    assetCount: report.verifiedCount,
    totalBytes: report.totalVerifiedBytes,
    revision: 'sha256:' + digest(JSON.stringify(identity)),
    distribution: 'private-integrity-only',
  };
  return { report, lock };
}

export function writeNewLock(path, lock, { assetRoot } = {}) {
  if (!path || typeof path !== 'string') throw new Error('Output path is required');
  const destination = resolve(path);
  if (!destination.toLowerCase().endsWith('.json')) throw new Error('Output must be a .json file');
  if (within(repoRoot, destination) || (assetRoot && within(resolve(assetRoot), destination)))
    throw new Error('Output must be outside the public repository and the asset root');

  let current = dirname(destination);
  const info = lstatSync(current);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Output parent must be a regular directory');
  while (true) {
    if (lstatSync(current).isSymbolicLink()) throw new Error('Symlink in output ancestor: ' + current);
    const next = dirname(current);
    if (next === current) break;
    current = next;
  }

  // Exclusive creation: never replace a prior lock or follow an existing destination link.
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL;
  const fd = openSync(destination, flags, 0o600);
  try {
    writeFileSync(fd, JSON.stringify(lock, null, 2) + '\n', 'utf8');
  } finally {
    closeSync(fd);
  }
}

function parseArgs(args) {
  const usage = 'Usage: --root public/assets --manifest manifests/approved-assets.json (--requirements consumer.local.json | --selection chart.selection.local.json --consumer AstrologicalCharts) [--out ../consumer-lock.local.json]';
  const allowed = new Set(['--root', '--manifest', '--requirements', '--selection', '--consumer', '--out']);
  if (args.length % 2) throw new Error(usage);
  const flags = new Map();
  for (let i = 0; i < args.length; i += 2) {
    if (!allowed.has(args[i]) || !args[i + 1] || flags.has(args[i])) throw new Error(usage);
    flags.set(args[i], args[i + 1]);
  }
  const hasRequirements = flags.has('--requirements'), hasSelection = flags.has('--selection');
  if (!flags.has('--root') || !flags.has('--manifest') || hasRequirements === hasSelection ||
      (hasRequirements && flags.has('--consumer')) || (hasSelection && !flags.has('--consumer')))
    throw new Error(usage);
  return flags;
}

function main(args) {
  const flags = parseArgs(args);
  const manifest = JSON.parse(readFileSync(flags.get('--manifest'), 'utf8'));
  const requirements = flags.has('--requirements')
    ? JSON.parse(readFileSync(flags.get('--requirements'), 'utf8'))
    : {
      schemaVersion: 1,
      consumer: flags.get('--consumer'),
      assets: JSON.parse(readFileSync(flags.get('--selection'), 'utf8')),
    };
  const { report, lock } = prepareConsumerLock({
    assetRoot: flags.get('--root'), manifest, requirements,
  });
  if (!lock) {
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 2;
    return;
  }
  if (flags.has('--out')) {
    writeNewLock(flags.get('--out'), lock, { assetRoot: flags.get('--root') });
    console.log('Created private metadata-only consumer lock: ' + resolve(flags.get('--out')) +
      ' (' + lock.assetCount + ' verified paths; revision ' + lock.revision + ')');
  } else {
    console.log(JSON.stringify(lock, null, 2));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error('CONSUMER LOCK FAILED:', error.message); process.exitCode = 1; }
}
