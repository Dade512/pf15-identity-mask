/**
 * Registry state management for pf15-identity-mask.
 *
 * All mask state lives in ONE world-scope setting: a v3 container
 * `{_v: 3, entries: {"<sceneId>:<tokenId>": {alias, partialAlias?,
 * displayTier, identification?}}}` (spec 17.2).
 *
 * World Setting writes require the SETTINGS_MODIFY permission (default
 * ASSISTANT+) and are enforced server-side as document permissions
 * (common/documents/setting.mjs #canModify). Combatant/Token flags were
 * rejected because actor-owner players may update them server-side
 * (common/documents/combatant.mjs #canUpdate allows "flags").
 *
 * The true name is never stored here — only aliases, the display tier,
 * and identification roll records (ALL player-readable; see spec 17.4).
 */

import { MODULE_ID, SETTING_REGISTRY, SETTING_MYSTERY_ART, SETTING_PROFILES, MAX_ALIAS_LENGTH, MAX_PATH_LENGTH, DEFAULT_MYSTERY_ART, REGISTRY_VERSION, DISPLAY_TIERS, ID_STATUSES, MAX_NOTE_LENGTH } from "./const.mjs";
import { syncTokenArt } from "./canvas.mjs";

/**
 * Normalize any known registry shape to its entries map (tri-shape reader,
 * spec 17.2): v3/v2 containers `{_v, entries}` or the legacy v1 flat map.
 * All reads and the write path go through this single function so no
 * render can trip over a migration boundary.
 * @param {object|null|undefined} raw  The raw setting value.
 * @returns {object}  The entries map (never null).
 */
function readEntries(raw) {
  if ( raw && ((raw._v === REGISTRY_VERSION) || (raw._v === 2)) ) return raw.entries ?? {};
  if ( !raw || (typeof raw !== "object") ) return {};
  // Unknown container version (e.g. from a NEWER module build): fail safe.
  // Display treats it as empty; writers refuse entirely (see updateRegistry).
  if ( raw._v !== undefined ) return {};
  const { _v, entries, ...flat } = raw;
  return flat;
}

/**
 * True when the stored value is a shape this build may WRITE over:
 * empty, legacy v1 flat, the v2 container, or the current container
 * version. An unexpected `_v` (newer build's data) must never be
 * silently rebuilt.
 * @param {object|null|undefined} raw
 * @returns {boolean}
 */
function isWritableContainer(raw) {
  if ( !raw || (typeof raw !== "object") ) return true;
  return (raw._v === undefined) || (raw._v === 2) || (raw._v === REGISTRY_VERSION);
}

/**
 * A mask reference: anything carrying the scene and token ids of a placed
 * token. Combatant documents already have this shape; TokenDocuments use
 * refForTokenDocument().
 * @typedef {{sceneId: string, tokenId: string}} MaskRef
 */

/**
 * A normalized mask entry as returned by getMaskEntry().
 * @typedef {{alias: string, partialAlias: string|null,
 *   displayTier: "masked"|"partial"|"revealed",
 *   mysteryArt: string|null,
 *   identification?: object}} MaskEntry
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
    onChange: () => { syncTracker(); syncChat(); syncNameplates(); syncTokenArt(); }
  });
  // Campaign-wide default mystery image (0.6.0). Player-readable display config;
  // GM-set via the module settings UI. Per-mask overrides live on the entry.
  game.settings.register(MODULE_ID, SETTING_MYSTERY_ART, {
    name: "PF15IM.Settings.MysteryArt.Name",
    hint: "PF15IM.Settings.MysteryArt.Hint",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_MYSTERY_ART,
    onChange: () => { syncTracker(); syncTokenArt(); }
  });
  // Creature-knowledge profiles (0.7.0): reusable {label, alias, partialAlias,
  // mysteryArt} templates keyed by slug. World-scope, GM-managed; no live
  // render depends on it (the editor reads it on open), so no onChange.
  game.settings.register(MODULE_ID, SETTING_PROFILES, {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });
}

/**
 * Remove mask entries whose scene or token no longer exists (0.7.0 housekeeping).
 * Reuses the single write path, so an unknown/newer container version is refused
 * exactly as elsewhere. GM only. A token on a not-currently-loaded scene still
 * counts as present (the scene and its TokenDocument exist in game.scenes).
 * @returns {Promise<number>}  Count of orphaned entries removed.
 */
