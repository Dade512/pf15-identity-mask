import { test } from "node:test";
import assert from "node:assert/strict";
import { latestCheckTotals } from "../scripts/prefill.mjs";

const NOW = 1_000_000_000;
const msg = (author, skill, total, ageMs = 0, type = "check") => ({
  type, timestamp: NOW - ageMs, author: author ? { id: author } : null,
  system: { subject: { skill } }, rolls: total === undefined ? [] : [{ total }]
});
const run = (messages, opts = {}) => latestCheckTotals(messages, { now: NOW, ...opts });

test("newest roll per author wins", () => {
  // Chat order is oldest first.
  const out = run([msg("u1", "klo", 10, 5000), msg("u1", "klo", 18, 1000), msg("u2", "kar", 7, 2000)]);
  assert.equal(out.get("u1"), 18);
  assert.equal(out.get("u2"), 7);
});

test("non-check messages ignored", () => {
  const out = run([msg("u1", "klo", 18, 0, "base")]);
  assert.equal(out.size, 0);
});

test("older than 30 min ignored", () => {
  const out = run([msg("u1", "klo", 18, 1_800_001), msg("u2", "klo", 9, 1_800_000)]);
  assert.equal(out.has("u1"), false);
  assert.equal(out.get("u2"), 9);
});

test("skill filter exact and sub-skill prefix", () => {
  const out = run([msg("u1", "klo", 18), msg("u2", "kar", 12), msg("u3", "lor.sub1", 11)], { skill: "klo" });
  assert.deepEqual([...out.keys()], ["u1"]);
  const lore = run([msg("u3", "lor.sub1", 11), msg("u4", "lorx", 5)], { skill: "lor" });
  assert.deepEqual([...lore.keys()], ["u3"]);
});

test("null skill accepts klo, rejects per", () => {
  const out = run([msg("u1", "klo", 18), msg("u2", "per", 20)]);
  assert.deepEqual([...out.keys()], ["u1"]);
});

test("scan limit honoured (51st message ignored)", () => {
  const messages = [msg("old", "klo", 3, 10)];
  for ( let i = 0; i < 50; i++ ) messages.push(msg(`u${i}`, "per", 1));
  assert.equal(run(messages).has("old"), false);
  assert.equal(run(messages.slice(-50).concat()).size, 0);
  assert.equal(run([msg("old", "klo", 3, 10), ...messages.slice(-49)]).get("old"), 3);
});

test("missing author or total ignored", () => {
  const out = run([msg(null, "klo", 18), msg("u1", "klo", undefined), msg("u2", "klo", NaN)]);
  assert.equal(out.size, 0);
});
