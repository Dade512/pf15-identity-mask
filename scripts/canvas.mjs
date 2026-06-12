/**
 * Canvas nameplate masking for pf15-identity-mask.
 *
 * Core sets `token.nameplate.text = document.name` in _refreshNameplate()
 * whenever the refreshNameplate render flag applies, and the public
 * refreshToken(token, flags) hook fires immediately AFTER flags apply
 * (placeable-object.mjs), so overwriting the text here supersedes core's
 * assignment using the same public property core writes.
 *
 * drawToken(token) fires after the nameplate is created but while the
 * placeable is still visible=false — masking there prevents any first-paint
 * true-name flash.
 *
 * Display-only: the TokenDocument is never touched, and nameplate
 * visibility/display-mode logic is core's alone (we change text, not
 * visibility).
 */

import { getMaskEntry, refForTokenDocument } from "./state.mjs";

/**
 * Handle drawToken: mask before the token's first paintable frame.
 * @param {object} token  The Token placeable.
 */
export function onDrawToken(token) {
  maskNameplate(token);
}

/**
 * Handle refreshToken: re-apply the mask after core resets the plate text.
 * @param {object} token   The Token placeable.
 * @param {object} flags   The render flags that were just applied.
 */
export function onRefreshToken(token, flags) {
  if ( flags && !flags.refreshNameplate ) return;
  maskNameplate(token);
}

/**
 * Replace the nameplate text with the alias for non-GM users while masked.
 * Unmasked or revealed tokens are never touched (core text is correct).
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
  if ( !entry || entry.revealed ) return;
  // PIXI text assignment — same property core writes; plain text, no markup.
  nameplate.text = entry.alias;
}