export async function purgeOrphanedEntries() {
  let removed = 0;
  await updateRegistry(entries => {
    for ( const key of Object.keys(entries) ) {
      const idx = key.indexOf(":");
      const sceneId = (idx < 0) ? key : key.slice(0, idx);
      const tokenId = (idx < 0) ? "" : key.slice(idx + 1);
      const exists = !!game.scenes.get(sceneId)?.tokens.get(tokenId);
      if ( !exists ) { delete entries[key]; removed++; }
    }
    return removed > 0;
  });
  return removed;
}

/**
 * Count mask entries whose scene or token no longer exists, WITHOUT writing
 * (for a confirmation prompt). GM-readable.
 * @returns {number}
 */
export function countOrphanedEntries() {
  const entries = readEntries(game.settings.get(MODULE_ID, SETTING_REGISTRY));
  let n = 0;
  for ( const key of Object.keys(entries) ) {
    const idx = key.indexOf(":");
    const sceneId = (idx < 0) ? key : key.slice(0, idx);
    const tokenId = (idx < 0) ? "" : key.slice(idx + 1);
    if ( !game.scenes.get(sceneId)?.tokens.get(tokenId) ) n++;
  }
  return n;
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
 * Read the normalized mask entry for a mask reference.
 * @param {MaskRef|Combatant|null|undefined} ref
 * @returns {MaskEntry|null}
 */
export function getMaskEntry(ref) {
  const key = getMaskKey(ref);
  if ( !key ) return null;
  const entries = readEntries(game.settings.get(MODULE_ID, SETTING_REGISTRY));
  return normalizeEntry(entries[key]);
}

/**
 * Normalize a stored entry of any known shape (v1/v2 `revealed` boolean,
 * v2 single identification object, or v3) into the v3 in-memory shape.
 * Fail-safe rules (spec 17.2): a missing displayTier derives from
 * `revealed`; an INVALID displayTier falls back to "masked" — display
 * failure never shows the true name.
 * @param {object|null|undefined} entry
 * @returns {MaskEntry|null}
 */
function normalizeEntry(entry) {
  if ( !entry || (typeof entry.alias !== "string") ) return null;
  const alias = normalizeAlias(entry.alias);
  if ( !alias ) return null;
  let displayTier;
  if ( DISPLAY_TIERS.includes(entry.displayTier) ) displayTier = entry.displayTier;
  else if ( entry.displayTier === undefined ) displayTier = (entry.revealed === true) ? "revealed" : "masked";
  else displayTier = "masked";
  const partialAlias = normalizeAlias(entry.partialAlias ?? "") || null;
  const mysteryArt = normalizeImagePath(entry.mysteryArt ?? "") || null;
  const out = { alias, partialAlias, displayTier, mysteryArt };
  const identification = normalizeIdentification(entry.identification);
  if ( identification ) out.identification = identification;
  return out;
}

/**
 * The single source of display truth for every surface (spec 17.3):
 * the name players should currently see for an entry, or null when the
 * surface must stay untouched (revealed / no entry → core true name).
 * Partial tier falls back to the masked alias — never the true name.
 * @param {MaskEntry|null|undefined} entry
 * @returns {string|null}
 */
export function maskedNameFor(entry) {
  if ( !entry || (entry.displayTier === "revealed") ) return null;
  if ( entry.displayTier === "partial" ) return entry.partialAlias ?? entry.alias;
  return entry.alias;
}

/**
 * The single source of art-display truth (0.6.0, mirrors maskedNameFor): the
 * mystery image players should currently see for an entry, or null when the
 * surface must keep the TRUE art (revealed / no entry). While masked or
 * partial, the per-mask override wins, else the campaign-wide default setting,
 * else the hardcoded DEFAULT_MYSTERY_ART. Display-only; no document is touched.
 * @param {MaskEntry|null|undefined} entry
 * @returns {string|null}
 */
export function mysteryArtFor(entry) {
  if ( !entry || (maskedNameFor(entry) === null) ) return null;
  if ( entry.mysteryArt ) return entry.mysteryArt;
  const setting = normalizeImagePath(game.settings.get(MODULE_ID, SETTING_MYSTERY_ART));
  return setting || DEFAULT_MYSTERY_ART;
}

/**
 * Detect the obsolete intermediate-0.5.0 identification sub-shape
 * (follow-up #1, dev-world only): a bare `{<userId>: {outcome, …}}` map
 * written by a between-build before the `{skill, dc, publicNote, rolls}`
 * container was finalized. True only when there is no canonical `rolls`
 * key and no v2 `status`, but at least one own value is a roll-record-shaped
 * object — so it never misfires on a supported shape (the canonical
 * container always has `rolls`; a v2 object always has `status`).
 * @param {object} data
 * @returns {boolean}
 */
function isBareRollMap(data) {
  if ( (data.rolls !== undefined) || (typeof data.status === "string") ) return false;
  return Object.values(data).some(v => v && (typeof v === "object") && (typeof v.outcome === "string"));
}

/**
 * Lift an obsolete bare roll map into the canonical identification shape so
 * a world that ran an intermediate 0.5.0 build still DISPLAYS its records
 * (follow-up #1). Shared skill/dc/publicNote are promoted best-effort from
 * the first record carrying each; the map itself becomes `rolls`, where
 * validateIdentification keeps only known-user records and reads only
 * total/outcome/updatedAt per record. Read-side only — nothing is rewritten
 * here; the next GM edit persists the canonical container.
 * @param {object} data
 * @returns {{skill: unknown, dc: unknown, publicNote: unknown, rolls: object}}
 */
function liftBareRollMap(data) {
  const records = Object.values(data).filter(v => v && (typeof v === "object"));
  return {
    skill: records.find(r => (r.skill != null) && (r.skill !== ""))?.skill ?? null,
    dc: records.find(r => (r.dc != null) && (r.dc !== ""))?.dc ?? null,
    publicNote: records.find(r => r.publicNote)?.publicNote ?? "",
    rolls: data
  };
}

/**
 * Normalize an identification value of any known shape into the v3 container
 * (spec 17.4): `{skill, dc, publicNote, rolls}` where rolls maps userId ->
 * `{total, outcome, updatedAt}`. Three input shapes are accepted: the
 * canonical container; a legacy v2 single object (has `status`) → shared
 * skill/dc/publicNote plus one roll under its userId (status -> outcome);
 * and the obsolete intermediate-0.5.0 bare roll map (follow-up #1) → lifted
 * by liftBareRollMap. Lenient: invalid roll records and unknown user ids are
 * dropped from display (stored data untouched — migration / the next GM edit
 * is the only repairer).
 * @param {object|null|undefined} data
 * @returns {object|null}  The cleaned container, or null when empty/invalid.
 */
function normalizeIdentification(data) {
  if ( !data || (typeof data !== "object") ) return null;
  let source = data;
  if ( typeof data.status === "string" ) {
    const userId = (data.userId && game.users.has(data.userId)) ? data.userId : null;
    source = {
      skill: data.skill,
      dc: data.dc,
      publicNote: data.publicNote,
      rolls: userId ? { [userId]: { total: data.total, outcome: data.status, updatedAt: data.updatedAt } } : {}
    };
  }
  else if ( isBareRollMap(data) ) source = liftBareRollMap(data);
  const clean = validateIdentification(source, { lenient: true });
  return (clean && !isEmptyIdentification(clean)) ? clean : null;
}

/**
 * True when an identification container carries no information at all.
 * @param {{skill: string|null, dc: number|null, publicNote: string, rolls: object}} id
 * @returns {boolean}
 */
function isEmptyIdentification(id) {
  return !id.skill && (id.dc === null) && !id.publicNote && !Object.keys(id.rolls).length;
}

/**
 * Centrally validate an identification container (spec 17.4): shared
 * skill/dc/publicNote for the creature plus a per-player rolls map.
 * Strict mode (the write path) returns null when ANY provided roll record
 * or roll key is invalid; lenient mode (reads/migration) drops the bad
 * records instead. NOTE: the entire container is player-readable via the
 * replicated setting.
 * @param {object|null|undefined} data
 * @param {{lenient?: boolean}} [options]
 * @returns {object|null}
 */
export function validateIdentification(data, { lenient = false } = {}) {
  if ( !data || (typeof data !== "object") ) return null;
  let skill = null;
  if ( data.skill != null && data.skill !== "" ) {
    const s = String(data.skill);
    const known = globalThis.pf1?.config?.skills;
    if ( known ? (s in known) : /^[a-z0-9]{1,20}$/.test(s) ) skill = s;
    else return null;
  }
  const dc = numOrNull(data.dc);
  if ( dc === undefined ) return null;
  let publicNote = normalizeAlias(data.publicNote ?? "");
  if ( publicNote.length > MAX_NOTE_LENGTH ) publicNote = publicNote.slice(0, MAX_NOTE_LENGTH).trim();
  const rawRolls = data.rolls ?? {};
  if ( typeof rawRolls !== "object" ) return null;
  const rolls = {};
  for ( const [userId, raw] of Object.entries(rawRolls) ) {
    const record = (game.users.has(userId)) ? validateRollRecord(raw) : null;
    if ( !record ) {
      if ( lenient ) continue;
      return null;
    }
    rolls[userId] = record;
  }
  return { skill, dc, publicNote, rolls };
}

/**
 * Validate one per-player roll record `{total, outcome, updatedAt}`.
 * @param {object|null|undefined} data
 * @returns {object|null}
 */
function validateRollRecord(data) {
  if ( !data || (typeof data !== "object") ) return null;
  if ( !ID_STATUSES.includes(data.outcome) ) return null;
  const total = numOrNull(data.total);
  if ( total === undefined ) return null;
  const updatedAt = Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now();
  return { total, outcome: data.outcome, updatedAt };
}

/**
 * Finite number coercion: null when empty/absent, undefined when invalid.
 * @param {unknown} v
 * @returns {number|null|undefined}
 */
function numOrNull(v) {
  return (v == null || v === "") ? null : (Number.isFinite(Number(v)) ? Number(v) : undefined);
}

/**
 * One-time v1/v2 -> v3 container migration (spec 17.2). GM client only,
 * runs on ready. Re-reads immediately before writing; no-op when already
 * v3, so concurrent GM clients and reloads are harmless. Refuses any
 * newer/unknown container version. Valid entries are preserved exactly;
 * the display mapping is purely mechanical (revealed:false -> "masked",
 * revealed:true -> "revealed") and NEVER inferred from identification
 * (BINDING — Lyra rev. 2). A v2 identification object becomes one
 * roll-map record (status -> outcome) under its recorded userId, else
 * the migrating GM's id. Malformed entries/records are excluded and
 * REPORTED by count (never logged by content, never silently repaired).
 * @returns {Promise<void>}
 */
export async function migrateRegistry() {
  if ( !game.user.isGM ) return;
  const raw = game.settings.get(MODULE_ID, SETTING_REGISTRY);
  if ( raw && (raw._v === REGISTRY_VERSION) ) return;
  if ( raw && (typeof raw === "object") && (raw._v !== undefined) && (raw._v !== 2) ) {
    console.error(`${MODULE_ID} | registry container version ${raw._v} is newer than this build supports; migration refused`);
    return;
  }
  const sourceVersion = (raw && (raw._v === 2)) ? 2 : 1;
  const flat = readEntries(raw);
  const entries = {};
  let kept = 0, malformed = 0, records = 0, badRecords = 0;
  for ( const [key, entry] of Object.entries(flat) ) {
    const valid = /^[a-zA-Z0-9]{16}:[a-zA-Z0-9]{16}$/.test(key)
      && entry && (typeof entry.alias === "string") && normalizeAlias(entry.alias);
    if ( !valid ) { malformed++; continue; }
    const next = {
      alias: entry.alias,
      displayTier: (entry.revealed === true) ? "revealed" : "masked"
    };
    const id = entry.identification;
    if ( id && (typeof id === "object") && (typeof id.status === "string") ) {
      const userId = (id.userId && game.users.has(id.userId)) ? id.userId : game.user.id;
      const clean = validateIdentification({
        skill: id.skill,
        dc: id.dc,
        publicNote: id.publicNote,
        rolls: { [userId]: { total: id.total, outcome: id.status, updatedAt: id.updatedAt } }
      }, { lenient: true });
      if ( clean && !isEmptyIdentification(clean) ) {
        next.identification = clean;
        if ( Object.keys(clean.rolls).length ) records++;
        else badRecords++;
      }
      else badRecords++;
    }
    entries[key] = next;
    kept++;
  }
  try {
    await game.settings.set(MODULE_ID, SETTING_REGISTRY, { _v: REGISTRY_VERSION, entries });
    console.info(`${MODULE_ID} | registry migrated v${sourceVersion} -> v${REGISTRY_VERSION}: ${kept} entries kept, ${records} identification records carried, ${malformed} malformed entries excluded, ${badRecords} invalid identification records dropped`);
    if ( malformed || badRecords ) ui.notifications.warn(game.i18n.format("PF15IM.Warn.MigrationMalformed", { count: malformed + badRecords }));
  }
  catch(err) {
    console.error(`${MODULE_ID} | registry migration failed`, err);
  }
}

/**
 * Normalize untrusted alias input: strip control characters, collapse
 * whitespace, trim, and enforce the maximum length. Also used verbatim
 * for partialAlias (BINDING — Lyra rev. 3) and as the base normalizer
 * for publicNote (longer cap applied by validateIdentification).
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
 * Normalize an untrusted image-path value (0.6.0 mystery art). Unlike
 * normalizeAlias, internal whitespace is PRESERVED — Foundry asset paths may
 * contain spaces (e.g. "Campaign Material/..."). Control chars are stripped,
 * ends trimmed, length capped. Rendered only as img.src / PIXI texture src
 * (never HTML), so a hostile value cannot execute script. Empty → "".
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeImagePath(value) {
  let path = String(value ?? "");
  // Strip C0 control chars + DEL; keep spaces (valid in Foundry asset paths).
  path = Array.from(path).filter(ch => {
    const c = ch.codePointAt(0);
    return (c > 0x1f) && (c !== 0x7f);
  }).join("").trim();
  if ( path.length > MAX_PATH_LENGTH ) path = path.slice(0, MAX_PATH_LENGTH).trim();
  return path;
}

/**
 * Apply a mutation to a cloned registry and persist it. Fails fast with a
 * localized warning for non-GM users; the server would reject them anyway.
 * @param {(entries: object) => boolean} mutate  Return true if anything changed.
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
    // All writes produce the v3 container (spec 17.2).
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
 * instead. partialAlias, displayTier, and identification are preserved
 * on edit.
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
  return updateRegistry(entries => {
    const prev = normalizeEntry(entries[key]);
    if ( prev?.alias === alias ) return false;
    const next = { alias, displayTier: prev?.displayTier ?? "masked" };
    if ( prev?.partialAlias ) next.partialAlias = prev.partialAlias;
    if ( prev?.mysteryArt ) next.mysteryArt = prev.mysteryArt;
    if ( prev?.identification ) next.identification = prev.identification;
    entries[key] = next;
    return true;
  });
}

/**
 * Set or clear the partial-tier alias on an existing mask entry
 * (spec 17.3). Sanitized exactly like the alias; empty clears the field
 * (partial tier then falls back to the masked alias).
 * @param {MaskRef|Combatant} ref
 * @param {unknown} rawPartialAlias
 * @returns {Promise<boolean>}
 */
export async function setPartialAlias(ref, rawPartialAlias) {
  const key = getMaskKey(ref);
  if ( !key ) return false;
  const partialAlias = normalizeAlias(rawPartialAlias) || null;
  return updateRegistry(entries => {
    const prev = normalizeEntry(entries[key]);
    if ( !prev || (prev.partialAlias === partialAlias) ) return false;
    const next = { alias: prev.alias, displayTier: prev.displayTier };
    if ( partialAlias ) next.partialAlias = partialAlias;
    if ( prev.mysteryArt ) next.mysteryArt = prev.mysteryArt;
    if ( prev.identification ) next.identification = prev.identification;
    entries[key] = next;
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
  return updateRegistry(entries => {
    if ( !(key in entries) ) return false;
    delete entries[key];
    return true;
  });
}

/**
 * Set the display tier of an existing mask entry (spec 17.3). GM-set
 * only; this is the ONLY code path that changes what players see —
 * identification writes never touch it (BINDING decoupling).
 * @param {MaskRef|Combatant} ref
 * @param {"masked"|"partial"|"revealed"} tier
 * @returns {Promise<boolean>}
 */
export async function setDisplayTier(ref, tier) {
  const key = getMaskKey(ref);
  if ( !key || !DISPLAY_TIERS.includes(tier) ) return false;
  return updateRegistry(entries => {
    const prev = normalizeEntry(entries[key]);
    if ( !prev || (prev.displayTier === tier) ) return false;
    const next = { alias: prev.alias, displayTier: tier };
    if ( prev.partialAlias ) next.partialAlias = prev.partialAlias;
    if ( prev.mysteryArt ) next.mysteryArt = prev.mysteryArt;
    if ( prev.identification ) next.identification = prev.identification;
    entries[key] = next;
    return true;
  });
}

/**
 * Set or clear the per-mask mystery-art override on an existing mask entry
 * (0.6.0). Sanitized as an image path; empty clears the override (the entry
 * then falls back to the campaign-wide default setting). GM only. Touches
 * ONLY mysteryArt — never the alias, tier, or identification.
 * @param {MaskRef|Combatant} ref
 * @param {unknown} rawPath
 * @returns {Promise<boolean>}
 */
export async function setMysteryArt(ref, rawPath) {
  const key = getMaskKey(ref);
  if ( !key ) return false;
  const mysteryArt = normalizeImagePath(rawPath) || null;
  return updateRegistry(entries => {
    const prev = normalizeEntry(entries[key]);
    if ( !prev || (prev.mysteryArt === mysteryArt) ) return false;
    const next = { alias: prev.alias, displayTier: prev.displayTier };
    if ( prev.partialAlias ) next.partialAlias = prev.partialAlias;
    if ( mysteryArt ) next.mysteryArt = mysteryArt;
    if ( prev.identification ) next.identification = prev.identification;
    entries[key] = next;
    return true;
  });
}

/**
 * Set or clear the whole identification container on an existing mask
 * entry (spec 17.4): shared skill/dc/publicNote plus the per-player rolls
 * map, written in ONE registry update. Pass null (or an all-empty
 * container) to clear. GM only; strictly validated centrally; timestamps
 * are module-generated — an unchanged roll keeps its stored updatedAt, a
 * new or changed roll is stamped at write. Touches ONLY identification —
 * never displayTier (BINDING decoupling).
 * @param {MaskRef|Combatant} ref
 * @param {object|null} data
 * @returns {Promise<boolean>}
 */
export async function setIdentification(ref, data) {
  const key = getMaskKey(ref);
  if ( !key ) return false;
  let clean = null;
  if ( data !== null ) {
    clean = validateIdentification(data);
    if ( !clean ) {
      ui.notifications.warn("PF15IM.Warn.BadIdentification", { localize: true });
      return false;
    }
    if ( isEmptyIdentification(clean) ) clean = null;
  }
  return updateRegistry(entries => {
    const prev = normalizeEntry(entries[key]);
    if ( !prev ) return false;
    if ( clean ) {
      // Module-generated timestamps: preserve only for unchanged rolls.
      const prevRolls = prev.identification?.rolls ?? {};
      for ( const [userId, record] of Object.entries(clean.rolls) ) {
        const old = prevRolls[userId];
        record.updatedAt = (old && (old.total === record.total) && (old.outcome === record.outcome))
          ? old.updatedAt : Date.now();
      }
    }
    const unchanged = JSON.stringify(clean) === JSON.stringify(prev.identification ?? null);
    if ( unchanged ) return false;
    const next = { alias: prev.alias, displayTier: prev.displayTier };
    if ( prev.partialAlias ) next.partialAlias = prev.partialAlias;
    if ( prev.mysteryArt ) next.mysteryArt = prev.mysteryArt;
    if ( clean ) next.identification = clean;
    entries[key] = next;
    return true;
  });
}

/**
 * Enumerate same-actor TokenDocuments on the ref's scene (spec 17.5,
 * facts C1/C2). Returns null when the ref's token is actor-less or
 * unresolvable (mask-all unavailable).
 * @param {MaskRef|Combatant|null|undefined} ref
 * @returns {TokenDocument[]|null}
 */
export function sameActorTokens(ref) {
  const scene = game.scenes.get(ref?.sceneId);
  const actorId = scene?.tokens.get(ref?.tokenId)?.actorId;
  if ( !actorId ) return null;
  return scene.tokens.filter(t => t.actorId === actorId);
}

/**
 * Mask every same-actor token on the ref's scene in ONE atomic registry
 * write (spec 17.5). Tokens that already have entries are skipped unless
 * `overwrite` is set (overwritten entries are replaced whole). With
 * `numbered`, aliases get sequential " 1"/" 2"/... suffixes in scene
 * token order (re-capped at 64 chars). New entries start at tier
 * "masked". No Actor/Token document is touched.
 * @param {MaskRef|Combatant} ref
 * @param {{alias: unknown, partialAlias?: unknown, overwrite?: boolean, numbered?: boolean}} options
 * @returns {Promise<number>}  Count of entries written (0 on failure/no-op).
 */
export async function maskAllForActor(ref, { alias, partialAlias, overwrite = false, numbered = false } = {}) {
  const baseAlias = normalizeAlias(alias);
  if ( !baseAlias ) return 0;
  const basePartial = normalizeAlias(partialAlias ?? "") || null;
  const tokens = sameActorTokens(ref);
  if ( !tokens?.length ) return 0;
  let written = 0;
  const persisted = await updateRegistry(entries => {
    const targets = tokens.filter(t => {
      const key = getMaskKey({ sceneId: ref.sceneId, tokenId: t.id });
      return key && (overwrite || !(key in entries));
    });
    if ( !targets.length ) return false;
    targets.forEach((t, i) => {
      const key = getMaskKey({ sceneId: ref.sceneId, tokenId: t.id });
      const suffix = (numbered && (targets.length > 1)) ? ` ${i + 1}` : "";
      const next = { alias: normalizeAlias(baseAlias + suffix), displayTier: "masked" };
      if ( basePartial ) next.partialAlias = normalizeAlias(basePartial + suffix);
      entries[key] = next;
    });
    written = targets.length;
    return true;
  });
  return persisted ? written : 0;
}
