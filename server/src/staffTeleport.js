import { isStaff } from '../../src/net/staffCommands.js';
import { STAFF_TP_TIMEOUT_MS } from '../../src/net/staffTeleport.js';

const fold = (s) => String(s).toLowerCase().replace(/['\u2019]/g, '').replace(/[\s-]+/g, ' ').trim();

/** Only the verified target socket may answer a pending ticket. Nothing is
 * persisted or broadcast; an eviction cancels the lookup via the client's timer. */
export function routeStaffTeleport(room, ws, a, m, now) {
  const pending = room._staffTeleports ??= new Map();
  for (const [ticket, p] of pending) if (now >= p.expires || !room._all().has(p.from) || !room._all().has(p.target)) pending.delete(ticket);
  const result = (socket, nonce, fields) => room._send(socket, JSON.stringify({ t: 'stp', k: 'result', nonce, ...fields }));
  if (m.k === 'ask') {
    if (!isStaff(a.glyphs)) { result(ws, m.nonce, { error: 'denied' }); return; }
    const peers = [...room._all()].filter(([other, b]) => b.id && !room._dead.has(other) && !room._gone.has(other));
    let hits;
    if (m.id) hits = peers.filter(([, b]) => b.id === m.id);
    else {
      const name = fold(m.name);
      const exact = peers.filter(([, b]) => fold(b.name) === name);
      hits = exact.length ? exact : peers.filter(([, b]) => fold(b.name).startsWith(name));
    }
    if (hits.length !== 1) { result(ws, m.nonce, { error: hits.length ? 'ambiguous' : 'offline' }); return; }
    for (const [ticket, p] of pending) if (p.from === ws) pending.delete(ticket);
    if (pending.size >= 128) { result(ws, m.nonce, { error: 'busy' }); return; }
    const [target, b] = hits[0], ticket = crypto.randomUUID();
    pending.set(ticket, { from: ws, target, id: b.id, nonce: m.nonce, expires: now + STAFF_TP_TIMEOUT_MS });
    if (!room._send(target, JSON.stringify({ t: 'stp', k: 'capture', ticket }))) {
      pending.delete(ticket); result(ws, m.nonce, { error: 'offline' });
    }
    return;
  }
  const p = pending.get(m.ticket);
  if (!p || p.target !== ws || p.id !== a.id) return;
  pending.delete(m.ticket);
  const asker = room._all().get(p.from);
  if (!asker?.id || room._dead.has(p.from) || room._gone.has(p.from) || !isStaff(asker.glyphs)) return;
  result(p.from, p.nonce, m.error ? { error: m.error } : { id: a.id, name: a.name, dest: m.dest });
}
