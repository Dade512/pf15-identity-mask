/**
 * Token HUD identity-mask controls for pf15-identity-mask.
 *
 * In installed Foundry 13.350 the TokenHUD is ApplicationV2
 * (HandlebarsApplicationMixin(BasePlaceableHUD)); PF1's TokenHUDPF subclass
 * fires the renderTokenHUD hook through the AppV2 inheritance chain with a
 * native HTMLElement. Each render rebuilds the HUD part DOM from its
 * template, so injected controls and listeners never accumulate.
 *
 * GM only: non-GM clients get no HUD additions, and every write is also
 * server-enforced at the Setting layer.
 */

import { CSS } from "./const.mjs";
import { getMaskEntry, refForTokenDocument, setRevealed } from "./state.mjs";
import { openAliasEditor } from "./editor.mjs";

/**
 * Handle renderTokenHUD.
 * @param {object} app           The TokenHUD application instance.
 * @param {HTMLElement} element  The HUD root element.
 */
export function onRenderTokenHUD(app, element) {
  if ( !game.user.isGM || !(element instanceof HTMLElement) ) return;
  const ref = refForTokenDocument(app?.document);
  if ( !ref ) return;

  const column = element.querySelector(".col.left");
  if ( !column || column.querySelector(`.${CSS.hudControl}`) ) return;

  let entry = null;
  try {
    entry = getMaskEntry(ref);
  }
  catch(err) {
    console.error("pf15-identity-mask | Failed to resolve HUD mask entry", err);
    return;
  }

  // Mask editor button.
  const edit = makeHudButton("fa-mask", game.i18n.localize("PF15IM.Tracker.EditAlias"));
  edit.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    await openAliasEditor(ref);
    // Refresh the HUD so the reveal toggle appears/disappears with the entry.
    app.render();
  });
  column.appendChild(edit);

  // Reveal / re-conceal toggle, only while a mask exists.
  if ( entry ) {
    const toggle = makeHudButton(
      entry.revealed ? "fa-eye" : "fa-masks-theater",
      game.i18n.localize(entry.revealed ? "PF15IM.Tracker.Conceal" : "PF15IM.Tracker.Reveal")
    );
    toggle.dataset.pf15imState = entry.revealed ? "revealed" : "masked";
    toggle.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      await setRevealed(ref, !entry.revealed);
      // Refresh this HUD so the toggle reflects the new state (public AppV2 render).
      app.render();
    });
    column.appendChild(toggle);
  }
}

/**
 * Build a HUD control button matching core markup (button.control-icon).
 * @param {string} faIcon  Font Awesome icon class.
 * @param {string} label   Localized accessible label.
 * @returns {HTMLButtonElement}
 */
function makeHudButton(faIcon, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("control-icon", CSS.hudControl);
  button.setAttribute("aria-label", label);
  button.dataset.tooltip = "";
  const icon = document.createElement("i");
  icon.classList.add("fa-solid", faIcon);
  icon.setAttribute("inert", "");
  button.appendChild(icon);
  return button;
}
