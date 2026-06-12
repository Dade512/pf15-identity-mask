/**
 * GM alias editor for pf15-identity-mask, built on DialogV2.wait.
 *
 * The dialog content is a static, fully module-owned template using only
 * localized strings from this module's language files. The current alias —
 * untrusted input — is NEVER interpolated into the HTML string; it is
 * assigned to the input's value property in the render callback.
 */

import { CSS, MAX_ALIAS_LENGTH, MAX_NOTE_LENGTH, ID_STATUSES } from "./const.mjs";
import { clearAlias, getMaskEntry, setAlias, setIdentification } from "./state.mjs";

/**
 * Open the alias editor for a maskable subject. GM only.
 * @param {import("./state.mjs").MaskRef|Combatant} ref
 * @returns {Promise<void>}
 */
export async function openAliasEditor(ref) {
  if ( !game.user.isGM || !ref ) return;
  const entry = getMaskEntry(ref);
  const currentAlias = entry?.alias ?? "";

  // Static, module-owned markup with localized strings only; untrusted
  // values (alias, identification fields) are assigned via DOM properties
  // in the render callback, never interpolated.
  const skills = globalThis.pf1?.config?.skills ?? {};
  const skillOptions = ['<option value=""></option>']
    .concat(Object.keys(skills).map(k => `<option value="${k}"></option>`)).join("");
  const statusOptions = ['<option value=""></option>']
    .concat(ID_STATUSES.map(s => `<option value="${s}"></option>`)).join("");
  const content = [
    `<div class="form-group ${CSS.editor}-group">`,
    `<label for="pf15im-alias-input">${game.i18n.localize("PF15IM.Editor.AliasLabel")}</label>`,
    `<input type="text" id="pf15im-alias-input" name="alias" maxlength="${MAX_ALIAS_LENGTH}" autocomplete="off" spellcheck="false">`,
    `<p class="hint">${game.i18n.localize("PF15IM.Editor.AliasHint")}</p>`,
    "</div>",
    `<fieldset class="${CSS.editor}-id"><legend>${game.i18n.localize("PF15IM.Editor.IdLegend")}</legend>`,
    `<div class="form-group"><label>${game.i18n.localize("PF15IM.Editor.IdStatus")}</label><select name="idStatus">${statusOptions}</select></div>`,
    `<div class="form-group"><label>${game.i18n.localize("PF15IM.Editor.IdSkill")}</label><select name="idSkill">${skillOptions}</select></div>`,
    `<div class="form-group"><label>${game.i18n.localize("PF15IM.Editor.IdTotal")}</label><input type="number" name="idTotal" step="1">`,
    `<label>${game.i18n.localize("PF15IM.Editor.IdDc")}</label><input type="number" name="idDc" step="1"></div>`,
    `<div class="form-group"><label>${game.i18n.localize("PF15IM.Editor.IdNote")}</label><input type="text" name="idNote" maxlength="${MAX_NOTE_LENGTH}" autocomplete="off"></div>`,
    `<p class="hint ${CSS.editor}-id-warning">${game.i18n.localize("PF15IM.Editor.IdPlayerReadable")}</p>`,
    "</fieldset>"
  ].join("");

  const buttons = [
    {
      action: "save",
      label: "PF15IM.Editor.Save",
      icon: "fa-solid fa-feather-pointed",
      default: true,
      callback: (event, button) => {
        const f = button.form?.elements ?? {};
        return {
          action: "save",
          alias: f.alias?.value ?? "",
          identification: {
            status: f.idStatus?.value ?? "",
            skill: f.idSkill?.value || null,
            total: f.idTotal?.value ?? null,
            dc: f.idDc?.value ?? null,
            publicNote: f.idNote?.value ?? ""
          }
        };
      }
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
      const el = dialog.element;
      // Localize select labels and seed identification values via DOM.
      for ( const opt of el.querySelectorAll("select[name=idStatus] option") ) {
        opt.textContent = opt.value ? game.i18n.localize(`PF15IM.IdStatus.${opt.value}`) : game.i18n.localize("PF15IM.Editor.IdNone");
      }
      const skills = globalThis.pf1?.config?.skills ?? {};
      for ( const opt of el.querySelectorAll("select[name=idSkill] option") ) {
        opt.textContent = opt.value ? String(skills[opt.value]?.name ?? skills[opt.value] ?? opt.value) : "—";
      }
      const id = entry?.identification;
      if ( id ) {
        el.querySelector("select[name=idStatus]").value = id.status;
        el.querySelector("select[name=idSkill]").value = id.skill ?? "";
        el.querySelector("input[name=idTotal]").value = id.total ?? "";
        el.querySelector("input[name=idDc]").value = id.dc ?? "";
        el.querySelector("input[name=idNote]").value = id.publicNote ?? "";
      }
    }
  });

  if ( !result || typeof result !== "object" ) return;
  if ( result.action === "clear" ) { await clearAlias(ref); return; }
  if ( result.action !== "save" ) return;
  await setAlias(ref, result.alias);
  // Identification: empty status = clear; otherwise validated write.
  const idForm = result.identification;
  if ( !idForm ) return;
  if ( !idForm.status ) await setIdentification(ref, null);
  else await setIdentification(ref, { ...idForm, userId: game.user.id });
}
