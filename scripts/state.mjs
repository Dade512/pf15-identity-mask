/**
 * Registry state management for pf15-identity-mask.
 *
 * All mask state lives in ONE world-scope setting: an object map of
 * "<sceneId>:<tokenId>" -> { alias: string, revealed: boolean }.
 *
 * World Setting writes require the SETTINGS_MODIFY permission (default
 * ASSISTANT+) and are enforced server-side as document permissions
 * (common/documents/setting.mjs #canModify). Combatant/Token flags were
 * rejected because actor-owner players may update them server-side
 * (common/documents/combatant.mjs #canUpdate allows "flags").
 *
 * The true name is never stored here — only the alias and reveal state.
 */

import { MODULE_ID, SETTING_REGISTRY, MAX_ALIAS_LENGTH } from "./const.mjs";

/**
 * A mask reference: anything carrying the scene and token ids of a placed
 * token. Combatant documents already have this shape; TokenDocuments use
 * refForTokenDocument().
 * @typedef {{sceneId: string, tokenId: string}} MaskRef
 */

/**
 * Register the world-scope registry setting. The onChange callback runs on
 * every connected client whenever the Setting document changes
 * (client/documents/setting.mjs _onCreate/_onUpdate), which is the module's
 * entire synchronization mechanism — no custom socket.
 */
export function registerSettings() {
  game.settings.register(MODULE_ID, SETTING_REGISTRY, {
    name: "PF15IM.Settings.Registry.Name",
    hint: "PF15IM.Settings.Registry.Hint",
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: () => { syncTracker(); syncChat(); syncNameplates(); }
  });
}

/**
 * Sync the combat tracker on registry change.
 * AbstractSidebarTab#render also renders the popout instances.
 */
function syncTracker() {
  try { ui.combat?.render(); }
  catch(err) { console.error(`${MODULE_ID} | registry onChange: tracker sync failed`, err); }
}

/**
 * Re-render already-posted chat messages that carry a token speaker.
 * ChatLog#render does not rebuild posted message elements, so each is
 * re-rendered individually via the public ChatLog#updateMessage.
 * Lazily-rendered scrollback goes through renderChatMessageHTML fresh.
 * Per-message try/catch so one bad message cannot abort the sweep or
 * the nameplate refresh that follows.
 */
function syncChat() {
  try {
    for ( const log of [ui.chat, ui.chat?.popout] ) {
      if ( !log?.rendered ) continue;
      for ( const li of log.element.querySelectorAll(".message[data-message-id]") ) {
        const message = game.messages.get(li.dataset.messageId);
        if ( !message?.speaker?.token ) continue;
        try { log.updateMessage(message); }
        catch(err) { console.error(`${MODULE_ID} | registry onChange: message update failed`, err); }
      }
    }
  }
  catch(err) { console.error(`${MODULE_ID} | registry onChange: chat sync failed`, err); }
}

/**
 * Request a text-only nameplate refresh for all placeables on the viewed
 * canvas. Tokens on other scenes re-mask through drawToken when their
 * scene renders.
 */
function syncNameplates() {
  try {
    for ( const token of canvas?.tokens?.placeables ?? [] ) {
      token.renderFlags.set({ refreshNameplate: true });
    }
  }
  catch(err) { console.error(`${MODULE_ID} | registry onChange: nameplate sync failed`, err); }
}

/**
 * Build a MaskRef from a TokenDocument.
 * @param {TokenDocument|null|undefined} doc
 * @returns {MaskRef|null}
 */
export function refForTokenDocument(doc) {
  const sceneId = doc?.parent?.id;
  const tokenId = doc?.id;
  if ( !sceneId || !tokenId ) return null;
  return { sceneId, tokenId };
}

/**
 * Derive the registry key for a mask reference (Combatant or MaskRef), or
 * null when it has no scene token (such subjects cannot be masked and
 * degrade to core behavior).
 * @param {MaskRef|Combatant|null|undefined} ref
 * @returns {string|null}
 */
