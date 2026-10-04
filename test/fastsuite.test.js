// FAST-SUITE (2026-10-04, Mac: "Our workflow is extremely slow"): HOW A LIST OF TEST FILES IS RUN - tools/testShards.mjs
// runTests, the one home `npm test` (`1/1`), a CI shard and `npm run test:changed` share: the files longest first by the
// recorded times (so the slowest no longer start last and run on alone), every core at once (Node's default leaves one
// idle), each file in its own process as before. The spawn is stood in: what is asserted is what would be run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runTests, shardsOf, testFiles } from '../tools/testShards.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const spy = (status = 0) => {
  const calls = [];
  const spawn = (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { status }; };
  return { calls, spawn };
};

test('FAST-SUITE: runTests runs the files longest first, every core at once, in one runner - and answers its status (mutants: name order; the default concurrency; the status dropped)', () => {
  const times = { 'test/a.test.js': 10, 'test/b.test.js': 900, 'test/c.test.js': 50 };
  const { calls, spawn } = spy(3);
  assert.equal(runTests(['test/a.test.js', 'test/b.test.js', 'test/c.test.js', 'test/d.test.js'], { times, cores: 4, spawn }), 3, 'the runner\'s own status');
  assert.equal(calls.length, 1, 'one runner for the list');
  const { cmd, args, opts } = calls[0];
  assert.equal(cmd, process.execPath);
  assert.deepEqual(args, ['--test', '--test-concurrency=4', 'test/b.test.js', 'test/c.test.js', 'test/d.test.js', 'test/a.test.js'],
    'the longest first; a file with no recorded time weighs the median (c\'s 50), ties by name');
  assert.equal(opts.stdio, 'inherit');
  assert.deepEqual(args.slice(2), shardsOf(Object.keys(times).concat('test/d.test.js'), 1, times)[0].files, 'the order is the shards\' own');
  // a machine's cores, whatever they are; never fewer than one at a time
  const one = spy();
  runTests(['test/a.test.js'], { times, cores: 0, spawn: one.spawn });
  assert.equal(one.calls[0].args[1], '--test-concurrency=1');
  // nothing to run runs nothing
  const none = spy();
  assert.equal(runTests([], { times, spawn: none.spawn }), 0);
  assert.equal(none.calls.length, 0);
});

test('FAST-SUITE: every door runs through it - npm test is the whole suite as one shard, a CI shard and test:changed call runTests, and nothing spawns its own `node --test` (mutants: a door with its own spawn)', () => {
  assert.equal(JSON.parse(read('package.json')).scripts.test, 'node tools/testShards.mjs 1/1');
  const shards = read('tools/testShards.mjs'), changed = read('tools/testChanged.mjs');
  assert.match(shards, /return runTests\(files\);\n\}/, 'a shard');
  assert.match(changed, /return runTests\(files\);\n\}/, 'the changed tests');
  assert.equal((shards.match(/\['--test'/g) ?? []).length, 1, 'one spawn of the runner, runTests\'');
  assert.doesNotMatch(changed, /\['--test'/, 'test:changed spawns none of its own');
  // 1/1 is every test file: the whole of testFiles in one shard
  const all = testFiles();
  assert.deepEqual([...shardsOf(all, 1, {})[0].files].sort(), all);
});
