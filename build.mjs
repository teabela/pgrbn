import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import sharp from 'sharp';

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, 'content', 'umrlice');
const DIST = path.join(ROOT, 'dist');

const VISIBLE_COUNT = 36; // newest-N in the visible grid; rest go to the archive
const SIZES = '(min-width: 2080px) 1150px, (min-width: 807px) 767px, calc(100vw - 40px)';
const THUMB = 900;
const THUMB2X = 1536;

// Everything at repo root is copied into dist/ verbatim EXCEPT these (build inputs / tooling).
const EXCLUDE = new Set([
  'node_modules', 'dist', 'content', 'scripts', '.git', '.github', 'docs',
  'build.mjs', 'package.json', 'package-lock.json', '.nvmrc', '.gitignore',
]);

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

async function loadEntries() {
  const files = await walk(CONTENT_DIR);
  const entries = [];
  for (const file of files) {
    const { data } = matter(await readFile(file, 'utf8'));
    if (!data.date) throw new Error(`Missing 'date' in ${file}`);
    // Legacy entries store a quoted ISO string (fake seconds preserve intra-day
    // order); new CMS entries store date-only YYYY-MM-DD, which js-yaml may hand
    // us as a Date. `new Date()` normalizes both.
    const when = new Date(data.date);
    if (Number.isNaN(when.getTime())) throw new Error(`Unparseable 'date' in ${file}: ${data.date}`);
    // Canonical shape is `images` (ordered list); tolerate pre-migration `image`.
    const names = Array.isArray(data.images) ? data.images
      : (data.image ? [data.image] : []);
    if (names.length === 0) throw new Error(`Missing 'images' in ${file}`);
    for (const n of names) {
      // A URL here means someone pasted a link in the CMS instead of uploading
      // the file; there is no local image to copy/thumbnail. Fail loud and early.
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(String(n))) {
        throw new Error(`Remote URL in 'images' of ${file}: ${n} — upload the image file itself, not a link`);
      }
    }
    // Public YYYY/MM come from the entry's on-disk location, not the date field.
    const rel = path.relative(CONTENT_DIR, file); // YYYY/MM/slug/index.md
    const [year, month, slugDir] = rel.split(path.sep);
    if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) {
      throw new Error(`Entry not under YYYY/MM: ${file}`);
    }
    const created = data.created ? new Date(data.created).getTime() : 0;
    if (Number.isNaN(created)) throw new Error(`Unparseable 'created' in ${file}: ${data.created}`);
    entries.push({
      when, created, year, month, slugDir,
      images: names.map((n) => ({
        base: path.basename(n).replace(/\.[^.]+$/, ''),
        srcImage: path.join(path.dirname(file), n),
      })),
    });
  }
  // Newest date first; hidden `created` breaks same-date ties across entries
  // (legacy datetimes carry distinct seconds so they never tie); folder slug is
  // the stable last resort. Within an entry, the client's list order rules.
  entries.sort((a, b) =>
    (b.when - a.when) || (b.created - a.created) || a.slugDir.localeCompare(b.slugDir));
  return entries;
}

function flattenToItems(entries) {
  const used = new Set();
  const items = [];
  for (const e of entries) {
    for (const img of e.images) {
      // Two same-named uploads in one YYYY/MM would collide in assets/ (was a
      // silent overwrite). Dedupe deterministically in grid order.
      let outBase = img.base;
      for (let n = 2; used.has(`${e.year}/${e.month}/${outBase}`); n++) {
        outBase = `${img.base}-${n}`;
      }
      used.add(`${e.year}/${e.month}/${outBase}`);
      items.push({ year: e.year, month: e.month, base: outBase, srcImage: img.srcImage });
    }
  }
  return items;
}

async function copyStatic() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  for (const e of await readdir(ROOT, { withFileTypes: true })) {
    // Never publish tooling/build inputs or ANY dot-prefixed entry (.git, .playwright-mcp,
    // .figma-token, .claude…). No dotfile is a site asset, and this keeps secrets out of dist.
    if (EXCLUDE.has(e.name) || e.name.startsWith('.')) continue;
    await cp(path.join(ROOT, e.name), path.join(DIST, e.name), { recursive: true });
  }
}

async function emitImages(entries) {
  for (const e of entries) {
    const outDir = path.join(DIST, 'assets', 'umrlice', e.year, e.month);
    await mkdir(outDir, { recursive: true });
    const full = path.join(outDir, `${e.base}.webp`);
    // Full image (lightbox target): copy WebP sources verbatim — no lossy recompression.
    // Encode only in the unexpected case that a source is not already WebP.
    if (path.extname(e.srcImage).toLowerCase() === '.webp') {
      await cp(e.srcImage, full);
    } else {
      await sharp(e.srcImage).webp({ quality: 90 }).toFile(full);
    }
    const w = (await sharp(e.srcImage).metadata()).width || THUMB2X;
    await sharp(e.srcImage)
      .resize({ width: Math.min(THUMB, w), withoutEnlargement: true })
      .webp({ quality: 85 }).toFile(path.join(outDir, `${e.base}-thumb.webp`));
    await sharp(e.srcImage)
      .resize({ width: Math.min(THUMB2X, w), withoutEnlargement: true })
      .webp({ quality: 85 }).toFile(path.join(outDir, `${e.base}-thumb-2x.webp`));
  }
}

function anchor(e) {
  const dir = `assets/umrlice/${e.year}/${e.month}`;
  return `            <a href="${dir}/${e.base}.webp" data-lightbox>`
    + `<img src="${dir}/${e.base}-thumb.webp" `
    + `srcset="${dir}/${e.base}-thumb.webp 900w, ${dir}/${e.base}-thumb-2x.webp 1536w" `
    + `sizes="${SIZES}" alt="Umrlica ${e.year}" loading="lazy"></a>`;
}

function renderInner(entries) {
  const visible = entries.slice(0, VISIBLE_COUNT).map(anchor).join('\n');
  const archive = entries.slice(VISIBLE_COUNT).map(anchor).join('\n');
  return [
    '        <div class="obituary-grid">',
    visible,
    '        </div>',
    '        <button class="btn-show-older" type="button" data-show-older>Prikaži starije umrlice</button>',
    '        <div class="obituary-archive" hidden>',
    '          <div class="obituary-grid">',
    archive,
    '          </div>',
    '        </div>',
  ].join('\n');
}

async function injectGrid(entries) {
  const file = path.join(DIST, 'umrlice.html');
  const html = await readFile(file, 'utf8');
  const nl = html.includes('\r\n') ? '\r\n' : '\n';
  const re = /<!-- UMRLICE-GRID:START -->[\s\S]*?<!-- UMRLICE-GRID:END -->/;
  if (!re.test(html)) throw new Error('UMRLICE-GRID markers not found in umrlice.html');
  const block = `<!-- UMRLICE-GRID:START -->\n${renderInner(entries)}\n        <!-- UMRLICE-GRID:END -->`.replace(/\n/g, nl);
  await writeFile(file, html.replace(re, block), 'utf8');
}

async function main() {
  if (!existsSync(CONTENT_DIR)) throw new Error(`No content at ${CONTENT_DIR}`);
  const entries = await loadEntries();
  if (entries.length === 0) throw new Error('No umrlice entries found — refusing to build an empty grid');
  const items = flattenToItems(entries);
  await copyStatic();
  await emitImages(items);
  await injectGrid(items);
  console.log(`Built ${items.length} umrlice images (${Math.min(VISIBLE_COUNT, items.length)} visible) from ${entries.length} entries.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
