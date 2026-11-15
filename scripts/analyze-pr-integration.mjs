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

function validSnapshotDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date + 'T00:00:00Z')) &&
    new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date;
}

export function analyzePrIntegration(snapshot) {
  if (snapshot?.schemaVersion !== 1 || snapshot.defaultBranch !== 'main' ||
      snapshot.repositoryFullName !== 'Cesare-ml/astrological-assets' ||
      !/^[a-f0-9]{40}$/.test(snapshot.mainSha || '') ||
      !validSnapshotDate(snapshot.capturedDate) ||
      !Array.isArray(snapshot.prs) || snapshot.prs.length === 0 ||
      !Number.isSafeInteger(snapshot.openPrCount) ||
      snapshot.openPrCount !== snapshot.prs.length)
    throw new Error('Invalid integration snapshot header');

  const byNumber = new Map(), byHead = new Map();
  for (const pr of snapshot.prs) {
    if (!Number.isSafeInteger(pr?.number) || pr.number <= 0 ||
        typeof pr.head !== 'string' || !/^[a-z0-9][a-z0-9/_-]*$/.test(pr.head) ||
        typeof pr.base !== 'string' || !/^[a-z0-9][a-z0-9/_-]*$/.test(pr.base) ||
        !/^[a-f0-9]{40}$/.test(pr.headSha || '') ||
        typeof pr.draft !== 'boolean' ||
        !Array.isArray(pr.files) || pr.files.length === 0 ||
        pr.files.some(path => !validPath(path)) ||
        new Set(pr.files.map(path=>path.toLowerCase())).size !== pr.files.length)
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
  const overlaps = [], caseVariantOverlaps = [];
  const numbers = [...byNumber.keys()].sort((a,b)=>a-b);
  for (let i=0; i<numbers.length; i++) {
    for (let j=i+1; j<numbers.length; j++) {
      const left=numbers[i], right=numbers[j];
      if (ancestry.get(left).has(right) || ancestry.get(right).has(left)) continue;
      const shared = byNumber.get(left).files.filter(path => byNumber.get(right).files.includes(path)).sort();
      if (shared.length) overlaps.push({left, right, shared});
      // Windows and some offline filesystems fold case even when Git/Linux do not.
      const rightByFolded = new Map(byNumber.get(right).files.map(path=>[path.toLowerCase(), path]));
      const aliases = byNumber.get(left).files.flatMap(leftPath=>{
        const rightPath=rightByFolded.get(leftPath.toLowerCase());
        return rightPath && leftPath !== rightPath ? [{leftPath, rightPath}] : [];
      }).sort((a,b)=>a.leftPath.localeCompare(b.leftPath));
      if (aliases.length) caseVariantOverlaps.push({left, right, aliases});
    }
  }

  return {
    capturedDate:snapshot.capturedDate,
    repositoryFullName:snapshot.repositoryFullName,
    pinnedMainSha:snapshot.mainSha,
    prCount:numbers.length,
    pinnedHeads:numbers.map(number=>({pr:number,sha:byNumber.get(number).headSha})),
    order:ordered,
    chains:ordered.filter(number=>dependencies.get(number)!==null)
      .map(number=>({pr:number,requires:dependencies.get(number)})),
    potentialOverlaps:overlaps,
    caseVariantOverlaps,
    draftPrs:numbers.filter(number=>byNumber.get(number).draft),
    warnings:[
      'Snapshot only: refresh GitHub metadata and branch SHAs immediately before review.',
      'Shared filenames and case-folded aliases are review candidates, not proven merge conflicts.',
      'Passing a plan does not authorize merging, deploying or redistributing artwork.',
    ],
  };
}

/**
 * Compare two independently captured, local PR snapshots.
 * A changed commit or PR metadata makes the baseline STALE, never merge-ready.
 * The caller is responsible for collecting/authenticating the fresh snapshot.
 */
export function comparePrSnapshots(baseline, current) {
  analyzePrIntegration(baseline);
  analyzePrIntegration(current);
  const changes = [];
  if (baseline.mainSha !== current.mainSha)
    changes.push({kind:'main-advanced', before:baseline.mainSha, after:current.mainSha});
  const before = new Map(baseline.prs.map(pr=>[pr.number,pr]));
  const after = new Map(current.prs.map(pr=>[pr.number,pr]));
  for (const number of [...new Set([...before.keys(), ...after.keys()])].sort((a,b)=>a-b)) {
    const oldPr = before.get(number), newPr=after.get(number);
    if (!oldPr) {
      changes.push({kind:'pr-added', pr:number});
      continue;
    }
    if (!newPr) {
      changes.push({kind:'pr-removed', pr:number});
      continue;
    }
    for (const key of ['head','base','headSha','draft']) {
      if (oldPr[key] !== newPr[key])
        changes.push({kind:'pr-'+key+'-changed', pr:number, before:oldPr[key], after:newPr[key]});
    }
    const oldFiles=[...oldPr.files].sort(), newFiles=[...newPr.files].sort();
    if (JSON.stringify(oldFiles)!==JSON.stringify(newFiles))
      changes.push({kind:'pr-files-changed', pr:number});
  }
  return {
    currentMainSha:current.mainSha,
    readyForReview:changes.length===0,
    changes,
    warning:'A matching snapshot is not proof of live freshness or authorization to merge; independently authenticate the current data.',
  };
}

function main(args) {
  if (!([1,3].includes(args.length)) || args[0].startsWith('-') ||
      (args.length===3 && (args[1] !== '--current' || args[2].startsWith('-'))))
    throw new Error('Usage: node scripts/analyze-pr-integration.mjs <snapshot.json> [--current <fresh-snapshot.json>]');
  const baseline=JSON.parse(readFileSync(resolve(args[0]),'utf8'));
  const plan=analyzePrIntegration(baseline);
  if (args.length===1) {
    console.log(JSON.stringify(plan,null,2));
    return;
  }
  const current=JSON.parse(readFileSync(resolve(args[2]),'utf8'));
  const freshness=comparePrSnapshots(baseline,current);
  console.log(JSON.stringify({plan,freshness},null,2));
  if (!freshness.readyForReview) process.exitCode=2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error('PR INTEGRATION PLAN BLOCKED:', error.message); process.exitCode = 1; }
}
