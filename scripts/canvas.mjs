/**
 * Canvas masking for pf15-identity-mask: nameplate text + token art.
 *
 * Nameplate (0.2.0): core sets `token.nameplate.text = document.name` in
 * _refreshNameplate() on the refreshNameplate flag; the public refreshToken
 * hook fires immediately after, so overwriting the text there (and on
 * drawToken's first paint) supersedes core using the same public property.
 *
 * Token art (0.6.1, Phase B): for non-GM clients, while a creature is
 * masked/partial the rendered mesh texture is replaced with mystery art
 * (mysteryArtFor); the GM always sees true art. Core loads the texture once in
 * _draw and binds it (PrimaryCanvasGroup.addToken: `mesh.texture =
 * token.texture`); a visibility/refresh does NOT re-derive it, so a swap
 * persists until the next full redraw. We therefore (re)apply on drawToken
 * (where the mesh is freshly true-textured) and on registry change
 * (syncTokenArt), tracking the applied src on the placeable to avoid redundant
 * loads and to restore the true texture on reveal/unmask. Texture is loaded via
 * the public foundry.canvas.loadTexture and assigned to the same public
 * mesh.texture property core writes. Display-only: the TokenDocument is never
 * mutated. Dynamic-ring tokens fail open (true art) — masking the ring subject
 * is out of scope (documented).
 */

import { getMaskEntry, maskedNameFor, mysteryArtFor, refForTokenDocument } from "./state.mjs";

/**
 * Handle drawToken: mask the nameplate before first paint, and (re)apply the
 * token-art swap against the freshly-rebuilt (true-textured) mesh.
 * @param {object} token  The Token placeable.
 */
export function onDrawToken(token) {
  maskNameplate(token);
  // The redraw rebuilt the mesh with the true texture; clear our applied-src
  // marker so applyArtMask re-swaps to mystery art when masked.
  if ( token ) token._pf15imArtSrc = null;
  applyArtMask(token);
}

/**
 * Handle refreshToken: re-apply the nameplate mask after core resets the plate
 * text. (Token art is NOT re-derived on refresh, so it needs no reapply here.)
 * @param {object} token   The Token placeable.
 * @param {object} flags   The render flags that were just applied.
 */
export function onRefreshToken(token, flags) {
  if ( flags && !flags.refreshNameplate ) return;
  maskNameplate(token);
}

/**
 * Replace the nameplate text with the tier display name for non-GM users.
 * Unmasked or revealed-tier tokens are never touched.
 * @param {object} token  The Token placeable.
 */
function maskNameplate(token) {
  if ( game.user.isGM ) return;
  const nameplate = token?.nameplate;
  if ( !nameplate ) return;
  let entry = null;
  try {
    entry = getMaskEntry(refForTokenDocument(token.document));
  }
  catch(err) {
    console.error("pf15-identity-mask | Failed to resolve nameplate mask", err);
    return;
  }
  const shown = maskedNameFor(entry);
  if ( !shown ) return;
  // PIXI text assignment — same property core writes; plain text, no markup.
  nameplate.text = shown;
}

/**
 * Swap the player-rendered token texture to mystery art while masked/partial,
 * or restore the true texture on reveal/unmask. Non-GM only; dynamic-ring
 * tokens fail open. Tracks the applied src on token._pf15imArtSrc to skip
 * redundant loads. Async (texture load); any failure leaves the true art.
 * @param {object} token  The Token placeable.
 */
async function applyArtMask(token) {
  if ( game.user.isGM ) return;
  const doc = token?.document;
  if ( !token?.mesh || !doc ) return;
  // Dynamic-ring tokens render through a ring shader/subject — fail open.
  if ( doc.ring?.enabled ) return;
  let entry = null;
  try {
    entry = getMaskEntry(refForTokenDocument(doc));
  }
  catch(err) {
    console.error("pf15-identity-mask | Failed to resolve token-art mask", err);
    return;
  }
  const desired = mysteryArtFor(entry);          // mystery path, or null for true art
  const applied = token._pf15imArtSrc ?? null;
  if ( desired === applied ) return;             // already correct
  try {
    const src = desired ?? doc.texture.src;
    const fallback = desired ? "icons/svg/mystery-man.svg" : CONST.DEFAULT_TOKEN;
    const tex = await foundry.canvas.loadTexture(src, { fallback });
    // Race guard (Lyra 0.6.1 audit): the mask state may have changed while the
    // texture loaded. Re-resolve the desired art; if it moved on, skip and let
    // the newer applyArtMask call apply the current state (avoids a stale load
    // clobbering newer art). Assigns the same public property core assigns.
    let current = null;
    try { current = mysteryArtFor(getMaskEntry(refForTokenDocument(doc))); }
    catch(err) { return; }
    if ( current !== desired ) return;
    if ( token.mesh ) token.mesh.texture = tex;
    token._pf15imArtSrc = desired;
  }
  catch(err) {
    console.error("pf15-identity-mask | token-art swap failed", err);
  }
}

/**
 * Re-evaluate every placeable's token art after a registry change (mask added/
 * removed, tier changed, or default art changed). Non-GM only.
 */
export function syncTokenArt() {
  if ( game.user.isGM ) return;
  for ( const token of canvas?.tokens?.placeables ?? [] ) applyArtMask(token);
}
