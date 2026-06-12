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
    onChange: () => {
      // AbstractSidebarTab#render also renders the popout instance.
      ui.combat?.render();
    }
  });
}

/**
 * Derive the registry key for a combatant, or null when the combatant has no
 * scene token (such combatants cannot be masked and degrade to core behavior).
 * @param {Combatant|null|undefined} combatant
 * @returns {string|null}
 */
export function getMaskKey(combatant) {
  const sceneId = combatant?.sceneId;
  const tokenId = combatant?.tokenId;
  if ( !sceneId || !tokenId ) return null;
  return `${sceneId}:${tokenId}`;
}

/**
 * Read the mask entry for a combatant.
 * @param {Combatant|null|undefined} combatant
 * @returns {{alias: string, revealed: boolean}|null}
 */
export function getMaskEntry(combatant) {
  const key = getMaskKey(combatant);
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
 * Set or replace a combatant's alias. An empty normalized alias clears the
 * mask instead. Reveal state is preserved on edit.
 * @param {Combatant} combatant
 * @param {unknown} rawAlias
 * @returns {Promise<boolean>}
 */
export async function setAlias(combatant, rawAlias) {
  const key = getMaskKey(combatant);
  if ( !key ) {
    ui.notifications.warn("PF15IM.Warn.NoToken", { localize: true });
    return false;
  }
  const alias = normalizeAlias(rawAlias);
  if ( !alias ) return clearAlias(combatant);
  return updateRegistry(registry => {
    const prev = registry[key];
    if ( prev?.alias === alias ) return false;
    registry[key] = { alias, revealed: prev?.revealed === true };
    return true;
  });
}

/**
 * Remove a combatant's mask entry entirely, restoring core behavior.
 * @param {Combatant} combatant
 * @returns {Promise<boolean>}
 */
export async function clearAlias(combatant) {
  const key = getMaskKey(combatant);
  if ( !key ) return false;
  return updateRegistry(registry => {
    if ( !(key in registry) ) return false;
    delete registry[key];
    return true;
  });
}

/**
 * Set the reveal state of an existing mask entry.
 * @param {Combatant} combatant
 * @param {boolean} revealed
 * @returns {Promise<boolean>}
 */
export async function setRevealed(combatant, revealed) {
  const key = getMaskKey(combatant);
  if ( !key ) return false;
  return updateRegistry(registry => {
    const entry = registry[key];
    if ( !entry || (entry.revealed === !!revealed) ) return false;
    entry.revealed = !!revealed;
    return true;
  });
}
