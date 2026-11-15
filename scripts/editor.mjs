/**
 * GM mask editor for pf15-identity-mask, built on DialogV2.wait.
 *
 * Layout per Michael's 2026-06-12 mockup (spec 17.4 amendment):
 *   Public Alias | Partial Alias
 *   Skill Used   | DC Needed
 *   Public Note
 *   <instructions>
 *   Identification Rolls (Manual Record): one row per non-GM player
 *   (Player | Roll Total | Outcome), GM users excluded — GMs see
 *   everything regardless.
 *   <caution> <buttons>
 *
 * The dialog content is a static, fully module-owned template using only
 * localized strings and machine-generated ids. Untrusted values (aliases,
 * notes, user NAMES) are NEVER interpolated into the HTML string; they are
 * assigned to DOM properties (value/textContent) in the render callback.
 */

import { CSS, MAX_ALIAS_LENGTH, MAX_NOTE_LENGTH, MAX_PATH_LENGTH, MAX_PROFILE_LABEL, ID_STATUSES } from "./const.mjs";
import { clearAlias, getMaskEntry, getMaskKey, maskAllForActor, normalizeAlias, recallForProfile, sameActorTokens, setEntry } from "./state.mjs";
import { readProfiles, getProfile, saveProfile } from "./profiles.mjs";

/**
 * Users shown in the roll table: every non-GM user, plus any user id that
 * already carries a roll (e.g. a GM-keyed record carried over by the v2
 * migration — never hidden).
 * @param {object} rolls  The entry's current rolls map.
 * @returns {string[]}  User ids in stable order.
 */
function rollTableUserIds(rolls) {
  const ids = game.users.filter(u => !u.isGM).map(u => u.id);
  for ( const userId of Object.keys(rolls) ) {
    if ( !ids.includes(userId) ) ids.push(userId);
  }
  return ids;
}

/**
 * Open the mask editor for a maskable subject. GM only.
 * @param {import("./state.mjs").MaskRef|Combatant} ref
 * @returns {Promise<void>}
 */
