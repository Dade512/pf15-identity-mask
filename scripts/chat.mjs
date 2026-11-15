/**
 * Chat sender masking for pf15-identity-mask (0.3.0).
 *
 * Census-frozen scope: only the rendered sender display of chat messages
 * whose speaker carries scene+token ids resolving to a registry entry at
 * the masked or partial tier. PF1 fills speaker.token/speaker.scene on its cards
 * (initiative, skills) as well as token-speaker messages, so the existing
 * registry key covers every confirmed leak.
 *
 * renderChatMessageHTML(message, html) passes a native HTMLElement and runs
 * per client; ChatMessage documents are never edited and GM display is
 * untouched. Message content/flavor and third-party surfaces deliberately
 * fail open (see spec section 15).
 */

import { getMaskEntry, maskedNameFor, mysteryArtFor } from "./state.mjs";

/** chat-portrait's header image (class `chat-portrait-message-portrait-<systemId>`). */
const PORTRAIT_SELECTOR = 'img[class*="chat-portrait-message-portrait"]';

/** How long a rendered message is watched for chat-portrait's late image. */
const PORTRAIT_WATCH_MS = 10000;

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
  const shown = maskedNameFor(entry);
  if ( !shown ) return;
  for ( const sender of html.querySelectorAll(".message-sender") ) {
    replaceTextNodes(sender, shown);
  }
  const art = mysteryArtFor(entry);
  if ( art ) maskChatPortrait(html, art);
}

/**
 * Show mystery art in chat-portrait's header image for a masked speaker
 * (0.8.4, TD-51). Core calls renderChatMessageHTML (us) BEFORE the deprecated
 * renderChatMessage that chat-portrait uses, and chat-portrait builds its img
 * through a promise, so the image usually arrives after this handler. Swap any
 * image present now, then watch the message element briefly for a late insert
 * or src change. MutationObserver callbacks run before the next paint, so the
 * true portrait is never drawn. Display-only; the message is never edited.
 * @param {HTMLElement} html  The rendered message element.
 * @param {string} art        The mystery image path.
 */
export function maskChatPortrait(html, art) {
  const swap = () => {
    for ( const img of html.querySelectorAll(PORTRAIT_SELECTOR) ) {
      if ( img.getAttribute("src") === art ) continue;
      img.setAttribute("src", art);
      img.alt = "";
    }
  };
  swap();
  let wasConnected = html.isConnected;
  const observer = new MutationObserver(() => {
    if ( html.isConnected ) wasConnected = true;
    else if ( wasConnected ) { observer.disconnect(); return; }
    swap();
  });
  observer.observe(html, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
  setTimeout(() => observer.disconnect(), PORTRAIT_WATCH_MS);
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
