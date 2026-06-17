/**
 * GM Tools dialog for pf15-identity-mask (0.7.0), opened from the module's
 * settings menu (Configure Settings → Identity Mask → "Identity Mask Tools").
 *
 * Two lean sections:
 *   - Maintenance: purge mask entries whose scene/token no longer exists.
 *   - Knowledge Profiles: list + delete saved profiles, and JSON import/export
 *     for backup / sharing. Profiles are CREATED from the mask editor
 *     ("Save as profile") and APPLIED from its dropdown; this dialog is the
 *     management surface, deliberately kept to list/delete/import/export.
 *
 * GM only (the settings menu is registered `restricted: true`, and every write
 * is GM-guarded + server-enforced at the Setting layer). Untrusted text
 * (profile labels) is assigned via textContent, never interpolated into markup.
 */

import { MODULE_ID, MENU_TOOLS, CSS } from "./const.mjs";
import { purgeOrphanedEntries, countOrphanedEntries } from "./state.mjs";
import { readProfiles, deleteProfile, exportProfilesJSON, importProfilesJSON } from "./profiles.mjs";

const ApplicationV2 = foundry.applications.api.ApplicationV2;

export class IdentityMaskTools extends ApplicationV2 {

  static DEFAULT_OPTIONS = {
    id: "pf15im-tools",
    classes: [CSS.tools],
    position: { width: 480, height: "auto" },
    window: { title: "PF15IM.Tools.Title", icon: "fa-solid fa-toolbox", resizable: true },
    actions: {
      purge: IdentityMaskTools.#onPurge,
      deleteProfile: IdentityMaskTools.#onDeleteProfile,
      importProfiles: IdentityMaskTools.#onImportProfiles
    }
  };

  /* ── render ── */

  async _renderHTML(_context, _options) {
    const root = document.createElement("div");
    root.classList.add(`${CSS.tools}-body`);
    if ( !game.user?.isGM ) { root.textContent = game.i18n.localize("PF15IM.Warn.GmOnly"); return root; }

    root.appendChild(this.#buildMaintenance());
    root.appendChild(this.#buildProfiles());
    return root;
  }

  _replaceHTML(result, content, _options) {
    content.replaceChildren(result);
  }

  /* ── maintenance section ── */

  #buildMaintenance() {
    const section = sectionEl("PF15IM.Tools.MaintenanceTitle", "fa-broom");
    const orphans = countOrphanedEntries();
    const p = document.createElement("p");
    p.classList.add("hint");
    p.textContent = game.i18n.format("PF15IM.Tools.OrphanCount", { count: orphans });
    section.appendChild(p);

    const btn = textButton("purge", "fa-broom", game.i18n.localize("PF15IM.Tools.Purge"));
    btn.disabled = orphans === 0;
    section.appendChild(btn);
    return section;
  }

  /* ── profiles section ── */

  #buildProfiles() {
    const section = sectionEl("PF15IM.Tools.ProfilesTitle", "fa-book");
    const profiles = readProfiles();
    const slugs = Object.keys(profiles);

    if ( !slugs.length ) {
      const empty = document.createElement("p");
      empty.classList.add("hint");
      empty.textContent = game.i18n.localize("PF15IM.Tools.NoProfiles");
      section.appendChild(empty);
    } else {
      const list = document.createElement("ul");
      list.classList.add(`${CSS.tools}-profile-list`);
      for ( const slug of slugs ) {
        const li = document.createElement("li");
        const name = document.createElement("span");
        name.classList.add(`${CSS.tools}-profile-label`);
        name.textContent = profiles[slug].label;           // untrusted → textContent
        const sub = document.createElement("span");
        sub.classList.add(`${CSS.tools}-profile-sub`);
        sub.textContent = profiles[slug].alias || "—";
        const del = textButton("deleteProfile", "fa-trash", game.i18n.localize("PF15IM.Tools.Delete"));
        del.dataset.slug = slug;
        li.append(name, sub, del);
        list.appendChild(li);
      }
      section.appendChild(list);
    }

    // Export (readonly) — GM selects + copies.
    const exportLabel = document.createElement("label");
    exportLabel.classList.add(`${CSS.tools}-field-label`);
    exportLabel.textContent = game.i18n.localize("PF15IM.Tools.ExportLabel");
    const exportTa = document.createElement("textarea");
    exportTa.classList.add(`${CSS.tools}-json`);
    exportTa.readOnly = true;
    exportTa.rows = 5;
    exportTa.value = exportProfilesJSON();
    section.append(exportLabel, exportTa);

    // Import.
    const importLabel = document.createElement("label");
    importLabel.classList.add(`${CSS.tools}-field-label`);
    importLabel.textContent = game.i18n.localize("PF15IM.Tools.ImportLabel");
    const importTa = document.createElement("textarea");
    importTa.classList.add(`${CSS.tools}-json`, `${CSS.tools}-import`);
    importTa.rows = 5;
    importTa.placeholder = game.i18n.localize("PF15IM.Tools.ImportPlaceholder");

    const replaceWrap = document.createElement("label");
    replaceWrap.classList.add("checkbox", `${CSS.tools}-replace`);
    const replaceBox = document.createElement("input");
    replaceBox.type = "checkbox";
    replaceBox.classList.add(`${CSS.tools}-replace-box`);
    replaceWrap.append(replaceBox, document.createTextNode(" " + game.i18n.localize("PF15IM.Tools.ImportReplace")));

    const importBtn = textButton("importProfiles", "fa-file-import", game.i18n.localize("PF15IM.Tools.Import"));
    section.append(importLabel, importTa, replaceWrap, importBtn);
    return section;
  }

