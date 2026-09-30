// FB0930-FRAME (2026-09-30, a player's screenshot from a loaded save in a dungeon): the desktop window's title
// still read "Daggerfall Online - loading the saved game" long after the save had loaded. The world host names each
// boot step in the title and never took the last one down. These pin the boot's close.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** main.js's status closure, lifted and run against a stand-in document. */
function statusOf() {
  const src = read('src/main.js');
  const m = src.match(/const status = \(msg\) => \{\n([\s\S]*?)\n {2}\};/);
  assert.ok(m, 'main.js keeps its status closure');
  const doc = { title: 'Daggerfall Online' };
  return { doc, status: new Function('document', `return (msg) => {\n${m[1]}\n};`)(doc) };
}

test('FB0930-FRAME: a boot step names itself in the title, and a null step is the bare name', () => {
  const { doc, status } = statusOf();
  status('loading the saved game');
  assert.equal(doc.title, 'Daggerfall Online - loading the saved game');
  status(null);
  assert.equal(doc.title, 'Daggerfall Online');
  status(undefined);
  assert.equal(doc.title, 'Daggerfall Online', 'an absent step is the boot done too');
});

test('FB0930-FRAME: the world host takes its last boot step down where the loop is claimed, before the frame is defined', () => {
  const src = read('src/scenes/world.js');
  // at the boot's own level, between the loop's claim and frame() - never inside the frame, and the PERF1 pin's
  // closing shape (frameEnd, the re-arm, the first ask) is left as it stands
  assert.match(src, /\n {2}const _frameToken = claimFrame\(\);[^\n]*\n {2}status\(null\);[^\n]*\n {2}function frame\(now\) \{/);
  const statusCalls = [...src.matchAll(/(?<![.\w])status\(/g)].map((m) => m.index);
  assert.equal(statusCalls.at(-1), src.lastIndexOf('status(null);'), 'nothing names a boot step after the boot is done');
});
