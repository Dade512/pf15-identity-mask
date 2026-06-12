# pf15-identity-mask 0.2.0 — Verification Report

Date: 2026-06-12
Environment: Foundry VTT **13.350**, system **pf1 11.11**, world **Echoes Dev Sandbox**
(`baphomets-fall-dev`), full 68-module load. Clients: **Vivaldi = GM** (`Dade`, GAMEMASTER) ·
**Chrome = Player** (`DXWarlock`, TRUSTED). GM identity re-verified after every reload.
Spec: `docs/specs/identity-mask/identity-mask.spec.md` §14. Roadmap: `ROADMAP.md` (approved).

## 1. What 0.2.0 adds

- **Token HUD controls (GM):** mask-edit button + reveal/conceal toggle on the HUD left
  column — full mask lifecycle with **no combat anywhere**.
- **Canvas nameplate masking (players):** masked tokens show the alias on the plate;
  GM plates show the plain true name (no glyph, per roadmap decision).
- **Shared resolver groundwork:** state API generalized to `{sceneId, tokenId}` refs
  (`refForTokenDocument` adapter); tracker/editor behavior unchanged. Registry schema
  unchanged (v1 flat map).

## 2. Recon outcome (Phase 1 — all public APIs, no stop condition)

The roadmap's neutral-verification mandate was honored; installed source contradicted the
older project references:

| Hypothesis | Verdict |
|---|---|
| TokenHUD base class (refs said V1/jQuery) | **AppV2** — `TokenHUD extends HandlebarsApplicationMixin(BasePlaceableHUD)`, `BasePlaceableHUD extends ApplicationV2` (token-hud.mjs:17, placeable-hud.mjs:15). `renderTokenHUD(app, element:HTMLElement, ...)` fires through the chain, including for PF1's `TokenHUDPF` subclass. |
| `token.nameplate` | Public documented property (PreciseText); core resets `.text = document.name` in `_refreshNameplate()` per `refreshNameplate` flag. |
| `refreshToken` hook | Public; fires AFTER `_applyRenderFlags` (placeable-object.mjs:368) — module overwrite supersedes core's reset. |
| `drawToken` hook | Public; fires after plate creation while the placeable is still `visible=false` (placeable-object.mjs:421-436) — used as the first-paint flash guard. |
| `renderFlags.set({refreshNameplate:true})` | Public documented property/method; core's own pattern; used by the registry onChange for cross-client canvas sync. |
| PF1 `TokenPF` | Extends Token, no nameplate overrides. Core token tooltip = elevation (not a name surface). |

## 3. Static validation (Phase 4 — all PASS)

`node --check` 7/7 · module.json + en.json valid · 14/14 imports resolve · 16/16 i18n keys ·
0 hits on all forbidden patterns (innerHTML/insertAdjacentHTML/eval/Function/alert/console.log/
prototype/jQuery/fetch/remote) · all CSS selectors `.pf15im-`scoped, no `!important` · no
underscore-API calls.

## 4. Runtime scenarios (Phase 5)

| Scenario | GM (Vivaldi) | Player (Chrome) | Sync | Leak |
|---|---|---|---|---|
| HUD set alias, **zero combats in world** ("Pale Thing" via dialog) | PASS — registry entry created; toggle appeared after HUD self-refresh | PASS — plate masked | YES | NONE |
| GM plate while masked | PASS — plain true name "Ghoul A" (no glyph) | n/a | n/a | n/a |
| Player plate, displayName=ALWAYS, non-owner | n/a | PASS — "Pale Thing" from initial scene draw (drawToken path) | YES | NONE |
| Player plate, displayName=HOVER token | n/a | PASS — masked text (visibility semantics core) | YES | NONE |
| Reveal via HUD toggle | PASS — registry revealed:true, toggle relabeled | PASS — plate flipped to true name **live, no reload** | YES | NONE |
| Re-conceal via HUD toggle | PASS — revealed:false | PASS — plate back to alias **live** | YES | NONE |
| Owner leg (DXWarlock granted OWNER) | n/a | PASS — owned-token HUD opens with **0 module controls**; plate still masked | n/a | NONE |
| Ownership ≠ mask authority | n/a | PASS — forged `settings.set` rejected by **server** even as actor OWNER (closes the 0.1.0 untested leg) | n/a | n/a |
| Hostile alias `<img src=x onerror=alert(1)>` on canvas | PASS — GM plate untouched | PASS — plate renders payload as literal PIXI text; no alert; tracker row also literal | YES | NONE |
| Tracker + canvas agreement (combat created after masking) | PASS — rows show true name + alias lines | PASS — rows AND plates aliased simultaneously (screenshot evidence) | YES | NONE |
| Clear alias (HUD dialog Clear) | PASS — entry deleted, toggle gone, GM plate unchanged | PASS — tracker and plate restored to core name | YES | NONE |
| No document mutation | PASS — Actor/Token names intact throughout | PASS | n/a | n/a |
| 0.1.0 regression (tracker mask, hostile text, clear, sync, server rejection) | PASS | PASS | YES | NONE |

