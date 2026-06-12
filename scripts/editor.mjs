/**
 * GM alias editor for pf15-identity-mask, built on DialogV2.wait.
 *
 * The dialog content is a static, fully module-owned template using only
 * localized strings from this module's language files. The current alias —
 * untrusted input — is NEVER interpolated into the HTML string; it is
 * assigned to the input's value property in the render callback.
 */

import { CSS, MAX_ALIAS_LENGTH } from "./const.mjs";
import { clearAlias, getMaskEntry, setAlias } from "./state.mjs";

/**
 * Open the alias editor for a maskable subject. GM only.
 * @param {import("./state.mjs").MaskRef|Combatant} ref
 * @returns {Promise<void>}
 */
export async function openAliasEditor(ref) {
  if ( !game.user.isGM || !ref ) return;
  const entry = getMaskEntry(ref);
  const currentAlias = entry?.alias ?? "";

  const content = [
    `<div class="form-group ${CSS.editor}-group">`,
    `<label for="pf15im-alias-input">${game.i18n.localize("PF15IM.Editor.AliasLabel")}</label>`,
    `<input type="text" id="pf15im-alias-input" name="alias" maxlength="${MAX_ALIAS_LENGTH}" autocomplete="off" spellcheck="false">`,
    `<p class="hint">${game.i18n.localize("PF15IM.Editor.AliasHint")}</p>`,
    "</div>"
  ].join("");

  const buttons = [
    {
      action: "save",
      label: "PF15IM.Editor.Save",
      icon: "fa-solid fa-feather-pointed",
      default: true,
      callback: (event, button) => ({ action: "save", alias: button.form?.elements.alias?.value ?? "" })
    },
    {
      action: "cancel",
      label: "PF15IM.Editor.Cancel",
      icon: "fa-solid fa-xmark",
      callback: () => null
    }
  ];
  if ( entry ) {
    buttons.splice(1, 0, {
      action: "clear",
      label: "PF15IM.Editor.Clear",
      icon: "fa-solid fa-eraser",
      callback: () => ({ action: "clear" })
    });
  }

  const result = await foundry.applications.api.DialogV2.wait({
    window: {
      title: "PF15IM.Editor.Title",
      icon: "fa-solid fa-mask"
    },
    classes: [CSS.editor],
    content,
    buttons,
    rejectClose: false,
    render: (event, dialog) => {
      const input = dialog.element.querySelector("input[name=alias]");
      if ( input ) {
        // Property assignment, not attribute interpolation: hostile alias
        // text stays inert.
        input.value = currentAlias;
        input.focus();
        input.select();
      }
    }
  });

  if ( !result || typeof result !== "object" ) return;
  if ( result.action === "clear" ) await clearAlias(ref);
  else if ( result.action === "save" ) await setAlias(ref, result.alias);
}