  /* ── actions ── */

  static async #onPurge() {
    const orphans = countOrphanedEntries();
    if ( !orphans ) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "PF15IM.Tools.Purge", icon: "fa-solid fa-broom" },
      content: `<p>${game.i18n.format("PF15IM.Tools.PurgeConfirm", { count: orphans })}</p>`,
      rejectClose: false
    });
    if ( !ok ) return;
    const removed = await purgeOrphanedEntries();
    ui.notifications.info(game.i18n.format("PF15IM.Tools.PurgeDone", { count: removed }));
    this.render();
  }

  static async #onDeleteProfile(event, target) {
    const slug = target?.dataset?.slug;
    if ( !slug ) return;
    await deleteProfile(slug);
    this.render();
  }

  static async #onImportProfiles() {
    const importTa = this.element.querySelector(`.${CSS.tools}-import`);
    const replace = this.element.querySelector(`.${CSS.tools}-replace-box`)?.checked === true;
    const text = importTa?.value?.trim();
    if ( !text ) return;
    const result = await importProfilesJSON(text, { replace });
    if ( !result ) return; // parse error already reported
    ui.notifications.info(game.i18n.format("PF15IM.Tools.ImportDone", { imported: result.imported, skipped: result.skipped }));
    this.render();
  }
}

/* ── small DOM helpers ── */

function sectionEl(titleKey, icon) {
  const section = document.createElement("section");
  section.classList.add(`${CSS.tools}-section`);
  const header = document.createElement("header");
  header.classList.add(`${CSS.tools}-section-header`);
  const i = document.createElement("i");
  i.className = `fa-solid ${icon}`;
  i.setAttribute("inert", "");
  const h = document.createElement("span");
  h.textContent = game.i18n.localize(titleKey);
  header.append(i, h);
  section.appendChild(header);
  return section;
}

function textButton(action, icon, label) {
  const b = document.createElement("button");
  b.type = "button";
  b.classList.add(`${CSS.tools}-btn`);
  b.dataset.action = action;
  const i = document.createElement("i");
  i.className = `fa-solid ${icon}`;
  i.setAttribute("inert", "");
  b.append(i, document.createTextNode(" " + label));
  return b;
}

/** Register the GM-only settings menu that opens the Tools dialog. Call in init. */
export function registerToolsMenu() {
  game.settings.registerMenu(MODULE_ID, MENU_TOOLS, {
    name: "PF15IM.Tools.MenuName",
    label: "PF15IM.Tools.MenuLabel",
    hint: "PF15IM.Tools.MenuHint",
    icon: "fa-solid fa-toolbox",
    type: IdentityMaskTools,
    restricted: true
  });
}
