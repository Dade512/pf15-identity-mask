/**
 * Combat-tracker masking for pf15-identity-mask.
 *
 * Attached to the renderCombatTracker hook (ApplicationV2: (app, element,
 * context, options), element is the app's root HTMLElement). Every render
 * rebuilds the tracker part DOM from its template, so this hook only ever
 * touches fresh nodes — listeners and labels cannot accumulate across
 * rerenders, and the same code path serves the sidebar tab and the popout.
 *
 * Display text always comes from maskedNameFor() — the shared tier
 * resolver (spec 17.3). Alias text is untrusted input and is only ever
 * assigned through textContent / the alt property. No HTML interpolation.
 */

import { CSS, TIER_META } from "./const.mjs";
import { getMaskEntry, getMaskKey, maskedNameFor, mysteryArtFor, setDisplayTier } from "./state.mjs";
import { openAliasEditor } from "./editor.mjs";

/**
 * Handle renderCombatTracker.
 * @param {object} app        The CombatTracker application instance.
 * @param {HTMLElement} element  The application's root element.
 */
export function onRenderCombatTracker(app, element) {
  const combat = app?.viewed;
  if ( !combat || !(element instanceof HTMLElement) ) return;
  const isGM = game.user.isGM;

  for ( const li of element.querySelectorAll("li.combatant[data-combatant-id]") ) {
    const combatant = combat.combatants.get(li.dataset.combatantId);
    if ( !combatant ) continue;

    let entry = null;
    try {
      entry = getMaskEntry(combatant);
    }
    catch(err) {
      console.error("pf15-identity-mask | Failed to read mask entry", err);
      continue;
    }

    if ( isGM ) decorateGmRow(li, combatant, entry);
    else {
      const shown = maskedNameFor(entry);
      if ( shown ) maskPlayerRow(li, shown, entry);
    }
  }
}

/**
 * Replace the player-visible name surfaces with the tier display name, and
 * (0.6.0) swap the row portrait to mystery art while masked/partial. The core
 * template carries the true name in two places per row (strong.name text,
 * img.token-image[alt]) and the true art in img.token-image[src]. All three
 * are display-only DOM-property assignments on fresh per-render nodes; no
 * document is touched.
 * @param {HTMLElement} li
 * @param {string} shown  The tier-resolved display name.
 * @param {import("./state.mjs").MaskEntry} entry  The resolved mask entry.
 */
function maskPlayerRow(li, shown, entry) {
  const nameEl = li.querySelector(".token-name .name");
  if ( nameEl ) nameEl.textContent = shown;
  const imgEl = li.querySelector("img.token-image");
  if ( imgEl ) {
    imgEl.alt = shown;
    const art = mysteryArtFor(entry);
    if ( art ) imgEl.src = art;
  }
}

/**
 * GM view: keep the true name, add a tier status line and row controls.
 * Per-PC identification data NEVER appears here (spec 17.4) — the
 * compact tier tag is all; roll detail lives in the editor.
 * @param {HTMLElement} li
 * @param {Combatant} combatant
 * @param {import("./state.mjs").MaskEntry|null} entry
 */
function decorateGmRow(li, combatant, entry) {
  // Combatants without a scene token cannot be masked; leave the row core.
  if ( !getMaskKey(combatant) ) return;

  const tokenName = li.querySelector(".token-name");
  const nameEl = tokenName?.querySelector(".name");
  const controls = li.querySelector(".combatant-controls");
  if ( !tokenName || !nameEl || !controls ) return;

  // Tier status line between the true name and the row controls: tier
  // word + what players currently see at that tier.
  if ( entry ) {
    const meta = TIER_META[entry.displayTier];
    const line = document.createElement("div");
    line.classList.add(CSS.alias);
    line.dataset.pf15imState = entry.displayTier;

    const icon = document.createElement("i");
    icon.classList.add("fa-solid", meta.lineIcon);
    icon.setAttribute("aria-hidden", "true");

    const state = document.createElement("span");
    state.classList.add(CSS.aliasState);
    state.textContent = game.i18n.localize(`PF15IM.Tier.${entry.displayTier}`).toUpperCase();

    const text = document.createElement("span");
    text.classList.add(CSS.aliasText);
    text.textContent = maskedNameFor(entry) ?? entry.alias;

    line.append(icon, state, text);
    nameEl.insertAdjacentElement("afterend", line);
  }

  // 3-state display-tier cycle toggle, only meaningful while a mask exists.
  if ( entry ) controls.prepend(makeTierToggle(entry, tier => setDisplayTier(combatant, tier)));

  // Mask editor button.
  const edit = makeControlButton("fa-mask", game.i18n.localize("PF15IM.Tracker.EditAlias"));
  edit.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    openAliasEditor(combatant);
  });
  controls.prepend(edit);
}

/**
 * Build the 3-state display-tier cycle button for an entry (spec 17.3):
 * distinct icon per tier, localized label naming the current tier and
 * the one a click sets. The HUD mirrors the same semantics with its own
 * button markup (hud.mjs).
 * @param {import("./state.mjs").MaskEntry} entry
 * @param {(tier: string) => void} onCycle  Receives the next tier.
 * @returns {HTMLButtonElement}
 */
function makeTierToggle(entry, onCycle) {
  const meta = TIER_META[entry.displayTier];
  const label = game.i18n.format("PF15IM.Tracker.TierToggle", {
    tier: game.i18n.localize(`PF15IM.Tier.${entry.displayTier}`),
    next: game.i18n.localize(`PF15IM.Tier.${meta.next}`)
  });
  const toggle = makeControlButton(meta.toggleIcon, label);
  toggle.dataset.pf15imState = entry.displayTier;
  toggle.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    onCycle(meta.next);
  });
  return toggle;
}

/**
 * Build a row control button matching core tracker button markup.
 * Core's combatant click handler ignores HTMLButtonElement targets, and we
 * stop propagation in our own listeners, so row activation never fires.
 * @param {string} faIcon  Font Awesome icon class.
 * @param {string} label   Localized accessible label.
 * @returns {HTMLButtonElement}
 */
function makeControlButton(faIcon, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("inline-control", "combatant-control", "icon", "fa-solid", faIcon, CSS.control);
  button.setAttribute("aria-label", label);
  button.dataset.tooltip = "";
  return button;
}
