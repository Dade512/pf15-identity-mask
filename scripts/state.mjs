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

import { MODULE_ID, SETTING_REGISTRY, MAX_ALIAS_LENGTH, REGISTRY_VERSION, ID_STATUSES, MAX_NOTE_LENGTH } from "./const.mjs";

/**
 * Normalize either registry shape to its entries map (dual-shape reader,
 * spec 16.1): v2 container `{_v: 2, entries: {...}}` or the legacy v1 flat
 * map. All reads and the write path go through this single function so no
 * render can trip over the migration boundary.
 * @param {object|null|undefined} raw  The raw setting value.
 * @returns {object}  The entries map (never null).
 */
function readEntries(raw) {
  if ( raw && (raw._v === REGISTRY_VERSION) ) return raw.entries ?? {};
  if ( !raw || (typeof raw !== "object") ) return {};
  // Unknown container version (e.g. from a NEWER module build): fail safe.
  // Display treats it as empty; writers refuse entirely (see updateRegistry).
  if ( raw._v !== undefined ) return {};
  const { _v, entries, ...flat } = raw;
  return flat;
}

/**
 * True when the stored value is a shape this build may WRITE over:
 * empty, legacy v1 flat, or the current container version. An unexpected
 * `_v` (newer build's data) must never be silently rebuilt.
 * @param {object|null|undefined} raw
 * @returns {boolean}
 */
function isWritableContainer(raw) {
  if ( !raw || (typeof raw !== "object") ) return true;
  return (raw._v === undefined) || (raw._v === REGISTRY_VERSION);
}

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
  const entries = readEntries(game.settings.get(MODULE_ID, SETTING_REGISTRY));
  const entry = entries[key];
  if ( !entry || (typeof entry.alias !== "string") ) return null;
  const alias = normalizeAlias(entry.alias);
  if ( !alias ) return null;
  const out = { alias, revealed: entry.revealed === true };
  if ( entry.identification ) {
    const id = validateIdentification(entry.identification);
    if ( id ) out.identification = id;
  }
  return out;
}

/**
 * Centrally validate an identification object (spec 16.2). Returns the
 * cleaned object, or null when the input is not a valid identification.
 * NOTE: the entire object is player-readable via the replicated setting.
 * @param {object|null|undefined} data
 * @returns {object|null}
 */
export function validateIdentification(data) {
  if ( !data || (typeof data !== "object") ) return null;
  if ( !ID_STATUSES.includes(data.status) ) return null;
  let skill = null;
  if ( data.skill != null ) {
    const s = String(data.skill);
    const known = globalThis.pf1?.config?.skills;
    if ( known ? (s in known) : /^[a-z0-9]{1,20}$/.test(s) ) skill = s;
    else return null;
  }
  const num = v => (v == null || v === "") ? null : (Number.isFinite(Number(v)) ? Number(v) : undefined);
  const total = num(data.total);
  const dc = num(data.dc);
  if ( (total === undefined) || (dc === undefined) ) return null;
  let userId = null;
  if ( data.userId != null && data.userId !== "" ) {
    if ( !game.users.has(data.userId) ) return null;
    userId = data.userId;
  }
  let publicNote = normalizeAlias(data.publicNote ?? "");
  if ( publicNote.length > MAX_NOTE_LENGTH ) publicNote = publicNote.slice(0, MAX_NOTE_LENGTH).trim();
  const updatedAt = Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now();
  return { status: data.status, skill, total, dc, userId, updatedAt, publicNote };
}

/**
 * One-time v1 -> v2 container migration (spec 16.1). GM client only, runs
 * on ready. Re-reads immediately before writing; no-op when already v2, so
 * concurrent GM clients and reloads are harmless. Valid v1 entries are
 * preserved exactly; malformed ones are excluded and REPORTED by count
 * (never logged by content, never silently repaired into the container).
 * @returns {Promise<void>}
 */
export async function migrateRegistry() {
  if ( !game.user.isGM ) return;
  const raw = game.settings.get(MODULE_ID, SETTING_REGISTRY);
  if ( raw && (raw._v === REGISTRY_VERSION) ) return;
  if ( raw && (typeof raw === "object") && (raw._v !== undefined) ) {
    console.error(`${MODULE_ID} | registry container version ${raw._v} is newer than this build supports; migration refused`);
    return;
  }
  const flat = readEntries(raw);
  const entries = {};
  let kept = 0, malformed = 0;
  for ( const [key, entry] of Object.entries(flat) ) {
    const valid = /^[a-zA-Z0-9]{16}:[a-zA-Z0-9]{16}$/.test(key)
      && entry && (typeof entry.alias === "string") && normalizeAlias(entry.alias);
    if ( valid ) { entries[key] = { alias: entry.alias, revealed: entry.revealed === true }; kept++; }
    else malformed++;
  }
  try {
    await game.settings.set(MODULE_ID, SETTING_REGISTRY, { _v: REGISTRY_VERSION, entries });
    console.info(`${MODULE_ID} | registry migrated v1 -> v${REGISTRY_VERSION}: ${kept} entries kept, ${malformed} malformed excluded`);
    if ( malformed ) ui.notifications.warn(game.i18n.format("PF15IM.Warn.MigrationMalformed", { count: malformed }));
  }
  catch(err) {
    console.error(`${MODULE_ID} | registry migration failed`, err);
  }
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
  const raw = game.settings.get(MODULE_ID, SETTING_REGISTRY);
  if ( !isWritableContainer(raw) ) {
    console.error(`${MODULE_ID} | registry container version ${raw?._v} is not supported by this build; write refused`);
    ui.notifications.error("PF15IM.Warn.SaveFailed", { localize: true });
    return false;
  }
  const entries = foundry.utils.deepClone(readEntries(raw));
  if ( !mutate(entries) ) return false;
  try {
    // All writes produce the v2 container (spec 16.1).
    await game.settings.set(MODULE_ID, SETTING_REGISTRY, { _v: REGISTRY_VERSION, entries });
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
    const next = { alias, revealed: prev?.revealed === true };
    if ( prev?.identification ) next.identification = prev.identification;
    registry[key] = next;
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
/**
 * Set or clear the identification record on an existing mask entry
 * (spec 16.2). Pass null to clear. GM only; centrally validated; the
 * timestamp is module-generated on every write.
 * @param {MaskRef|Combatant} ref
 * @param {object|null} data
 * @returns {Promise<boolean>}
 */
export async function setIdentification(ref, data) {
  const key = getMaskKey(ref);
  if ( !key ) return false;
  let clean = null;
  if ( data !== null ) {
    clean = validateIdentification({ ...data, updatedAt: Date.now() });
    if ( !clean ) {
      ui.notifications.warn("PF15IM.Warn.BadIdentification", { localize: true });
      return false;
    }
  }
  return updateRegistry(entries => {
    const entry = entries[key];
    if ( !entry ) return false;
    if ( clean ) entry.identification = clean;
    else if ( entry.identification ) delete entry.identification;
    else return false;
    return true;
  });
}

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
