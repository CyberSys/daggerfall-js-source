import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMotherlodeBook } from '../src/net/motherlodeBook.js';
import { mintWatchReceipt } from '../src/net/watchReceipt.js';

test('Motherlodes: a pending response cannot become the next account\'s state', async () => {
  let account = 'account-a';
  let finish;
  let calls = 0;
  const book = createMotherlodeBook({
    character: () => 'char-shared', me: () => account, nowS: () => 1800000000, nowMs: () => 1000,
    door: { motherlodes: () => { calls++; return new Promise(resolve => { finish = resolve; }); } },
  });
  const pending = book.read();
  account = 'account-b';
  finish({ ok: true, data: { day: 20833, lodes: [], found: 'mlode:20833:0' } });
  await pending;
  assert.equal(book.found(), null, 'discard the departed account\'s found marker');
  book.tick();
  assert.equal(calls, 2, 'the current account gets its own read immediately');
  finish({ ok: true, data: { day: 20833, lodes: [], found: null } });
  await Promise.resolve();
});

test('Motherlodes: a pending response cannot become the next character\'s state', async () => {
  let character = 'char-a';
  let finish;
  const book = createMotherlodeBook({
    character: () => character, me: () => 'account-a', nowS: () => 1800000000, nowMs: () => 1000,
    door: { motherlodes: () => new Promise(resolve => { finish = resolve; }) },
  });
  const pending = book.read();
  character = 'char-b';
  finish({ ok: true, data: { day: 20833, lodes: [], found: 'mlode:20833:0' } });
  await pending;
  assert.equal(book.found(), null);
});

test('Motherlodes: a Watch action checks account identity even within the frame cache interval', async () => {
  let account = 'account-a';
  const now = 1800000000;
  const keys = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const receipt = await mintWatchReceipt({ s: account, x: 300, y: 120, c: 1 }, keys.privateKey, { subtle: crypto.subtle, nowS: now });
  const book = createMotherlodeBook({
    character: () => 'char-a', me: () => account, nowS: () => now, nowMs: () => 1000,
    door: { motherlodes: async () => ({ ok: true, data: {} }) },
  });
  assert.equal(book.watch(receipt), true);
  account = 'account-b';
  assert.equal(book.watchFor(300, 120, 0), null, 'do not submit account A\'s receipt while B is signed in');
  assert.equal(book.watch(receipt), false);
});
