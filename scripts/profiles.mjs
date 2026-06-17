/**
 * Creature-knowledge profiles for pf15-identity-mask (0.7.0, thin slice).
 *
 * A profile is a reusable masking template — `{label, alias, partialAlias,
 * mysteryArt}` — keyed by a slug derived from its label. Profiles let the GM
 * remember "what this kind of thing looks like when masked" and re-apply it to
 * any token without retyping. They are PURELY templates: applying one fills the
 * editor's alias / partial-alias / mystery-art fields, which the GM then saves
 * onto the specific token entry through the normal write path. No per-person
 * recall, no link stored on the entry — that deeper scope stays deferred.
 *
 * Stored in ONE world-scope setting (`profiles`) as a versioned container
 * `{_v: 1, profiles: {<slug>: {label, alias, partialAlias, mysteryArt}}}`.
 * Every field is GM-authored display text (same trust level as aliases) and is
 * normalized through the same sanitizers as the registry.
 */

import { MODULE_ID, SETTING_PROFILES, PROFILES_VERSION, MAX_PROFILE_LABEL } from "./const.mjs";
import { normalizeAlias, normalizeImagePath } from "./state.mjs";

/**
 * Normalize any stored value to the profiles map (never null). Unknown/newer
 * container version → empty for reads (fail safe; writers refuse, see below).
 * @param {object|null|undefined} raw
 * @returns {object}
 */
function readProfilesMap(raw) {
  if ( !raw || (typeof raw !== "object") ) return {};
  if ( (raw._v !== undefined) && (raw._v !== PROFILES_VERSION) ) return {};
  const map = (raw._v === PROFILES_VERSION) ? raw.profiles : raw; // tolerate a bare map
  return (map && typeof map === "object") ? map : {};
}

/**
 * The current profiles map, each value normalized to a clean profile.
 * @returns {Record<string, {label: string, alias: string, partialAlias: string, mysteryArt: string}>}
 */
export function readProfiles() {
  const map = readProfilesMap(game.settings.get(MODULE_ID, SETTING_PROFILES));
  const out = {};
  for ( const [slug, value] of Object.entries(map) ) {
    const clean = normalizeProfile(value);
    if ( clean && slug ) out[slug] = clean;
  }
  return out;
}

/**
 * Read one profile by slug, or null.
 * @param {string} slug
 * @returns {{label: string, alias: string, partialAlias: string, mysteryArt: string}|null}
 */
export function getProfile(slug) {
  if ( !slug ) return null;
  return readProfiles()[slug] ?? null;
}

/**
 * Normalize an untrusted profile object. A non-empty label is required; the
 * other fields default to empty and are sanitized like the registry's.
 * @param {object|null|undefined} value
 * @returns {{label: string, alias: string, partialAlias: string, mysteryArt: string}|null}
 */
function normalizeProfile(value) {
  if ( !value || (typeof value !== "object") ) return null;
  let label = normalizeAlias(value.label ?? "");
  if ( label.length > MAX_PROFILE_LABEL ) label = label.slice(0, MAX_PROFILE_LABEL).trim();
  if ( !label ) return null;
  return {
    label,
    alias: normalizeAlias(value.alias ?? ""),
    partialAlias: normalizeAlias(value.partialAlias ?? ""),
    mysteryArt: normalizeImagePath(value.mysteryArt ?? "")
  };
}

/**
 * Derive a stable kebab-case slug from a label. Returns "" when the label has
 * no slug-worthy characters (caller rejects empty slugs).
 * @param {string} label
 * @returns {string}
 */
export function slugify(label) {
  return String(label ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_PROFILE_LABEL);
}

/**
 * Apply a mutation to a cloned profiles map and persist as a v1 container.
 * GM only; refuses an unknown/newer container version (no silent rebuild).
 * @param {(profiles: object) => boolean} mutate  Return true if anything changed.
 * @returns {Promise<boolean>}
 */
async function updateProfiles(mutate) {
  if ( !game.user.isGM ) {
    ui.notifications.warn("PF15IM.Warn.GmOnly", { localize: true });
    return false;
  }
  const raw = game.settings.get(MODULE_ID, SETTING_PROFILES);
  if ( raw && (typeof raw === "object") && (raw._v !== undefined) && (raw._v !== PROFILES_VERSION) ) {
    console.error(`${MODULE_ID} | profiles container version ${raw._v} is not supported by this build; write refused`);
    ui.notifications.error("PF15IM.Warn.SaveFailed", { localize: true });
    return false;
  }
  const profiles = foundry.utils.deepClone(readProfilesMap(raw));
  if ( !mutate(profiles) ) return false;
  try {
    await game.settings.set(MODULE_ID, SETTING_PROFILES, { _v: PROFILES_VERSION, profiles });
    return true;
  }
  catch(err) {
    console.error(`${MODULE_ID} | Failed to persist profiles`, err);
    ui.notifications.error("PF15IM.Warn.SaveFailed", { localize: true });
    return false;
  }
}

/**
 * Create or replace a profile from raw fields. The slug is derived from the
 * label; saving with an existing label overwrites that profile.
 * @param {{label: unknown, alias?: unknown, partialAlias?: unknown, mysteryArt?: unknown}} data
 * @returns {Promise<string|null>}  The slug saved, or null on failure.
 */
export async function saveProfile(data) {
  const clean = normalizeProfile(data);
  if ( !clean ) {
    ui.notifications.warn("PF15IM.Tools.ProfileNeedLabel", { localize: true });
    return null;
  }
  const slug = slugify(clean.label);
  if ( !slug ) {
    ui.notifications.warn("PF15IM.Tools.ProfileNeedLabel", { localize: true });
    return null;
  }
  const ok = await updateProfiles(profiles => { profiles[slug] = clean; return true; });
  return ok ? slug : null;
}

/**
 * Delete a profile by slug.
 * @param {string} slug
 * @returns {Promise<boolean>}
 */
export async function deleteProfile(slug) {
  if ( !slug ) return false;
  return updateProfiles(profiles => {
    if ( !(slug in profiles) ) return false;
    delete profiles[slug];
    return true;
  });
}

/**
 * Pretty-printed JSON of the current profiles container (for export/backup).
 * @returns {string}
 */
export function exportProfilesJSON() {
  return JSON.stringify({ _v: PROFILES_VERSION, profiles: readProfiles() }, null, 2);
}

/**
 * Import profiles from a JSON string. Accepts either a `{_v, profiles}`
 * container or a bare `{slug: profile}` map. Each profile is re-validated and
 * re-keyed by a slug derived from its label (so hand-edited JSON stays
 * consistent). With `replace`, the existing set is cleared first; otherwise
 * imported profiles merge over same-slug existing ones.
 * @param {string} text
 * @param {{replace?: boolean}} [options]
 * @returns {Promise<{imported: number, skipped: number}|null>}  null on parse error.
 */
export async function importProfilesJSON(text, { replace = false } = {}) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { ui.notifications.error("PF15IM.Tools.ImportBadJson", { localize: true }); return null; }
  const incoming = readProfilesMap(parsed);
  let imported = 0, skipped = 0;
  const cleaned = {};
  for ( const value of Object.values(incoming) ) {
    const clean = normalizeProfile(value);
    const slug = clean ? slugify(clean.label) : "";
    if ( !clean || !slug ) { skipped++; continue; }
    cleaned[slug] = clean;
    imported++;
  }
  await updateProfiles(profiles => {
    if ( replace ) for ( const k of Object.keys(profiles) ) delete profiles[k];
    Object.assign(profiles, cleaned);
    return true;
  });
  return { imported, skipped };
}
