# pf15-identity-mask 0.1.0 — Verification Report

Date: 2026-06-12
Environment: Foundry VTT **13.350** (local server `http://192.168.56.1:30001`, data `V:\FoundryVTTData`), system **pf1 11.11**, world **Echoes Dev Sandbox** (`baphomets-fall-dev`, disposable dev world, 68 modules incl. baphomet-utils active).
Clients: **Vivaldi = GM** (user `Dade`, role GAMEMASTER) · **Google Chrome = Player** (user `DXWarlock`, role TRUSTED). GM identity was re-verified after every reload.

## 1. What was built

Combat-tracker identity masking, presentation-layer, GM-only control: per-token public aliases
with reveal/re-conceal, persisted in a world-scope setting registry, synchronized via the
setting `onChange` lifecycle, rendered by `renderCombatTracker` DOM mutation, styled in
Croaker's Ledger. Canonical spec: `docs/specs/identity-mask/identity-mask.spec.md`.

## 2. Architecture (as verified)

- **Storage**: world setting `pf15-identity-mask.registry` = `{"<sceneId>:<tokenId>": {alias, revealed}}`. True names never stored.
- **Why**: only server-authoritative GM-only store. RUNTIME CONFIRMED: player write attempt
  rejected by server. Combatant flags rejected at design time (owner players may update
  combatant `flags` server-side — SOURCE VERIFIED `common/documents/combatant.mjs #canUpdate`).
- **Sync**: setting `onChange` → `ui.combat.render()` on every client. RUNTIME CONFIRMED live
  on both clients with no refresh. No custom socket.
- **Masking**: post-render mutation of fresh per-render nodes via `textContent`/`alt` only.
- **Files**: `module.json`, `README.md`, `lang/en.json`, `scripts/{main,const,state,tracker,editor}.mjs`, `styles/identity-mask.css`, `docs/specs/...`, `docs/reviews/...`.

## 3. Static validation (Phase 5 — all PASS)

| Check | Command / method | Result |
|---|---|---|
| JS syntax | `node --check` × 5 scripts | PASS |
| module.json / en.json valid JSON | `ConvertFrom-Json` | PASS |
| Manifest paths exist + exact casing | resolve + case-compare | PASS |
| `esmodules` (no legacy `scripts` key) | manifest inspection | PASS |
| Relative imports resolve | regex scan + path test | PASS (8/8) |
| i18n keys used ⊆ en.json | scan + key resolution | PASS (16/16) |
| Forbidden patterns (innerHTML, insertAdjacentHTML, eval, Function ctor, alert, console.log, prototype patching, jQuery, fetch/XHR, remote imports) | grep | 0 hits |
| CSS scoping (.pf15im-* only), no @import/url()/!important | grep + selector parse | PASS |
| Underscore-prefixed external API calls | grep `\._[a-zA-Z]` | 0 hits |
| Console output | only 2 × `console.error` on genuine failure paths | acceptable |

Limitation: baphomet-utils' `tools/validate.mjs` is bound to that repository's GOAL/baseline
structure and was not applicable to this module.

## 4. Runtime scenarios (Phase 6)

Legend: GM = Vivaldi observation; PL = Chrome observation; SYNC = cross-client propagation
observed without manual refresh; LEAK = module-created player true-name leak.

| # | Scenario | GM | Player | GM console | Player console | Sync | Leak |
|---|---|---|---|---|---|---|---|
| A | Basic mask (`Hunched Figure` via row button + editor dialog) | PASS — true name + MASKED tag + alias line + reveal control | PASS — alias only in name and img alt | NONE | NONE | YES | NONE |
| B | Reveal | PASS — REVEALED state, toggle relabels to Conceal | PASS — true name appeared live, no refresh | NONE | NONE | YES | NONE |
| C | Re-conceal | PASS — registry `revealed:false`, MASKED state restored | PASS — alias display restored (verified via subsequent masked-row read) | NONE | NONE | YES | NONE |
| D | Same Actor, two tokens (`Starved Corpse` / `Crawling Shape`) | PASS — independent entries and states | PASS — independent aliases | NONE | NONE | YES | NONE |
| E | No alias | PASS — core row untouched (pre-alias rows, post-clear row) | PASS — core behavior | NONE | NONE | n/a | NONE |
| F | Player permissions | n/a | PASS — zero module controls rendered; `game.settings.set` rejected by SERVER: "User DXWarlock lacks permission to update Setting"; registry unchanged | NONE | NONE (rejection is the expected throw) | n/a | NONE |
| G | Lifecycle: GM refresh / player refresh / player reconnect (re-login) / tracker rerenders / combatant delete+re-add / combat delete+recreate | PASS — masks reapplied in every case; registry intact (keyed to scene:token) | PASS — masks reapplied after player reload | NONE | NONE | YES | NONE |
| H | Hostile alias `<img src=x onerror=alert(1)>` + whitespace (`"   Starved    Corpse   "` → `"Starved Corpse"`) | PASS — stored & rendered as inert literal text (alias line children: I/SPAN/SPAN, no IMG, no alert) | PASS — name node textContent only, 0 child elements, no injected img, no alert | NONE | NONE | YES | NONE |
| I | Player DOM leakage | n/a | PASS — masked row `outerHTML` contains no true name (name, alt, tooltips, ARIA, data attrs, comments all clean) | NONE | NONE | n/a | NONE |
| J | Two-combatant sync (reveal one) | PASS — only target changed | PASS — other row stayed masked | NONE | NONE | YES | NONE |
| K | Clear alias (dialog Clear button) | PASS — registry entry deleted, alias line + toggle removed, core name back | PASS — true name restored live | NONE | NONE | YES | NONE |
| L | Combatant without Actor/Token (`PF15IM NoActor`) | PASS — no module controls, row untouched, no errors | PASS — core behavior | NONE | NONE | n/a | NONE |

