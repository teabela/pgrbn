import { readFile, writeFile, mkdir, rm, rename } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const HTML = 'umrlice.html';
const ASSETS = path.join('assets', 'umrlice');
const CONTENT = path.join('content', 'umrlice');

const html = await readFile(HTML, 'utf8');

// 1. Parse current on-page order (document order = visible grid, then archive).
const ANCHOR = /<a href="assets\/umrlice\/(\d{4})\/(\d{2})\/([^"]+?)\.webp" data-lightbox>/g;
const order = [];
let m;
while ((m = ANCHOR.exec(html))) order.push({ year: m[1], month: m[2], name: m[3] });
if (order.length !== 327) throw new Error(`Expected 327 anchors, found ${order.length}`);

// Visible count = anchors before the archive block.
const archiveIdx = html.indexOf('obituary-archive');
const visibleCount = (html.slice(0, archiveIdx).match(/data-lightbox/g) || []).length;
if (visibleCount !== 36) throw new Error(`Expected 36 visible, found ${visibleCount}`);

// 2. Assert months are monotonically non-increasing (guarantees synthetic dates reproduce order).
let prevKey = Infinity;
for (const e of order) {
  const key = Number(e.year) * 12 + Number(e.month);
  if (key > prevKey) throw new Error(`Months not monotonic near ${e.year}/${e.month}`);
  prevKey = key;
}

// 3. Snapshot for the equivalence checker (before mutating anything).
await mkdir('scripts', { recursive: true });
await writeFile('scripts/pre-migration-order.json',
  JSON.stringify({ visibleCount, order }, null, 2), 'utf8');

// 4. Assign synthetic dates: within each month, newest-first entries get the
//    latest seconds on day 1. Cross-month order falls out of the month itself.
const byMonth = new Map();
for (const e of order) {
  const k = `${e.year}/${e.month}`;
  if (!byMonth.has(k)) byMonth.set(k, []);
  byMonth.get(k).push(e);
}
for (const [k, arr] of byMonth) {
  const [Y, M] = k.split('/').map(Number);
  arr.forEach((e, i) => {
    const secs = arr.length - i; // i=0 (newest) → largest → sorts first
    e.date = new Date(Date.UTC(Y, M - 1, 1, 0, 0, secs)).toISOString();
  });
}

// 5. Create entries, move originals, delete old derivatives.
let moved = 0, deleted = 0;
for (const e of order) {
  const slug = e.name; // original basename is unique within its month folder
  const dir = path.join(CONTENT, e.year, e.month, slug);
  await mkdir(dir, { recursive: true });
  const md = matter.stringify('', { image: `${e.name}.webp`, date: e.date });
  await writeFile(path.join(dir, 'index.md'), md, 'utf8');

  const srcDir = path.join(ASSETS, e.year, e.month);
  await rename(path.join(srcDir, `${e.name}.webp`), path.join(dir, `${e.name}.webp`));
  moved++;
  for (const suf of ['-thumb.webp', '-thumb-2x.webp']) {
    await rm(path.join(srcDir, `${e.name}${suf}`), { force: true });
    deleted++;
  }
}

// 6. Remove the now-empty old tree.
await rm(ASSETS, { recursive: true, force: true });

// 7. Replace the baked grid in umrlice.html with bare markers.
//    Line-ending-agnostic: match the section open to its first close, preserve the file's newline.
const nl = html.includes('\r\n') ? '\r\n' : '\n';
const secRe = /(<section class="obituaries-section">)[\s\S]*?(<\/section>)/;
if (!secRe.test(html)) throw new Error('Could not locate obituaries-section to templatize');
const markers = `${nl}        <!-- UMRLICE-GRID:START -->${nl}        <!-- UMRLICE-GRID:END -->${nl}      `;
await writeFile(HTML, html.replace(secRe, `$1${markers}$2`), 'utf8');

console.log(`Migrated ${moved} umrlice (${deleted} derivative files deleted, ${visibleCount} visible).`);
