// One-time (idempotent) migration: frontmatter `image: <name>` -> `images:\n  - <name>`.
// Plain-text line replacement so every other byte (incl. the date quoting that
// preserves intra-day order) stays identical. See spec 2026-07-13.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

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

let changed = 0, already = 0;
for (const file of await walk(CONTENT_DIR)) {
  const text = await readFile(file, 'utf8');
  if (/^images:/m.test(text)) { already++; continue; }
  const m = text.match(/^image:[ \t]*(.+?)[ \t\r]*$/m);
  if (!m) throw new Error(`No 'image:' line in ${file}`);
  await writeFile(file, text.replace(m[0], `images:\n  - ${m[1]}`), 'utf8');
  changed++;
}
console.log(`Migrated ${changed} entries to images list (${already} already migrated).`);
