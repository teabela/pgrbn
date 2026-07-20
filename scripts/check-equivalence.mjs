import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const ANCHOR = /<a href="assets\/umrlice\/(\d{4})\/(\d{2})\/([^"]+?)\.webp"/g;

function anchors(html) {
  const out = [];
  let m;
  while ((m = ANCHOR.exec(html))) out.push(`${m[1]}/${m[2]}/${m[3]}`);
  return out;
}

const snap = JSON.parse(await readFile('scripts/pre-migration-order.json', 'utf8'));
const pre = snap.order.map((e) => `${e.year}/${e.month}/${e.name}`);

const html = await readFile('dist/umrlice.html', 'utf8');
const archiveIdx = html.indexOf('obituary-archive');
assert.notEqual(archiveIdx, -1, 'no obituary-archive block in built page');
const post = anchors(html);
const postVisible = anchors(html.slice(0, archiveIdx)).length;

assert.equal(post.length, pre.length, `count: built ${post.length} != snapshot ${pre.length}`);
assert.equal(postVisible, snap.visibleCount, `visible: built ${postVisible} != snapshot ${snap.visibleCount}`);
for (let i = 0; i < pre.length; i++) {
  assert.equal(post[i], pre[i], `order mismatch at ${i}: built ${post[i]} != snapshot ${pre[i]}`);
}
console.log(`OK: ${post.length} entries, ${postVisible} visible — image list, order and archive split identical.`);
