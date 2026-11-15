import { test } from "node:test";
import assert from "node:assert/strict";
import { installStub } from "./_stub.mjs";

installStub({ mysteryArt: "assets/mystery.webp" });
const { isMaskedArtChange } = await import("../scripts/canvas.mjs");

const masked = { alias: "A", partialAlias: null, displayTier: "masked", mysteryArt: null, profileId: null };
const partial = { ...masked, displayTier: "partial" };
const revealed = { ...masked, displayTier: "revealed" };

test("masked + nested src → true", () => {
  assert.equal(isMaskedArtChange(masked, { texture: { src: "x.webp" } }), true);
});

test("partial + flat \"texture.src\" → true", () => {
  assert.equal(isMaskedArtChange(partial, { "texture.src": "x.webp" }), true);
});

test("revealed → false", () => {
  assert.equal(isMaskedArtChange(revealed, { texture: { src: "x.webp" } }), false);
});

test("no entry → false", () => {
  assert.equal(isMaskedArtChange(null, { texture: { src: "x.webp" } }), false);
});

test("masked + texture.tint only → false", () => {
  assert.equal(isMaskedArtChange(masked, { texture: { tint: "#ff0000" } }), false);
});

test("masked + x/y move → false", () => {
  assert.equal(isMaskedArtChange(masked, { x: 100, y: 200 }), false);
});
