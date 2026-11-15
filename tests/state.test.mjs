import { test } from "node:test";
import assert from "node:assert/strict";
import { installStub } from "./_stub.mjs";

const state = await import("../scripts/state.mjs");
const ref = { sceneId: "S1", tokenId: "T1" };
const KEY = "S1:T1";
const full = {
  alias: "Probe",
  partialAlias: "P?",
  mysteryArt: "a.webp",
  profileId: "",
  identification: { skill: "klo", dc: 15, publicNote: "", rolls: {} }
};

test("setEntry new entry writes once", async () => {
  const s = installStub();
  assert.equal(await state.setEntry(ref, full), true);
  assert.equal(s.writes(), 1);
  assert.deepEqual(s.registry().entries[KEY], {
    alias: "Probe", displayTier: "masked", partialAlias: "P?", mysteryArt: "a.webp",
    identification: { skill: "klo", dc: 15, publicNote: "", rolls: {} }
  });
});

test("setEntry unchanged writes nothing", async () => {
  const s = installStub();
  await state.setEntry(ref, full);
  assert.equal(await state.setEntry(ref, full), false);
  assert.equal(s.writes(), 1);
});

test("setEntry alias-only change writes once and keeps tier", async () => {
  const s = installStub({ registry: { _v: 3, entries: { [KEY]: { alias: "Old", displayTier: "partial", partialAlias: "P?" } } } });
  assert.equal(await state.setEntry(ref, { alias: "New", partialAlias: "P?", mysteryArt: "", profileId: "", identification: null }), true);
  assert.equal(s.writes(), 1);
  assert.deepEqual(s.registry().entries[KEY], { alias: "New", displayTier: "partial", partialAlias: "P?" });
});

test("setEntry empty alias clears the entry", async () => {
  const s = installStub({ registry: { _v: 3, entries: { [KEY]: { alias: "Old", displayTier: "masked" } } } });
  await state.setEntry(ref, { ...full, alias: "  " });
  assert.equal(KEY in s.registry().entries, false);
});

test("setEntry empty mysteryArt clears the override", async () => {
  const s = installStub({ registry: { _v: 3, entries: { [KEY]: { alias: "Probe", displayTier: "masked", mysteryArt: "x.webp" } } } });
  await state.setEntry(ref, { alias: "Probe", partialAlias: "", mysteryArt: "", profileId: "", identification: null });
  assert.equal("mysteryArt" in s.registry().entries[KEY], false);
});

test("setEntry keeps updatedAt for unchanged roll", async () => {
  const stored = { alias: "Probe", displayTier: "masked",
    identification: { skill: "klo", dc: 15, publicNote: "", rolls: { u1: { total: 16, outcome: "identified", updatedAt: 111 } } } };
  const s = installStub({ registry: { _v: 3, entries: { [KEY]: stored } } });
  const same = { alias: "Probe", partialAlias: "", mysteryArt: "", profileId: "",
    identification: { skill: "klo", dc: 15, publicNote: "", rolls: { u1: { total: 16, outcome: "identified" } } } };
  assert.equal(await state.setEntry(ref, same), false);
  assert.equal(s.writes(), 0);
  same.identification.rolls.u1.total = 17;
  assert.equal(await state.setEntry(ref, same), true);
  assert.ok(s.registry().entries[KEY].identification.rolls.u1.updatedAt > 111);
});

test("setEntry refuses for non-GM", async () => {
  const s = installStub({ isGM: false });
  assert.equal(await state.setEntry(ref, full), false);
  assert.equal(s.writes(), 0);
});