Quote-character sub-case of H (apostrophes/quotes/ampersands): not separately typed; covered
by mechanism — the identical `textContent`/`value`-property path proven inert against the
strictly harder angle-bracket payload. Long input: browser-side `maxlength="64"` plus module
cap (`normalizeAlias`) — UI-enforced truncation observed in the dialog.

Popout tracker: RUNTIME CONFIRMED decorated identically to the sidebar (same hook fires per
instance).

## 5. Security findings

1. **Server-authoritative GM-only writes confirmed at runtime.** The player's forged
   `game.settings.set` was rejected by the Foundry server itself (document permission
   `SETTINGS_MODIFY`), not merely hidden by UI.
2. **Presentation-layer classification confirmed at runtime.** From the player console, true
   names remain readable on core replicated documents: `game.combat.combatants.map(c => c.name)`
   → `["Ghoul","Ghoul",...]`; token documents likewise; canvas nameplates are out of scope. The
   module is table-facing concealment, not adversarial secrecy — stated in README and spec.
3. **Zero module-created exposure.** The registry (replicated to players) holds only
   `{alias, revealed}`. Masked-row DOM contains no true name anywhere.
4. **Flash risk (spec R1)**: no true-name flash was visually observed during any render,
   reveal, conceal, or reload, consistent with the microtask-chain analysis (hook fires before
   paint). Not instrument-measured; honest status: NOT INSTRUMENT-VERIFIED, no observation of
   a flash in practice.

## 6. Console summary

- GM console (Vivaldi): zero module messages besides localization loads; zero errors all session.
- Player console (Chrome): identical — localization loads only.
- The many v13 deprecation warnings present belong to the PF1 system and unrelated modules.

## 7. Deviations / notes

- A junction `V:\FoundryVTTData\Data\modules\pf15-identity-mask` → repo was created (mirrors
  the established baphomet-utils convention) to make the module discoverable.
- Module discovery required a return-to-setup + world relaunch (performed; the other connected
  user was disconnected and rejoined — acceptable in the dev sandbox).
- The module was left **enabled** in the dev world for Michael's inspection.
- All disposable test state was removed: test actor, both tokens, both test combats, registry
  emptied; the pre-existing Round-10 encounter was reactivated and never modified.
- HTML plan artifact (Phase 3) intentionally skipped — the canonical spec already carried the
  full architecture; creating it would only have delayed implementation.

## 8. Known limitations (also in README)

Presentation-layer only; aliases set from tracker rows (combat must exist); orphaned registry
entries linger after token deletion (purge tool deferred); Assistant GMs share mask authority;
English only.

## 9. Remaining manual tests (optional)

- ~~A second human player seat with actor OWNERSHIP of a masked token~~ — **COMPLETED: §11 below.**
- Long-session soak with many registry entries (perf was instant at 2 entries).

## 10. Recommended next milestone

`0.2.0`: token-config/Token-HUD alias editing (pre-combat masking), registry purge tool for
orphaned keys, and a GM "mask all NPCs in combat" convenience action. Knowledge-check
integration remains out of scope until the table rules for identification DCs are settled.

---

## 11. Closeout pass — 2026-06-12 (Sonnet-in-Code)

