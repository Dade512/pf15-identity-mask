/**
 * Combat-tracker masking for pf15-identity-mask.
 *
 * Attached to the renderCombatTracker hook (ApplicationV2: (app, element,
 * context, options), element is the app's root HTMLElement). Every render
 * rebuilds the tracker part DOM from its template, so this hook only ever
 * touches fresh nodes — listeners and labels cannot accumulate across
 * rerenders, and the same code path serves the sidebar tab and the popout.
 *
 * Alias text is untrusted input and is only ever assigned through
 * textContent / the alt property. No HTML string interpolation.
 */

import { CSS } from "./const.mjs";
import { getMaskEntry, getMaskKey, setRevealed } from "./state.mjs";
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
    else if ( entry && !entry.revealed ) maskPlayerRow(li, entry);
  }
}

/**
 * Replace the player-visible name surfaces with the alias.
 * The core template carries the true name in exactly two places per row:
 * strong.name text and img.token-image[alt].
 * @param {HTMLElement} li
 * @param {{alias: string}} entry
 */
function maskPlayerRow(li, entry) {
  const nameEl = li.querySelector(".token-name .name");
  if ( nameEl ) nameEl.textContent = entry.alias;
  const imgEl = li.querySelector("img.token-image");
  if ( imgEl ) imgEl.alt = entry.alias;
}

/**
 * GM view: keep the true name, add an alias status line and row controls.
 * @param {HTMLElement} li
 * @param {Combatant} combatant
 * @param {{alias: string, revealed: boolean}|null} entry
 */
function decorateGmRow(li, combatant, entry) {
  // Combatants without a scene token cannot be masked; leave the row core.
  if ( !getMaskKey(combatant) ) return;

  const tokenName = li.querySelector(".token-name");
  const nameEl = tokenName?.querySelector(".name");
  const controls = li.querySelector(".combatant-controls");
  if ( !tokenName || !nameEl || !controls ) return;

  // Alias status line between the true name and the row controls.
  if ( entry ) {
    const line = document.createElement("div");
    line.classList.add(CSS.alias);
    line.dataset.pf15imState = entry.revealed ? "revealed" : "masked";

    const icon = document.createElement("i");
    icon.classList.add("fa-solid", entry.revealed ? "fa-eye" : "fa-mask");
    icon.setAttribute("aria-hidden", "true");

    const state = document.createElement("span");
    state.classList.add(CSS.aliasState);
    state.textContent = game.i18n.localize(entry.revealed ? "PF15IM.Tracker.Revealed" : "PF15IM.Tracker.Masked");

    const text = document.createElement("span");
    text.classList.add(CSS.aliasText);
    text.textContent = entry.alias;

    line.append(icon, state, text);
    nameEl.insertAdjacentElement("afterend", line);
  }

  // Reveal / re-conceal toggle, only meaningful while a mask exists.
  if ( entry ) {
    const toggle = makeControlButton(
      entry.revealed ? "fa-eye" : "fa-masks-theater",
      game.i18n.localize(entry.revealed ? "PF15IM.Tracker.Conceal" : "PF15IM.Tracker.Reveal")
    );
    toggle.dataset.pf15imState = entry.revealed ? "revealed" : "masked";
    toggle.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setRevealed(combatant, !entry.revealed);
    });
    controls.prepend(toggle);
  }

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