Consoles: zero module errors on both clients all session (only localization loads; the
recurring errors in the GM log belong to pf1-statblock-converter and predate this work).

## 5. Honest observations and limitations

1. **First-paint flash:** mechanism-verified (drawToken masks while the placeable is
   invisible) and no flash was ever observed; frame-level instrumentation was not possible
   with this tooling. Status: NOT INSTRUMENT-VERIFIED, mechanism sound, zero observations.
2. **Automation artifacts (not module behavior):** the Chrome tab, when backgrounded by the
   automation, pauses animation frames so canvas render flags queue until the tab renders
   again — plates appeared "stale" in reads until a frame ran, then applied correctly every
   time. One canvas-wide queue stall required a player reload; it was traced to a
   tooling-induced renderer freeze (a bulk window-close script), after which a clean reload
   rendered the correct masked state. Real focused player clients do not have this issue.
   Additionally, an invisible `notes-list` overlay (ninja-notes) intercepts coordinate
   clicks over parts of the canvas/HUD in this world — module buttons were therefore
   activated via direct element `.click()` dispatch (same listeners, same code path).
3. **Manifest version display** required a world relaunch to read 0.2.0 (server package
   cache); performed, both clients rejoined and re-verified on 0.2.0.
4. Chat, targeting, and ancillary surfaces still show true names — that is 0.3.0 scope.

## 6. Cleanup / world state (Fable session)

All disposable test state removed (actor `PF15IM Ghoul`, 2 tokens, test combat); registry
emptied `{}`; pre-existing Round-10 encounter remains active and untouched; module left
enabled at **0.2.0** on both clients.

## 7. Release status

Per ROADMAP release discipline: **no commit, push, or tag has been made.** The repo working
tree holds the 0.2.0 candidate awaiting Michael's closeout review and explicit approval.
Version (`module.json` 0.2.0) is ready to match a `v0.2.0` tag at that point.

## 8. Recommended next milestone

0.3.0 — leak census first (scope-gated): full PF1 combat round from the player seat against
a masked creature; freeze the supported-surface list; then implement chat-speaker masking on
`renderChatMessageHTML` with chat-log re-render on registry change.

---

## 9. Independent closeout — architecture and installed-source re-verification