export async function openAliasEditor(ref) {
  if ( !game.user.isGM || !ref ) return;
  const entry = getMaskEntry(ref);
  const identification = entry?.identification ?? null;
  const rolls = identification?.rolls ?? {};
  const rowUsers = rollTableUserIds(rolls);
  const canMaskAll = (sameActorTokens(ref)?.length ?? 0) > 0;

  // Knowledge profiles (0.7.0): reusable templates the GM can apply. Slugs are
  // machine-generated [a-z0-9-] (safe in value=""); labels are set via
  // textContent in render(). Loaded fresh each open.
  const profiles = readProfiles();
  const profileSlugs = Object.keys(profiles);
  // Keep a dangling link (its profile was deleted) selectable so saving never
  // silently drops it — recall still groups by slug. Labeled with the slug in render().
  if ( entry?.profileId && !profileSlugs.includes(entry.profileId) ) profileSlugs.push(entry.profileId);
  const profileOptions = ['<option value=""></option>']
    .concat(profileSlugs.map(s => `<option value="${s}"></option>`)).join("");

  // Static, module-owned markup: localized strings and machine ids only.
  const skills = globalThis.pf1?.config?.skills ?? {};
  const skillOptions = ['<option value=""></option>']
    .concat(Object.keys(skills).map(k => `<option value="${k}"></option>`)).join("");
  const outcomeOptions = ['<option value=""></option>']
    .concat(ID_STATUSES.map(s => `<option value="${s}"></option>`)).join("");
  const rollRows = rowUsers.map(userId => [
    `<tr data-pf15im-user="${userId}">`,
    `<td class="${CSS.editor}-id-player"></td>`,
    `<td><input type="number" name="total-${userId}" step="1"></td>`,
    `<td><select name="outcome-${userId}">${outcomeOptions}</select></td>`,
    "</tr>"
  ].join(""));
  if ( !rollRows.length ) {
    // Text set via textContent in render() (hygiene: never interpolate even
    // localized strings into the content template).
    rollRows.push(`<tr><td colspan="3" class="${CSS.editor}-id-empty"></td></tr>`);
  }
  const content = [
    `<div class="${CSS.editor}-row ${CSS.editor}-profile-bar">`,
    `<div class="form-group ${CSS.editor}-group">`,
    `<label for="pf15im-profile-select">${game.i18n.localize("PF15IM.Editor.ProfileLabel")}</label>`,
    `<select id="pf15im-profile-select" name="profileApply">${profileOptions}</select>`,
    "</div>",
    `<button type="button" name="saveProfile" class="${CSS.editor}-save-profile">`,
    `<i class="fa-solid fa-floppy-disk" inert></i> ${game.i18n.localize("PF15IM.Editor.SaveProfile")}</button>`,
    "</div>",
    `<p class="hint">${game.i18n.localize("PF15IM.Editor.ProfileHint")}</p>`,
    `<div class="${CSS.editor}-row">`,
    `<div class="form-group ${CSS.editor}-group">`,
    `<label for="pf15im-alias-input">${game.i18n.localize("PF15IM.Editor.AliasLabel")}</label>`,
    `<input type="text" id="pf15im-alias-input" name="alias" maxlength="${MAX_ALIAS_LENGTH}" autocomplete="off" spellcheck="false">`,
    "</div>",
    `<div class="form-group ${CSS.editor}-group">`,
    `<label for="pf15im-partial-input">${game.i18n.localize("PF15IM.Editor.PartialAliasLabel")}</label>`,
    `<input type="text" id="pf15im-partial-input" name="partialAlias" maxlength="${MAX_ALIAS_LENGTH}" autocomplete="off" spellcheck="false">`,
    "</div>",
    "</div>",
    `<div class="${CSS.editor}-row">`,
    `<div class="form-group ${CSS.editor}-group">`,
    `<label>${game.i18n.localize("PF15IM.Editor.SkillUsed")}</label><select name="idSkill">${skillOptions}</select>`,
    "</div>",
    `<div class="form-group ${CSS.editor}-group">`,
    `<label>${game.i18n.localize("PF15IM.Editor.DcNeeded")}</label><input type="number" name="idDc" step="1">`,
    "</div>",
    "</div>",
    `<div class="form-group ${CSS.editor}-group">`,
    `<label>${game.i18n.localize("PF15IM.Editor.PublicNote")}</label>`,
    `<input type="text" name="idNote" maxlength="${MAX_NOTE_LENGTH}" autocomplete="off">`,
    "</div>",
    `<div class="form-group ${CSS.editor}-group">`,
    `<label for="pf15im-mystery-input">${game.i18n.localize("PF15IM.Editor.MysteryArtLabel")}</label>`,
    `<input type="text" id="pf15im-mystery-input" name="mysteryArt" maxlength="${MAX_PATH_LENGTH}" autocomplete="off" spellcheck="false">`,
    `<p class="hint">${game.i18n.localize("PF15IM.Editor.MysteryArtHint")}</p>`,
    "</div>",
    `<p class="hint">${game.i18n.localize("PF15IM.Editor.Instructions")}</p>`,
    `<fieldset class="${CSS.editor}-id"><legend>${game.i18n.localize("PF15IM.Editor.IdLegend")}</legend>`,
    `<table class="${CSS.editor}-id-table"><thead><tr>`,
    `<th>${game.i18n.localize("PF15IM.Editor.IdPlayer")}</th>`,
    `<th>${game.i18n.localize("PF15IM.Editor.IdTotal")}</th>`,
    `<th>${game.i18n.localize("PF15IM.Editor.IdOutcome")}</th>`,
    "</tr></thead><tbody>",
    ...rollRows,
    "</tbody></table>",
    "</fieldset>",
    `<p class="hint ${CSS.editor}-id-warning">${game.i18n.localize("PF15IM.Editor.IdPlayerReadable")}</p>`,
    `<fieldset class="${CSS.editor}-recall" hidden><legend>${game.i18n.localize("PF15IM.Editor.RecallLegend")}</legend>`,
    `<div class="${CSS.editor}-recall-body"></div></fieldset>`
  ].join("");

  const collect = button => {
    const f = button.form?.elements ?? {};
    const out = {
      alias: f.alias?.value ?? "",
      partialAlias: f.partialAlias?.value ?? "",
      idSkill: f.idSkill?.value || null,
      idDc: f.idDc?.value ?? null,
      idNote: f.idNote?.value ?? "",
      mysteryArt: f.mysteryArt?.value ?? "",
      profileId: f.profileApply?.value ?? "",
      rolls: {}
    };
    for ( const userId of rowUsers ) {
      const outcome = f[`outcome-${userId}`]?.value ?? "";
      if ( !outcome ) continue;
      out.rolls[userId] = { total: f[`total-${userId}`]?.value ?? null, outcome };
    }
    return out;
  };

  const buttons = [
    {
      action: "save",
      label: "PF15IM.Editor.Save",
      icon: "fa-solid fa-feather-pointed",
      default: true,
      callback: (event, button) => ({ action: "save", ...collect(button) })
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
  if ( canMaskAll ) {
    buttons.splice(1, 0, {
      action: "maskAll",
      label: "PF15IM.MaskAll.Button",
      icon: "fa-solid fa-people-group",
      callback: (event, button) => ({ action: "maskAll", ...collect(button) })
    });
  }

  const result = await foundry.applications.api.DialogV2.wait({
    window: {
      title: "PF15IM.Editor.Title",
      icon: "fa-solid fa-mask"
    },
    classes: [CSS.editor],
    // Fixed width: without it, AppV2 auto-sizing lets the roll table
    // stretch the dialog across the screen and cover the chat sidebar
    // (position.width is public AppV2 API — application.mjs:81/986).
    position: { width: 1280 },
    content,
    buttons,
    rejectClose: false,
    render: (event, dialog) => {
      const el = dialog.element;
      const aliasInput = el.querySelector("input[name=alias]");
      if ( aliasInput ) {
        // Property assignment, not attribute interpolation: hostile alias
        // text stays inert.
        aliasInput.value = entry?.alias ?? "";
        aliasInput.focus();
        aliasInput.select();
      }
      const partialInput = el.querySelector("input[name=partialAlias]");
      if ( partialInput ) partialInput.value = entry?.partialAlias ?? "";

      // Localize select labels via DOM (values stay machine keys).
      const skillCfg = globalThis.pf1?.config?.skills ?? {};
      for ( const opt of el.querySelectorAll("select[name=idSkill] option") ) {
        opt.textContent = opt.value ? String(skillCfg[opt.value]?.name ?? skillCfg[opt.value] ?? opt.value) : "—";
      }
      for ( const select of el.querySelectorAll(`.${CSS.editor}-id-table select`) ) {
        for ( const opt of select.options ) {
          opt.textContent = opt.value ? game.i18n.localize(`PF15IM.IdStatus.${opt.value}`) : game.i18n.localize("PF15IM.Editor.IdNone");
        }
      }

      // Seed shared identification fields.
      el.querySelector("select[name=idSkill]").value = identification?.skill ?? "";
      el.querySelector("input[name=idDc]").value = identification?.dc ?? "";
      el.querySelector("input[name=idNote]").value = identification?.publicNote ?? "";
      const mysteryInput = el.querySelector("input[name=mysteryArt]");
      if ( mysteryInput ) mysteryInput.value = entry?.mysteryArt ?? "";

      // Fill player names (untrusted -> textContent) and seed roll rows.
      for ( const tr of el.querySelectorAll(`.${CSS.editor}-id-table tr[data-pf15im-user]`) ) {
        const userId = tr.dataset.pf15imUser;
        tr.querySelector(`.${CSS.editor}-id-player`).textContent = game.users.get(userId)?.name ?? userId;
        const record = rolls[userId];
        if ( !record ) continue;
        tr.querySelector(`input[name="total-${userId}"]`).value = record.total ?? "";
        tr.querySelector(`select[name="outcome-${userId}"]`).value = record.outcome;
      }

      // Empty-state "no players" cell text via textContent (hygiene: never
      // interpolate even localized strings into the content template).
      const emptyCell = el.querySelector(`.${CSS.editor}-id-empty`);
      if ( emptyCell ) emptyCell.textContent = game.i18n.localize("PF15IM.Editor.IdNoPlayers");

      // Knowledge profiles (0.7.0): label the apply dropdown, prefill on select,
      // and wire "Save as profile" (labels via textContent — untrusted).
      const profileSelect = el.querySelector("select[name=profileApply]");
      if ( profileSelect ) {
        for ( const opt of profileSelect.options ) {
          opt.textContent = opt.value ? (profiles[opt.value]?.label ?? opt.value) : game.i18n.localize("PF15IM.Editor.ProfileNone");
        }
        // Programmatic .value assignment fires no change event → prefill stays off,
        // so reopening a linked token never re-clobbers a customized alias.
        profileSelect.value = entry?.profileId ?? "";
        profileSelect.addEventListener("change", () => {
          renderRecall(profileSelect.value);
          const p = getProfile(profileSelect.value);
          if ( !p ) return;
          el.querySelector("input[name=alias]").value = p.alias ?? "";
          el.querySelector("input[name=partialAlias]").value = p.partialAlias ?? "";
          const mInput = el.querySelector("input[name=mysteryArt]");
          if ( mInput ) mInput.value = p.mysteryArt ?? "";
        });
      }

      // Cross-encounter recall (0.8.0, GM-only): list PCs who reached partial/
      // identified on OTHER tokens sharing this profile. Excludes the current
      // token (its rolls are in the table above). Player names via textContent.
      const renderRecall = (profileId) => {
        const fieldset = el.querySelector(`.${CSS.editor}-recall`);
        const body = el.querySelector(`.${CSS.editor}-recall-body`);
        if ( !fieldset || !body ) return;
        body.replaceChildren();
        const data = recallForProfile(profileId, { excludeKey: getMaskKey(ref) });
        const rows = Object.entries(data)
          .filter(([, agg]) => (agg.bestOutcome === "partial") || (agg.bestOutcome === "identified"));
        if ( !rows.length ) { fieldset.hidden = true; return; }
        for ( const [userId, agg] of rows ) {
          const row = document.createElement("p");
          row.classList.add(`${CSS.editor}-recall-row`);
          const name = document.createElement("span");
          name.classList.add(`${CSS.editor}-recall-name`);
          name.textContent = game.users.get(userId)?.name ?? userId;
          const detail = document.createElement("span");
          detail.classList.add(`${CSS.editor}-recall-detail`);
          detail.textContent = ` — ${game.i18n.localize(`PF15IM.IdStatus.${agg.bestOutcome}`)}`
            + ` · ${game.i18n.format("PF15IM.Editor.RecallEncounters", { count: agg.encounters })}`;
          row.append(name, detail);
          body.appendChild(row);
        }
        fieldset.hidden = false;
      };
      renderRecall(entry?.profileId ?? "");
      const saveProfileBtn = el.querySelector("button[name=saveProfile]");
      saveProfileBtn?.addEventListener("click", async () => {
        const aliasVal = el.querySelector("input[name=alias]")?.value ?? "";
        const partialVal = el.querySelector("input[name=partialAlias]")?.value ?? "";
        const artVal = el.querySelector("input[name=mysteryArt]")?.value ?? "";
        const label = await foundry.applications.api.DialogV2.prompt({
          window: { title: "PF15IM.Editor.SaveProfileTitle", icon: "fa-solid fa-floppy-disk" },
          content: `<div class="form-group"><label for="pf15im-profile-name">${game.i18n.localize("PF15IM.Editor.ProfileNameLabel")}</label>`
            + `<input type="text" id="pf15im-profile-name" name="profileLabel" maxlength="${MAX_PROFILE_LABEL}" autocomplete="off" spellcheck="false"></div>`,
          ok: {
            icon: "fa-solid fa-floppy-disk", label: "PF15IM.Editor.SaveProfile",
            // v13 DialogV2: read the field from the button's form, not the instance.
            callback: (e, button) => button.form?.querySelector("input[name=profileLabel]")?.value ?? ""
          },
          rejectClose: false,
          render: (e, dlg) => {
            const inp = dlg.element.querySelector("input[name=profileLabel]");
            if ( inp ) { inp.value = aliasVal; inp.focus(); inp.select(); }
          }
        });
        if ( !label || !label.trim() ) return;
        const slug = await saveProfile({ label, alias: aliasVal, partialAlias: partialVal, mysteryArt: artVal });
        if ( !slug || !profileSelect ) return;
        const saved = getProfile(slug);
        let opt = [...profileSelect.options].find(o => o.value === slug);
        if ( !opt ) { opt = document.createElement("option"); opt.value = slug; profileSelect.appendChild(opt); }
        opt.textContent = saved?.label ?? slug;
        ui.notifications.info(game.i18n.format("PF15IM.Editor.ProfileSaved", { label: saved?.label ?? slug }));
      });
    }
  });

  if ( !result || typeof result !== "object" ) return;
  if ( result.action === "clear" ) { await clearAlias(ref); return; }
  if ( result.action === "maskAll" ) { await openMaskAllDialog(ref, result.alias, result.partialAlias, result.profileId); return; }
  if ( result.action !== "save" ) return;

  // One registry write for the whole Save (0.8.4, TD-50a). Empty alias clears
  // the entry. The identification container NEVER touches the display tier.
  await setEntry(ref, {
    alias: result.alias,
    partialAlias: result.partialAlias,
    mysteryArt: result.mysteryArt,
    profileId: result.profileId,
    identification: {
      skill: result.idSkill,
      dc: result.idDc,
      publicNote: result.idNote,
      rolls: result.rolls
    }
  });
}

/**
 * Guarded mask-all confirmation (spec 17.5, BINDING guardrails): live
 * affected-token count, current-scene only, skip-existing unless the
 * explicit overwrite checkbox is set, numbered-suffix preview — all
 * BEFORE anything is written. Confirm performs ONE atomic registry write.
 * @param {import("./state.mjs").MaskRef|Combatant} ref
 * @param {unknown} rawAlias         Alias text from the editor form.
 * @param {unknown} rawPartialAlias  Partial alias text from the editor form.
 * @param {unknown} rawProfileId     Linked profile slug from the editor form (0.8.0).
 * @returns {Promise<void>}
 */
async function openMaskAllDialog(ref, rawAlias, rawPartialAlias, rawProfileId) {
  const alias = normalizeAlias(rawAlias);
  if ( !alias ) {
    ui.notifications.warn("PF15IM.MaskAll.NeedAlias", { localize: true });
    return;
  }
  const tokens = sameActorTokens(ref);
  if ( !tokens?.length ) return;

  const content = [
    `<p class="${CSS.editor}-maskall-count"></p>`,
    `<div class="form-group"><label class="checkbox"><input type="checkbox" name="overwrite">`,
    `${game.i18n.localize("PF15IM.MaskAll.Overwrite")}</label></div>`,
    `<div class="form-group"><label class="checkbox"><input type="checkbox" name="numbered" checked>`,
    `${game.i18n.localize("PF15IM.MaskAll.Numbered")}</label></div>`,
    `<p class="hint ${CSS.editor}-maskall-preview"></p>`
  ].join("");

  const result = await foundry.applications.api.DialogV2.wait({
    window: {
      title: "PF15IM.MaskAll.Title",
      icon: "fa-solid fa-people-group"
    },
    classes: [CSS.editor],
    content,
    buttons: [
      {
        action: "confirm",
        label: "PF15IM.MaskAll.Confirm",
        icon: "fa-solid fa-masks-theater",
        default: true,
        callback: (event, button) => ({
          overwrite: button.form?.elements?.overwrite?.checked === true,
          numbered: button.form?.elements?.numbered?.checked === true
        })
      },
      {
        action: "cancel",
        label: "PF15IM.Editor.Cancel",
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ],
    rejectClose: false,
    render: (event, dialog) => {
      const el = dialog.element;
      const countEl = el.querySelector(`.${CSS.editor}-maskall-count`);
      const previewEl = el.querySelector(`.${CSS.editor}-maskall-preview`);
      const overwriteBox = el.querySelector("input[name=overwrite]");
      const numberedBox = el.querySelector("input[name=numbered]");
      const update = () => {
        const overwrite = overwriteBox.checked;
        const numbered = numberedBox.checked;
        const targets = tokens.filter(t => overwrite || !getMaskEntry({ sceneId: ref.sceneId, tokenId: t.id }));
        countEl.textContent = game.i18n.format("PF15IM.MaskAll.Count", { count: targets.length, total: tokens.length });
        const names = targets.map((t, i) => (numbered && targets.length > 1) ? normalizeAlias(`${alias} ${i + 1}`) : alias);
        const shown = names.slice(0, 3).join(", ") + ((names.length > 3) ? ", …" : "");
        previewEl.textContent = names.length ? game.i18n.format("PF15IM.MaskAll.Preview", { names: shown }) : game.i18n.localize("PF15IM.MaskAll.NoTargets");
      };
      overwriteBox.addEventListener("change", update);
      numberedBox.addEventListener("change", update);
      update();
    }
  });

  if ( !result || typeof result !== "object" ) return;
  const written = await maskAllForActor(ref, {
    alias: rawAlias,
    partialAlias: rawPartialAlias,
    profileId: rawProfileId,
    overwrite: result.overwrite,
    numbered: result.numbered
  });
  if ( written ) ui.notifications.info(game.i18n.format("PF15IM.MaskAll.Done", { count: written }));
  else ui.notifications.warn("PF15IM.MaskAll.NoTargets", { localize: true });
}