export function getMaskKey(ref) {
  const sceneId = ref?.sceneId;
  const tokenId = ref?.tokenId;
  if ( !sceneId || !tokenId ) return null;
  return `${sceneId}:${tokenId}`;
}

/**
 * Read the mask entry for a mask reference (Combatant or MaskRef).
 * @param {MaskRef|Combatant|null|undefined} ref
 * @returns {{alias: string, revealed: boolean}|null}
 */
export function getMaskEntry(ref) {
  const key = getMaskKey(ref);
  if ( !key ) return null;
  const registry = game.settings.get(MODULE_ID, SETTING_REGISTRY) ?? {};
  const entry = registry[key];
  if ( !entry || (typeof entry.alias !== "string") ) return null;
  const alias = normalizeAlias(entry.alias);
  if ( !alias ) return null;
  return { alias, revealed: entry.revealed === true };
}

/**
 * Normalize untrusted alias input: strip control characters, collapse
 * whitespace, trim, and enforce the maximum length.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeAlias(value) {
  let alias = String(value ?? "");
  alias = alias.replace(/[\u0000-\u001f\u007f]/g, "");
  alias = alias.replace(/\s+/g, " ").trim();
  if ( alias.length > MAX_ALIAS_LENGTH ) alias = alias.slice(0, MAX_ALIAS_LENGTH).trim();
  return alias;
}

/**
 * Apply a mutation to a cloned registry and persist it. Fails fast with a
 * localized warning for non-GM users; the server would reject them anyway.
 * @param {(registry: object) => boolean} mutate  Return true if anything changed.
 * @returns {Promise<boolean>}  True when a write was persisted.
 */
async function updateRegistry(mutate) {
  if ( !game.user.isGM ) {
    ui.notifications.warn("PF15IM.Warn.GmOnly", { localize: true });
    return false;
  }
  const registry = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTING_REGISTRY) ?? {});
  if ( !mutate(registry) ) return false;
  try {
    await game.settings.set(MODULE_ID, SETTING_REGISTRY, registry);
    return true;
  }
  catch(err) {
    console.error(`${MODULE_ID} | Failed to persist registry`, err);
    ui.notifications.error("PF15IM.Warn.SaveFailed", { localize: true });
    return false;
  }
}

/**
 * Set or replace an alias. An empty normalized alias clears the mask
 * instead. Reveal state is preserved on edit.
 * @param {MaskRef|Combatant} ref
 * @param {unknown} rawAlias
 * @returns {Promise<boolean>}
 */
export async function setAlias(ref, rawAlias) {
  const key = getMaskKey(ref);
  if ( !key ) {
    ui.notifications.warn("PF15IM.Warn.NoToken", { localize: true });
    return false;
  }
  const alias = normalizeAlias(rawAlias);
  if ( !alias ) return clearAlias(ref);
  return updateRegistry(registry => {
    const prev = registry[key];
    if ( prev?.alias === alias ) return false;
    registry[key] = { alias, revealed: prev?.revealed === true };
    return true;
  });
}

/**
 * Remove a mask entry entirely, restoring core behavior.
 * @param {MaskRef|Combatant} ref
 * @returns {Promise<boolean>}
 */
export async function clearAlias(ref) {
  const key = getMaskKey(ref);
  if ( !key ) return false;
  return updateRegistry(registry => {
    if ( !(key in registry) ) return false;
    delete registry[key];
    return true;
  });
}

/**
 * Set the reveal state of an existing mask entry.
 * @param {MaskRef|Combatant} ref
 * @param {boolean} revealed
 * @returns {Promise<boolean>}
 */
export async function setRevealed(ref, revealed) {
  const key = getMaskKey(ref);
  if ( !key ) return false;
  return updateRegistry(registry => {
    const entry = registry[key];
    if ( !entry || (entry.revealed === !!revealed) ) return false;
    entry.revealed = !!revealed;
    return true;
  });
}