Performed: architecture review against spec, static re-check, junction verification, actor-owner
permission test (the remaining §9 optional item), and a representative regression covering the
four key behaviors. Two-client session: Chrome tab 1 = DXWarlock (isGM:false, TRUSTED); Chrome
tab 2 = Dade (isGM:true, GAMEMASTER).

### 11.1 Architecture review

All eight reviewed dimensions confirmed matching spec:

| Dimension | Code location | Result |
|---|---|---|
| World-scope registry keyed `sceneId:tokenId` | `state.mjs` `getMaskKey`, `registerSettings` | CONFIRMED |
| Server-authoritative GM-only writes | `state.mjs` `updateRegistry` — `isGM` fast-fail + `game.settings.set` | CONFIRMED |
| Per-token independence (shared Actor) | `getMaskKey` uses `combatant.sceneId + combatant.tokenId`, not `actorId` | CONFIRMED |
| Safe text handling — no innerHTML path | `maskPlayerRow` `textContent`/`alt`; `decorateGmRow` `createElement`/`textContent`; `editor.mjs` `input.value = currentAlias` (property, not interpolation); `insertAdjacentElement` inserts a pre-built `HTMLElement` (safe) | CONFIRMED |
| Idempotent rendering | `onRenderCombatTracker` queries fresh DOM each invocation; creates new elements each call; no accumulated state | CONFIRMED |
| Setting-change sync (sidebar + popout) | `onChange: () => ui.combat?.render()` — both instances confirmed (8 rows = 4 combatants × sidebar + popout) | CONFIRMED |
| Cleanup and stale-registry | `clearAlias` deletes key; `setAlias("")` routes to `clearAlias`; `getMaskEntry` returns null for stale/missing keys | CONFIRMED |
| Presentation-layer documentation | README §Security and spec §8 fully and honestly state the limitation | CONFIRMED |

One CSS note: `.pf15im-editor .window-content`, `.pf15im-editor .form-footer button` etc. are
compound selectors rooted at `.pf15im-editor` — all 16 CSS selectors are `.pf15im-*`-rooted per
spec §10. The one non-standard hex `#8a3a2e` (dried-blood brightened for dark-sidebar legibility)
is documented in a CSS comment per the no-arbitrary-hex rule. No defects found.

### 11.2 Static re-check (all PASS)

| Check | Result |
|---|---|
| JS syntax `node --check` × 5 | PASS |
| module.json + en.json JSON valid | PASS |
| Forbidden patterns (innerHTML, insertAdjacentHTML, eval, Function ctor, alert, console.log, prototype patching, jQuery, fetch/XHR, remote imports) | 0 hits |
| CSS scoping: all 16 selectors `.pf15im-*`-rooted | PASS |
| CSS @import / url() / !important | 0 hits |
| Underscore-prefixed external calls | 0 hits |
| Manifest paths (esmodules, styles, languages) | PASS (3/3) |
| i18n keys used ⊆ en.json | PASS (16/16) |
| Relative imports resolve | PASS (8/8) |

Source changes during closeout: **NONE**.

### 11.3 Junction verification

| Property | Value |
|---|---|
| Path | `V:\FoundryVTTData\Data\modules\pf15-identity-mask` |
| Exists | True |
| Attributes | `Directory, ReparsePoint` |
| LinkType | Junction |
| Target | `S:\Campaign Material\Modules\pf15-identity-mask` |
| Resolves to source | True (module.json byte-length 829 matches source 829) |
| Independent copied tree | No — single junction to working repo |

The junction is the intentional local-development linkage mirroring the baphomet-utils convention.
It was not removed or recreated; it is confirmed valid and points to the correct source path.

### 11.4 Actor-owner permission test (new — closes §9 optional item)

Setup (GM): created disposable Actor "PF15IM OwnerTest" (`id: hGpXCOmb8oeUcaWP`) with DXWarlock
ownership level **3 (OWNER)**; added its token to the active scene; added a Combatant to the
active combat; masked with alias "Shambling Shape" via module state API. Registry before player
attempts: `{"5WCQM12c4ePSXOko:sBhOETN7dHHA8MYI": {alias:"Shambling Shape", revealed:false}}`.

Player preconditions confirmed: `isGM:false`, `canModifySettings:false`, module exposes no
`game.modules.get("pf15-identity-mask")?.api` (returns `undefined`).