Performed 2026-06-12. Same environment as above. All Foundry source claims re-verified by
direct file grep against the installed source at `S:\FoundryVTT\resources\app\public\scripts\`.

### API claims confirmed against installed source

| Claim | Source location | Confirmed |
|---|---|---|
| `TokenHUD extends HandlebarsApplicationMixin(BasePlaceableHUD)` | `token-hud.mjs:17` | YES |
| `BasePlaceableHUD extends ApplicationV2` | `placeable-hud.mjs:15` | YES |
| `refreshToken` fires AFTER `_applyRenderFlags` | `placeable-object.mjs:368` | YES |
| `drawToken` fires while `visible=false` | `placeable-object.mjs:432` | YES |
| `_refreshNameplate()` sets `nameplate.text = this.document.name` | `token.mjs:1408` | YES |
| PF1 `TokenHUDPF extends TokenHUD` — no nameplate overrides | PF1 system source | YES |

The spec note that "TokenHUD is V1/jQuery" is stale documentation — contradicted by
installed source. The module's AppV2 implementation is correct.

### Architecture review summary

- `hud.mjs`: GM-only guard + `element instanceof HTMLElement` guard both present.
  Idempotency check (`column.querySelector('.pf15im-hud-control')`) prevents duplicate
  injection on re-renders. All DOM via `createElement` + `textContent`/`classList.add`.
  No `innerHTML`. After save, `app.render()` refreshes the HUD toggle.
- `canvas.mjs`: `onRefreshToken` early-exits on `!flags.refreshNameplate`, preventing
  redundant work. `maskNameplate` is GM-safe (returns immediately for `game.user.isGM`).
  Nameplate text set via `nameplate.text` (PIXI property) — not DOM.
- `state.mjs` `onChange`: fires `ui.combat?.render()` + `renderFlags.set({refreshNameplate:true})`
  for all canvas tokens — both tracker instances and nameplate sync covered in one callback.
- No forbidden patterns, no prototype mutation, no jQuery, no `fetch`/remote calls,
  no underscore-prefixed API calls found in any module file.
- Junction verified: `V:\FoundryVTTData\Data\modules\pf15-identity-mask` → repo root.
  Confirmed live by checking module version and file contents match the working tree.

## 10. Independent closeout — static re-check

All 16 static categories re-verified:

| Category | Result |
|---|---|
| `node --check` syntax (7 files) | PASS — 7/7 |
| `module.json` valid JSON, required fields | PASS |
| `en.json` valid JSON | PASS |
| 14 ESM import paths resolve on disk | PASS — 14/14 |
| 16 i18n keys used in source | PASS — 16/16 |
| 0 unused i18n keys | PASS |
| `innerHTML` / `insertAdjacentHTML` absent | PASS |
| `eval` / `Function(` absent | PASS |
| `alert` / `console.log` absent | PASS |
| `prototype` mutation absent | PASS |
| jQuery (`$(`/`jQuery(`) absent | PASS |
| `fetch` / remote network calls absent | PASS |
| Underscore-API calls absent | PASS |
| All CSS selectors `.pf15im-` scoped | PASS |
| No `!important` in CSS | PASS |
| No direct `TokenDocument`/`Actor`/`Token` `.update()` calls for name mutation | PASS |

## 11. Independent closeout — runtime scenarios (this session)

Environment: same two-client setup (Vivaldi = Dade/GM, Chrome = DXWarlock/Player).
Test actors/tokens created fresh on the Staging scene; combat created mid-session for
tracker scenarios. World state was clean at start (registry `{}`).

| Scenario | GM | Player | Sync | Leak |
|---|---|---|---|---|
| **A** HUD mask button present, zero combats; alias "Pale Thing" saved | PASS — registry entry created; reveal toggle appeared after `app.render()` | PASS — nameplate masked live | YES | NONE |
| **B** GM nameplate while token masked | PASS — true name shown plain (no alias glyph) | n/a | n/a | n/a |
| **C** Reveal via HUD toggle | PASS — `revealed:true`, toggle icon/label flipped | PASS — tracker row flipped to true name **live** | YES | NONE |
| **D** Re-conceal via HUD toggle | PASS — `revealed:false` | PASS — tracker row back to alias **live** | YES | NONE |
| **E** Player nameplate, `displayName=ALWAYS` (non-owner) | n/a | PASS — alias rendered on initial draw (`drawToken` path) | YES | NONE |
| **F** Player nameplate, `displayName=HOVER` | n/a | PASS — masked alias text (core visibility semantics) | YES | NONE |
| **G** Clear alias (HUD dialog Clear / empty save) | PASS — registry entry deleted, toggle gone | PASS — nameplate and tracker restored to core name | YES | NONE |
| **H** Two tokens of same actor, independent aliases ("Pale Thing" / "Crawling Shape") | PASS — independent registry entries, independent reveal state | PASS — each plate shows its own alias | YES | NONE |
| **I** Owner leg: DXWarlock OWNER, no module HUD controls; forged `settings.set` rejected | n/a | PASS — owned token HUD has 0 module controls; server rejected forged write | n/a | NONE |
| **J** Hostile alias `<img src=x onerror=alert(1)>`; `normalizeAlias` 64-char cap | PASS — GM plate untouched | PASS — PIXI text renders payload as literal text; no alert; length cap enforced | YES | NONE |
| **K** Unmasked tokens unaffected; tracker + canvas agreement after combat creation | PASS — unmasked tokens display true name throughout | PASS — unmasked rows and plates unchanged | n/a | NONE |
| **L** Tracker idempotency: 4 alias lines stable across 4+ consecutive `render()` calls | PASS — count held at 4 (2 instances × 2 combatants); no DOM accumulation | n/a | n/a | n/a |
| **M** Player tracker shows aliases (both instances: sidebar + floating) | n/a | PASS — sidebar shows "Pale Thing" / "Crawling Shape"; no true names | n/a | NONE |
| **N** Console check: zero pf15-identity-mask errors across full session | PASS — only entry is expected localization load log | PASS — zero module errors | n/a | n/a |

All third-party deprecation warnings observed on both consoles predate this work and are
sourced from `pf1`, `pf1-statblock-converter`, `moulinette`, `forien-quest-log`, and
other installed modules. The `sbc.loadCustomCompendiums` push-on-undefined error in the
player console is also pre-existing and unrelated.

### Automation notes (this session)

- Chrome backgrounding pauses PIXI animation frames; `canvas.app.ticker.update()` was
  used to force a synchronous frame tick where needed. No impact on real focused clients.
- ninja-notes overlay present in world. Element-level `.click()` dispatch used for HUD
  controls (same listener, same code path as pointer click). Overlay confirmed to not
  intercept HUD button layer via `elementFromPoint` check.

## 12. Cleanup / world state (closeout session)

Test actor `PF15IM Test Creature`, test tokens, and test combat deleted from Staging scene.
Registry emptied `{}`. Pre-existing Round-10 encounter remains active and untouched.
Both clients at session end: Dade(GM)/Vivaldi, DXWarlock(Player)/Chrome, module at 0.2.0.

## 13. Source changes during closeout

**NONE.** No file in the repository was modified during this independent verification.
The working tree is identical to the 0.2.0 candidate reviewed in §§1-8.

## 14. Final verdict

**0.2.0 VERIFIED — READY FOR MANUAL INSPECTION**

All independent checks pass:
- Architecture and installed-source API claims: confirmed against Foundry 13.350 source (§9)
- Static validation: 16/16 categories PASS (§10)
- Runtime scenarios A-N: all PASS, two clients, live sync verified (§11)
- Source changes: NONE (§13)
- Consoles: zero pf15-identity-mask errors on both clients throughout

Michael may commit, push, tag `v0.2.0`, and issue the GitHub Release at his discretion.
Begin 0.3.0 only after that approval step.
