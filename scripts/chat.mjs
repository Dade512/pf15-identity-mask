/**
 * Chat sender masking for pf15-identity-mask (0.3.0).
 *
 * Census-frozen scope: only the rendered sender display of chat messages
 * whose speaker carries scene+token ids resolving to a masked, unrevealed
 * registry entry. PF1 fills speaker.token/speaker.scene on its cards
 * (initiative, skills) as well as token-speaker messages, so the existing
 * registry key covers every confirmed leak.
 *
 * renderChatMessageHTML(message, html) passes a native HTMLElement and runs
 * per client; ChatMessage documents are never edited and GM display is
 * untouched. Message content/flavor and third-party surfaces deliberately
 * fail open (see spec section 15).
 */

import { getMaskEntry } from "./state.mjs";

/**
 * Handle renderChatMessageHTML.
 * @param {object} message      The ChatMessage document being rendered.
 * @param {HTMLElement} html    The rendered message element.
 */
export function onRenderChatMessageHTML(message, html) {
  if ( game.user.isGM || !(html instanceof HTMLElement) ) return;
  const sceneId = message?.speaker?.scene;
  const tokenId = message?.speaker?.token;
  if ( !sceneId || !tokenId ) return;
  let entry = null;
  try {
    entry = getMaskEntry({ sceneId, tokenId });
  }
  catch(err) {
    console.error("pf15-identity-mask | Failed to resolve chat mask", err);
    return;
  }
  if ( !entry || entry.revealed ) return;
  for ( const sender of html.querySelectorAll(".message-sender") ) {
    replaceTextNodes(sender, entry.alias);
  }
}

/**
 * Replace only text-node content inside `el`, preserving child elements
 * (icons, links) added by other modules. The first non-empty text node
 * receives `text`; any further non-empty text nodes are blanked.
 * @param {Element} el
 * @param {string} text
 */
function replaceTextNodes(el, text) {
  let first = true;
  for ( const node of el.childNodes ) {
    if ( node.nodeType !== Node.TEXT_NODE ) continue;
    if ( !node.textContent.trim() ) continue;
    node.textContent = first ? text : "";
    first = false;
  }
}
