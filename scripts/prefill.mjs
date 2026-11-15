/**
 * Identification roll prefill for pf15-identity-mask (0.8.4, TD-50b).
 *
 * Rolls happen on players' clients and the module has no socket, so the GM's
 * editor reads recent chat instead: a pf1 skill check is a ChatMessagePF with
 * type "check", system.subject.skill (e.g. "klo"), rolls[0].total and the
 * rolling user as author (probe P4, pf1 11.11). Pure; no globals.
 */

/** pf1 Knowledge skill ids (kar, kdu, ken, kge, khi, klo, kna, kno, kpl, kre). */
const KNOWLEDGE_RE = /^k[a-z]{2}$/;

/**
 * Latest qualifying check total per author, newest first.
 * @param {Iterable<object>} messages  Chat messages, oldest first (game.messages order).
 * @param {{skill?: string|null, now?: number, windowMs?: number, scan?: number}} [options]
 *   skill: match exactly or as a sub-skill prefix (`skill.`); null = any Knowledge.
 * @returns {Map<string, number>}  userId -> total.
 */
export function latestCheckTotals(messages, { skill = null, now = Date.now(), windowMs = 1_800_000, scan = 50 } = {}) {
  const out = new Map();
  const recent = Array.from(messages ?? []).slice(-scan).reverse();
  for ( const m of recent ) {
    if ( m?.type !== "check" ) continue;
    const userId = m.author?.id;
    if ( !userId || out.has(userId) ) continue;
    const total = m.rolls?.[0]?.total;
    if ( !Number.isFinite(total) ) continue;
    if ( !Number.isFinite(m.timestamp) || ((now - m.timestamp) > windowMs) ) continue;
    const id = m.system?.subject?.skill;
    if ( typeof id !== "string" ) continue;
    const match = skill ? ((id === skill) || id.startsWith(`${skill}.`)) : KNOWLEDGE_RE.test(id);
    if ( match ) out.set(userId, total);
  }
  return out;
}