| Vector | Attempt | Server / module response | Registry changed? |
|---|---|---|---|
| 1 — direct `game.settings.set` | `game.settings.set("pf15-identity-mask","registry",{...forgery...})` | **SERVER REJECTED**: "User DXWarlock lacks permission to update Setting [0l6IHurVSX9ussoO]" | No |
| 2a — module state API `setAlias` | `import(".../state.mjs")` → `setAlias(combatant,"PLAYER FORCED ALIAS")` | `isGM` guard in `updateRegistry` → `return false` (client-side, before server) | No |
| 2b — module state API `setRevealed` | same import → `setRevealed(combatant, true)` | `isGM` guard → `return false` | No |
| 2c — module state API `clearAlias` | same import → `clearAlias(combatant)` | `isGM` guard → `return false` | No |

Registry confirmed unchanged on both GM and player clients immediately after all attempts:
`{alias:"Shambling Shape", revealed:false}`. Player tracker row showed "Shambling Shape" (alias)
with zero module controls, matching the pre-attempt state. GM tracker showed "PF15IM OwnerTest"
(true name) + MASKED state + 2 module buttons.

Post-reload (player hard-reload to `/game`, re-logged in as DXWarlock): registry still
`{alias:"Shambling Shape", revealed:false}`. No unauthorized state persisted. Actor ownership
**does not grant mask authority** — confirmed at both the module layer (isGM guard) and the
server layer (SETTINGS_MODIFY permission check).

Cleanup: combatant deleted, token deleted, actor deleted, registry cleared to `{}`. No test
state remains.

### 11.5 Representative regression

Run with a clean registry. Test combatants: existing Pants, Oswald, Boots, Reginald (pre-existing,
unmasked); disposable "PF15IM OwnerTest" actor (owner-test setup, then cleaned up mid-session).

| Check | GM (Dade) | Player (DXWarlock) | Sync | Leak |
|---|---|---|---|---|
| Basic mask ("Shambling Shape") | true name in row, MASKED state, alias line, 2 controls | alias in `strong.name` + `img[alt]`, no controls, no alias line | YES — `onChange` re-render | NONE |
| No-alias core (Pants/Oswald/Boots/Reginald) | 8 rows (sidebar+popout) with module edit controls but no alias line (no entry) | 8 rows, no module controls, no alias line | n/a | NONE |
| Hostile alias `<img src=x onerror=alert(1)>` | `aliasTextContent` = hostile string as literal text; `aliasChildElements=0`; `noImgTag=true`; `noAlert=true` | hostile string in `strong.name` textNode + `img[alt]` attribute — confirmed as text nodes/attributes, NOT HTML elements; `trackerNameDirect` = literal `<img src=x onerror=alert(1)>`; `noImgInjected=true`; zero `<script>` tag hits | YES | NONE |
| Reveal sync | GM `setRevealed(true)` → entry `revealed:true` | player tracker showed true name "PF15IM OwnerTest" live; `syncConfirmed:true` | YES | NONE |
| Re-conceal sync | GM `setRevealed(false)` → entry `revealed:false`; hostile alias back in MASKED state | player tracker showed hostile alias as inert literal text; `hostileAliasInPlayerDOM` true only via `innerHTML` text-node serialization — not an HTML injection (see note below) | YES | NONE |
| Popout tracker | 8 rows = 4 combatants × sidebar + popout; both decorated identically | 8 rows; identical alias display in both | YES | NONE |
| Both consoles | zero module errors throughout | zero module errors throughout | — | — |

**Note on `hostileAliasInPlayerDOM` flag:** the initial check used
`document.body.innerHTML.includes("onerror")`. That returned `true` because `innerHTML`
serializes text nodes as HTML strings — the literal text `<img src=x onerror=alert(1)>` inside
a `<strong>` textNode makes the substring appear in the serialization. A targeted DOM walk
confirmed the hits were `STRONG.name` (textNode) and `IMG[alt]` attribute — exactly the two
surfaces the module writes via `textContent` and `.alt`. Zero `<script>` tag hits. Zero HTML
element injection. The hostile string is inert in both rendering surfaces, consistent with spec
§4.5.

Final clean-state check: registry `{}`, 8 rows (sidebar + popout × 4 unmasked combatants),
`rowsWithModuleControls=8` on GM side (edit button present on all token combatants; no reveal
toggle when no alias exists — correct), `rowsWithModuleControls=0` on player side, no alias
lines, no hostile text in any row.

### 11.6 Release-readiness verdict

**`0.1.0 VERIFIED — READY FOR MANUAL INSPECTION`**

All eight architecture dimensions confirmed. All static checks pass (0 failures). Junction
confirmed valid. Actor-owner permission test PASS (server rejects player writes regardless of
actor ownership; module isGM guard provides additional client-side fail-fast). Representative
regression PASS across all covered behaviors. Both consoles clean throughout. No source files
were changed during this closeout pass.
