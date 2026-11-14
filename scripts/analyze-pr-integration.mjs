#!/usr/bin/env node
// Offline, read-only PR integration analysis. A snapshot is not a live merge verdict.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function validPath(path) {
  return typeof path === 'string' && path.length > 0 &&
    !path.startsWith('/') && !path.includes('\\') && !path.includes('\0') &&
    !path.split('/').some(part => !part || part === '.' || part === '..') &&
    path.normalize('NFC') === path;
}

export function analyzePrIntegration(snapshot) {
  if (snapshot?.schemaVersion !== 1 || snapshot.defaultBranch !== 'main' ||
      !/^[a-f0-9]{40}$/.test(snapshot.mainSha || '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.capturedDate || '') ||
      !Array.isArray(snapshot.prs) || snapshot.prs.length === 0)
    throw new Error('Invalid integration snapshot header');

  const byNumber = new Map(), byHead = new Map();
  for (const pr of snapshot.prs) {
    if (!Number.isSafeInteger(pr?.number) || pr.number <= 0 ||
        typeof pr.head !== 'string' || !/^[a-z0-9][a-z0-9/_-]*$/.test(pr.head) ||
        typeof pr.base !== 'string' || !/^[a-z0-9][a-z0-9/_-]*$/.test(pr.base) ||
        typeof pr.draft !== 'boolean' ||
        !Array.isArray(pr.files) || pr.files.length === 0 ||
        pr.files.some(path => !validPath(path)) ||
        new Set(pr.files).size !== pr.files.length)
      throw new Error('Invalid PR metadata: ' + String(pr?.number));
    if (byNumber.has(pr.number) || byHead.has(pr.head))
      throw new Error('Duplicate PR number or branch: ' + pr.number);
    byNumber.set(pr.number, pr);
    byHead.set(pr.head, pr);
  }

  const dependencies = new Map(), visiting = new Set(), visited = new Set(), ordered = [];
  for (const pr of byNumber.values()) {
    if (pr.base === snapshot.defaultBranch) dependencies.set(pr.number, null);
    else {
      const parent = byHead.get(pr.base);
      if (!parent) throw new Error('Unknown parent PR branch for #' + pr.number + ': ' + pr.base);
      if (parent.number === pr.number) throw new Error('Self-dependent PR #' + pr.number);
      dependencies.set(pr.number, parent.number);
    }
  }
  const visit = number => {
    if (visited.has(number)) return;
    if (visiting.has(number)) throw new Error('PR dependency cycle at #' + number);
    visiting.add(number);
    const parent = dependencies.get(number);
    if (parent !== null) visit(parent);
    visiting.delete(number);
    visited.add(number);
    ordered.push(number);
  };
  for (const number of [...byNumber.keys()].sort((a,b)=>a-b)) visit(number);

  const ancestors = number => {
    const set = new Set();
    for (let parent = dependencies.get(number); parent !== null; parent = dependencies.get(parent))
      set.add(parent);
    return set;
  };
  const ancestry = new Map(ordered.map(number => [number, ancestors(number)]));
  const overlaps = [];
  const numbers = [...byNumber.keys()].sort((a,b)=>a-b);
  for (let i=0; i<numbers.length; i++) {
    for (let j=i+1; j<numbers.length; j++) {
      const left=numbers[i], right=numbers[j];
      if (ancestry.get(left).has(right) || ancestry.get(right).has(left)) continue;
      const shared = byNumber.get(left).files.filter(path => byNumber.get(right).files.includes(path)).sort();
      if (shared.length) overlaps.push({left, right, shared});
    }
  }

  return {
    capturedDate:snapshot.capturedDate,
    pinnedMainSha:snapshot.mainSha,
    prCount:numbers.length,
    order:ordered,
    chains:ordered.filter(number=>dependencies.get(number)!==null)
      .map(number=>({pr:number,requires:dependencies.get(number)})),
    potentialOverlaps:overlaps,
    draftPrs:numbers.filter(number=>byNumber.get(number).draft),
    warnings:[
      'Snapshot only: refresh GitHub metadata and branch SHAs immediately before review.',
      'Shared filenames are review candidates, not proven merge conflicts.',
      'Passing a plan does not authorize merging, deploying or redistributing artwork.',
    ],
  };
}

function main(args) {
  if (args.length !== 1 || args[0].startsWith('-'))
    throw new Error('Usage: node scripts/analyze-pr-integration.mjs <snapshot.json>');
  const snapshot = JSON.parse(readFileSync(resolve(args[0]), 'utf8'));
  console.log(JSON.stringify(analyzePrIntegration(snapshot), null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error('PR INTEGRATION PLAN BLOCKED:', error.message); process.exitCode = 1; }
}
