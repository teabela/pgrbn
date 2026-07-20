// One-time (idempotent) consolidation: merge all entries sharing the same date
// into ONE entry whose `images` list preserves the exact page order (the
// build's newest-first sort). This makes the existing gallery manually
// reorderable in the CMS — drag images within a date's entry. Legacy dates
// carried fake incrementing seconds purely to encode order; once the order
// lives in the list, dates collapse to plain YYYY-MM-DD.
// Run scripts/check-equivalence.mjs afterwards: built output must be identical.
import { readFile, writeFile, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'umrlice');

async function walk(dir) {
  const out = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (e.name === 'index.md') out.push(p);
  }
  return out;
}

const entries = [];
for (const file of await walk(CONTENT_DIR)) {
  const { data } = matter(await readFile(file, 'utf8'));
  if (!data.date) throw new Error(`Missing 'date' in ${file}`);
  const when = new Date(data.date);
  if (Number.isNaN(when.getTime())) throw new Error(`Unparseable 'date' in ${file}: ${data.date}`);
  const names = Array.isArray(data.images) ? data.images : (data.image ? [data.image] : []);
  if (names.length === 0) throw new Error(`No images in ${file}`);
  const dir = path.dirname(file);
  const [year, month] = path.relative(CONTENT_DIR, dir).split(path.sep);
  const dateKey = when.toISOString().slice(0, 10);
  if (!dateKey.startsWith(`${year}-${month}`)) {
    throw new Error(`Date ${dateKey} disagrees with folder ${year}/${month}: ${file}`);
  }
  entries.push({ file, dir, when, dateKey, names, raw: String(data.date) });
}

const groups = new Map();
for (const e of entries) {
  if (!groups.has(e.dateKey)) groups.set(e.dateKey, []);
  groups.get(e.dateKey).push(e);
}

let mergedGroups = 0, removedFolders = 0, untouched = 0;
for (const [dateKey, group] of groups) {
  // Build's page order: newest first (the fake seconds descend down the page).
  group.sort((a, b) => b.when - a.when);
  const alreadyClean = group.length === 1 && group[0].raw === dateKey;
  if (alreadyClean) { untouched++; continue; }

  const target = group[0];
  const list = group.flatMap((e) => e.names.map((name) => ({ e, name })));
  const seen = new Set();
  for (const { name } of list) {
    if (seen.has(name)) throw new Error(`Duplicate image name '${name}' on ${dateKey} — resolve manually`);
    seen.add(name);
  }
  for (const { e, name } of list) {
    if (e === target) continue;
    await rename(path.join(e.dir, name), path.join(target.dir, name));
  }
  const fm = [
    '---',
    'images:',
    ...list.map(({ name }) => `  - ${name}`),
    `date: '${dateKey}'`,
    '---',
    '',
    '',
  ].join('\n');
  await writeFile(path.join(target.dir, 'index.md'), fm, 'utf8');
  for (const e of group) {
    if (e === target) continue;
    await rm(e.dir, { recursive: true });
    removedFolders++;
  }
  mergedGroups++;
}
console.log(`Consolidated ${mergedGroups} dates (${removedFolders} folders removed, ${untouched} already clean); ${groups.size} entries total.`);
