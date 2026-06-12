# pf15-identity-mask — Canonical Specification (v0.2.0)

Status: **ACTIVE — 0.2.0 implementation target** (0.1.0 sections retained; §14 adds 0.2.0).
Roadmap: `ROADMAP.md` (approved 2026-06-12).
Target: Foundry VTT `v13.350+` (verified against installed `13.350.0`), system `pf1` (verified against installed `11.11`).
Module ID: `pf15-identity-mask`. This Markdown document is canonical; any HTML review artifact is derivative.

---

## 1. Goal

Let a GM conceal a creature's true identity **in the combat tracker** while the real Actor and
Token names remain unchanged. Table principle: *describe wrongness first; do not name a creature
until the characters identify it.*

While a combatant is masked:

- Players see only the public alias (e.g. `Hunched Figure`) in the combat tracker.
- The GM sees the true name and the alias, visually distinct.
- The GM can reveal the truth at any time; the reveal propagates live to all clients.
- The GM can re-conceal an accidentally revealed identity.
- Combatants with no alias behave exactly as core Foundry/PF1 behaves.

### Non-goals (0.1.0)

Automatic Knowledge checks, skill-roll parsing, identification DCs, chat-card masking,
nameplate/tooltip/canvas masking, Actor-directory masking, targeting-UI masking, initiative
chat-message masking, journal integration, campaign-specific content, `baphomet-utils`
integration, lore generation, recognition databases, PF1.5 action-economy logic. These may be
listed as future possibilities only.

---

## 2. User stories

1. **GM masks an NPC.** Before or during an encounter the GM clicks the mask control on a tracker
   row, types `Hunched Figure`, saves. Players now see `Hunched Figure`; the GM sees
   `Ghoul` plus the alias marker.
2. **GM reveals.** The party identifies the creature. The GM clicks the reveal control. Every
   connected client's tracker now shows `Ghoul`. No reload needed.
3. **GM re-conceals.** The GM misclicked reveal. Clicking conceal restores the alias on every
   client.
4. **Two of a kind.** Two tokens of the same `Ghoul` actor carry different aliases
   (`Starved Corpse`, `Crawling Shape`) and independent reveal states.
5. **Player at the table.** A player never gets tracker-visible true names for masked combatants,
   and has no control that can change mask state; attempts via console are rejected by the server.

---

## 3. Confirmed API surface and evidence

All claims below were verified by direct inspection of the installed Foundry `13.350.0` client
source (`S:\FoundryVTT\resources\app\client\...`) and the installed PF1 `11.11` bundle on
2026-06-12. Labels: `SOURCE VERIFIED` = read in installed source; `RUNTIME VERIFIED` = to be
confirmed live in Phase 6.

| # | Fact | Evidence |
|---|------|----------|
| A1 | The combat tracker is `foundry.applications.sidebar.tabs.CombatTracker`, an ApplicationV2 (`HandlebarsApplicationMixin(AbstractSidebarTab)`) | SOURCE VERIFIED — `client/applications/sidebar/tabs/combat-tracker.mjs` |
| A2 | Render hook `renderCombatTracker(app, element, context, options)` fires after the rendered DOM is inserted; `element` is the app's root `HTMLElement` (not jQuery) | SOURCE VERIFIED — `client/applications/api/application.mjs` lines 510–525 (`hookArgs: [this.#element, ...]`) and `#callHooks` walking the inheritance chain |
| A3 | The tracker part re-renders from `templates/sidebar/tabs/combat/tracker.hbs`; each render produces fresh `li.combatant[data-combatant-id]` nodes | SOURCE VERIFIED — `CombatTracker.PARTS` + template file |
| A4 | The true name appears in exactly two places per row of the core template: `strong.name` text and `img.token-image[alt]` | SOURCE VERIFIED — `templates/sidebar/tabs/combat/tracker.hbs` |
| A5 | Tracker row name comes from `combatant.name`, prepared as `this.name \|\|= token?.name \|\| actor?.name \|\| "Unknown Combatant"` | SOURCE VERIFIED — `client/documents/combatant.mjs` line 159 |
| A6 | `Combatant` schema includes `tokenId` and `sceneId` foreign-document id fields | SOURCE VERIFIED — `common/documents/combatant.mjs` `defineSchema` |
| A7 | Players who own the combatant's Actor **may update combatant `flags` server-side** (`allowedKeys = ["_id","initiative","flags","defeated","system"]`) | SOURCE VERIFIED — `common/documents/combatant.mjs` `#canUpdate` |
| A8 | World `Setting` create/update/delete require `user.hasPermission("SETTINGS_MODIFY")`, enforced as document permissions (server side) | SOURCE VERIFIED — `common/documents/setting.mjs` `metadata.permissions` + `#canModify` |
| A9 | `SETTINGS_MODIFY` default role is ASSISTANT (players/trusted players do not have it by default) | SOURCE VERIFIED — `common/constants.mjs` `USER_PERMISSIONS.SETTINGS_MODIFY` |
| A10 | A world setting's registered `onChange` callback runs on **every** client when the Setting document is created/updated (document lifecycle `_onCreate`/`_onUpdate`) | SOURCE VERIFIED — `client/documents/setting.mjs` |
| A11 | `AbstractSidebarTab#render` also renders the popout instance; `renderCombatTracker` fires per instance | SOURCE VERIFIED — `client/applications/sidebar/sidebar-tab.mjs` line 113–116 |
| A12 | `foundry.applications.api.DialogV2` exists with static `prompt`, `confirm`, `input`, `wait` | SOURCE VERIFIED — `client/applications/api/dialog.mjs` |
| A13 | PF1 `11.11` does **not** replace the CombatTracker class or template; it only appends a context-menu entry via `getCombatTrackerEntryContext`/`getCombatTrackerContextOptions` | SOURCE VERIFIED — grep of `systems/pf1/pf1.js` |
| A14 | Core's combatant click handler ignores clicks on `HTMLButtonElement`, so injected row buttons do not trigger token selection | SOURCE VERIFIED — `CombatTracker#_onCombatantMouseDown` |
| A15 | `game.settings.register` accepts `scope: "world"`, `type: Object`, `default`, `onChange`; `game.settings.get/set` round-trip the object | SOURCE VERIFIED — `client/helpers/client-settings.mjs` |

### Unresolved / runtime-only questions

- **R1 (flash):** whether the true name can paint for a frame before the `renderCombatTracker`
  mutation lands. The hook is called in the same async chain after part insertion (microtask
  boundaries only, which do not normally permit paint), so a flash is *not expected*, but this is
  a `RUNTIME VERIFIED` item. If a flash is observed it will be documented honestly; no unsafe
  interception will be added.
- **R2 (PF1 row variations):** PF1 may add row content via its context hook only; runtime will
  confirm rows are core-shaped.

---

## 4. Architecture and data model

### 4.1 Storage decision — world-scope setting registry

State lives in **one world-scope setting** `pf15-identity-mask.registry` (`config: false`,
`type: Object`):

```js
{
  "<sceneId>:<tokenId>": { "alias": "Hunched Figure", "revealed": false }
}
```

- The **true name is never stored** by this module anywhere.
- Keying by `sceneId:tokenId` gives per-Token independence (same-Actor tokens differ) and
  persistence across Combatant deletion/re-add and Combat deletion/recreation (A6).
- Writes go through `game.settings.set`, which creates/updates the world `Setting` document —
  **server-rejected for non-GM users** (A8, A9). This is genuine server-authoritative
  enforcement; UI hiding is a courtesy on top of it.
- Reads are local and synchronous (`game.settings.get`) on every client.

**Rejected alternatives**

| Option | Why rejected |
|--------|--------------|
| Combatant flags | Actor-owner players can update combatant `flags` server-side (A7) — violates the "ownership must not grant mask control" requirement; also lost on combat deletion. |
| Token flags | Token updates are permitted for actor owners; same ownership-escalation problem; also requires scene-document write fan-out. |
| Actor flags | Breaks per-Token independence (two Ghoul tokens share the actor). |
| Custom socket protocol | Not needed: setting `onChange` already provides verified cross-client propagation (A10). Product rule: no custom socket without a verified unmet requirement. |

**Accepted tradeoffs**

- Registry entries for deleted tokens become inert orphans (they key to ids that no longer
  resolve). Harmless at MVP scale; a GM purge tool is a deferred feature. Clearing an alias
  deletes its entry.
- Assistant GMs (who hold `SETTINGS_MODIFY` by default) can modify mask state. This matches
  Foundry's own notion of "GM-level" authority and is documented.
- One shared registry document means concurrent GM writes last-write-wins at the whole-registry
  level. Single-GM table; acceptable and documented.

### 4.2 Masking layer — render-hook DOM mutation

On `renderCombatTracker(app, element)`:

1. Iterate `element.querySelectorAll("li.combatant[data-combatant-id]")`.
2. Resolve the Combatant from `app.viewed` (defensive: skip if no viewed combat or stale id).
3. Derive the registry key from `combatant.sceneId` + `combatant.tokenId`; skip when either is
   missing (Combatant without Token degrades to core behavior; mask controls unavailable).
4. If an entry exists and `revealed === false`:
   - **Player view:** set `strong.name.textContent = alias`; set `img.token-image.alt = alias`.
   - **GM view:** keep the true name in `strong.name`, append a module-owned alias line
     (`div.pf15im-alias`) showing mask state + alias, built with `createElement`/`textContent`.
5. If an entry exists and `revealed === true`:
   - Player view: untouched (true name shows).
   - GM view: alias line renders in "revealed" state so the GM can re-conceal.
6. GM only: inject two `button.inline-control.combatant-control.icon` controls into
   `.combatant-controls` — **edit mask** (opens the alias editor) and **reveal/conceal toggle**
   (only when an alias exists). Buttons carry `pf15im-*` classes and `data-pf15im-action`
   attributes; they are created fresh each render (A3) so listeners never accumulate (A14 keeps
   row activation from firing on button clicks).

Idempotency: every render rebuilds the tracker part DOM from the template (A3), so the hook
mutates only fresh nodes. The hook itself never reads module DOM it previously wrote.

### 4.3 Synchronization

`game.settings.register(..., { onChange: () => ui.combat?.render() })` — runs on every client on
every registry change (A10); `ui.combat.render()` re-renders the popout too (A11). Combat/combatant
lifecycle changes re-render the tracker through core behavior unchanged.

### 4.4 Alias editor

`foundry.applications.api.DialogV2.wait()` (A12) with static, fully-localized HTML content. The
current alias is inserted via `input.value = alias` inside the dialog `render` callback — **alias
text is never interpolated into an HTML string**. Buttons: Save, Clear (only when an alias
exists), Cancel. Save normalizes and persists; Clear deletes the registry entry.

### 4.5 Alias normalization (untrusted input)

- `String(value)`, strip ASCII control characters (U+0000–U+001F, U+007F), collapse internal
  whitespace runs to single spaces, trim.
- Maximum length **64 characters** (hard truncation after normalization).
- Empty after normalization ⇒ treated as Clear.
- Rendered exclusively through `textContent`/`alt` property assignment — no `innerHTML`, no
  `insertAdjacentHTML`, no attribute string concatenation. `<img src=x onerror=alert(1)>` is
  therefore inert text in the tracker and in the editor input.

### 4.6 Module file map

```text
pf15-identity-mask/
├── module.json                  esmodules, styles, languages, compatibility
├── README.md                    usage + presentation-layer disclaimer
├── scripts/
│   ├── main.mjs                 entrypoint: setting registration, hook wiring
│   ├── const.mjs                MODULE_ID, setting key, limits, CSS class names
│   ├── state.mjs                registry read/normalize/write API + permission guard
│   ├── tracker.mjs              renderCombatTracker masking + GM control injection
│   └── editor.mjs               DialogV2 alias editor
├── styles/
│   └── identity-mask.css        Croaker's Ledger, scoped to .pf15im-* selectors
├── lang/
│   └── en.json                  all user-facing strings
└── docs/
    ├── specs/identity-mask/identity-mask.spec.md      (this file)
    └── reviews/identity-mask/...                      plan/verify artifacts
```

---

## 5. Visibility matrix

| Surface | Masked, GM | Masked, Player | Revealed, GM | Revealed, Player | No alias (any) |
|---|---|---|---|---|---|
| Tracker `strong.name` | true name | **alias** | true name | true name | true name |
| Tracker `img[alt]` | true name | **alias** | true name | true name | true name |
| Module alias line | alias + state marker | absent | alias + "revealed" marker | absent | absent |
| Mask edit / reveal controls | visible | absent | visible | absent | edit only |
| Token nameplate, chat, actor directory, canvas | unchanged — **out of scope** | unchanged | unchanged | unchanged | unchanged |

---

## 6. Lifecycles

| Event | Behavior |
|---|---|
| Set alias | Registry entry created `{alias, revealed:false}`; all clients re-render. |
| Edit alias | Entry alias replaced; reveal state preserved. |
| Clear alias | Entry deleted; core naming returns everywhere. |
| Reveal | `revealed = true`; players see true name; entry retained. |
| Re-conceal | `revealed = false`; players see alias again. |
| Combatant deleted → re-added (same token) | Same `sceneId:tokenId` key ⇒ mask state **persists**. Intentional. |
| Combat deleted → recreated | Same ⇒ mask state **persists**. Intentional. |
| Token deleted | Entry orphaned (inert); deferred purge tool. |
| Combatant with no token/scene | Never masked; no module controls; core behavior. |
| GM/Player refresh or reconnect | Registry is a world setting — present after every load; masking reapplied on first tracker render. |
| No active combat | Hook finds no rows; no-op. |

---

## 7. Permissions

| Action | Who | Enforcement |
|---|---|---|
| Read registry (alias + revealed) | all clients | World settings replicate to all clients. Contains no true names. |
| Set / edit / clear alias | GM (incl. Assistant) | **Server**: Setting `#canModify` ⇒ `SETTINGS_MODIFY` (A8/A9). UI controls additionally GM-gated. |
| Reveal / re-conceal | GM (incl. Assistant) | Same path — both are registry writes. |
| Player with Actor ownership | no mask authority | Ownership affects Actor/Combatant docs only; the registry is not reachable through them (A7 deliberately bypassed). |

Module code also guards every write API with `game.user.isGM` to fail fast with a localized
warning before the server would reject it.

---

## 8. Threat model and presentation-layer disclaimer

**This is presentation-layer identity masking.** Foundry replicates the full Combatant, Token,
and (visible) Actor documents to player clients; the true name is therefore present in player
client memory (`game.combat.combatants.contents[n].name`, token document, etc.) regardless of
what the tracker shows. A technically knowledgeable player can read it from the console. This
module:

- masks the ordinary player-facing tracker surface (the one players actually look at);
- **adds zero additional true-name exposure** (no true name in the registry setting, module DOM,
  data attributes, tooltips, ARIA, comments, or logs);
- does not and cannot provide adversarial secrecy — that would require server-side redaction,
  which Foundry does not offer to modules.

This limitation is stated in the README. Runtime Phase 6 includes a player-console inspection to
document exactly which core surfaces still carry the true name.

---

## 9. Accessibility

- Alias/state markers use text + icon shape, never color alone.
- Injected buttons are real `<button type="button">` with localized `aria-label` and
  `data-tooltip`; keyboard-focusable like core's own row controls, with a visible focus outline.
- Image `alt` follows the displayed name (alias when masked) for consistent screen-reader output.
- Contrast: iron-gall ink (#2a231d) on parchment (#d1c6b4) ≈ 9.8:1; faded ink (#5e5246) on
  parchment ≈ 5.4:1 — both pass WCAG AA for their text sizes.

---

## 10. Croaker's Ledger styling

Scope root: every module-created node carries a `pf15im-` class; stylesheet selectors all begin
with `.pf15im-` (no bare element/core-class selectors) ⇒ no bleed into core or other modules.
Palette/typography per the Ledger rules (muddy/aged parchment `#d1c6b4`/`#beb09b`, leather
`#8a7b66`, iron-gall `#2a231d`, faded `#5e5246`, brass `#9e7d43`, dried blood `#6e2a22`; Courier
Prime headers, Alegreya body, IBM Plex Mono state values — all with system fallbacks, **no
bundled or remote fonts**, matching sibling-module convention). Utilitarian: compact row
controls, no glow/neon/gradients. `!important` only if a core specificity conflict is proven and
commented.

---

## 11. Acceptance criteria

The scenarios A–L from the assignment (basic mask, reveal, re-conceal, same-actor independence,
no-alias passthrough, player permission rejection, refresh/lifecycle, hostile alias text, player
DOM leakage, two-combatant sync, clear alias, combatant-without-actor) are the acceptance
gate, each verified GM-side (Vivaldi) and Player-side (Chrome) with consoles inspected. The
verification report records per-scenario: GM result, Player result, GM console, Player console,
synchronization, module-created leak check.

---

## 12. Deferred features

Pre-combat token-level alias editor (Token HUD/config), registry purge tool for orphaned keys,
chat-card and nameplate masking, automatic Knowledge-check reveal, alias suggestion tables,
per-player reveal, localization beyond `en`.

## 13. Migration concerns

Registry schema carries no version field at 0.1.0; the first shape change (planned 0.4.0) moves
to a registry-level container `{_v: 2, entries: {...}}` with a one-time GM-client migration on
`ready` (see ROADMAP.md). 0.2.0/0.3.0 must not change the schema. Keys are stable Foundry ids;
no migration is needed for combat lifecycle events by design.

---

## 14. v0.2.0 — Token HUD controls + canvas nameplate masking

### 14.1 Goal / non-goals

Masking stops being tracker-only: the GM can set/edit/clear/reveal from the Token HUD with no
combat anywhere, and players stop seeing true names on canvas nameplates. Non-goals (0.2.0):
token tooltips (elevation only in core — verified not a name surface), hover overlays from
other modules, chat (0.3.0), token-config tab (rejected — HUD is faster mid-session).

### 14.2 Additional confirmed API surface (installed 13.350.0, 2026-06-12)

| # | Fact | Evidence |
|---|------|----------|
| B1 | `TokenHUD extends HandlebarsApplicationMixin(BasePlaceableHUD)`; `BasePlaceableHUD extends ApplicationV2` — TokenHUD **is AppV2** in this install. Project references describing a V1/jQuery TokenHUD are outdated here; installed source controls. | SOURCE VERIFIED — `client/applications/hud/token-hud.mjs:17`, `client/applications/hud/placeable-hud.mjs:15` |
| B2 | PF1 11.11 sets `CONFIG.Token.hudClass = TokenHUDPF extends TokenHUD`, overriding only `_getStatusEffectChoices`. AppV2 render hooks fire per inheritance chain ⇒ `renderTokenHUD(app, element:HTMLElement, context, options)` fires for TokenHUDPF. | SOURCE VERIFIED — pf1.js + `application.mjs #callHooks` |
| B3 | HUD template has `.col.left` / `.col.right` columns of `button.control-icon`; `app.document` is the TokenDocument (`document.parent.id` = sceneId). | SOURCE VERIFIED — `templates/hud/token-hud.hbs`, `placeable-hud.mjs` |
| B4 | `token.nameplate` is a documented public property (PreciseText). Core sets `nameplate.text = document.name` in `_refreshNameplate()` whenever the `refreshNameplate` render flag applies; the flag propagates from `refresh`/`refreshSize` and from document `name`/`displayName` changes. | SOURCE VERIFIED — `canvas/placeables/token.mjs:152-155, 1407-1410, 69-93, 3612` |
| B5 | Public hook `refreshToken(token, flags)` fires immediately AFTER `_applyRenderFlags`, so overwriting `token.nameplate.text` in the hook directly supersedes core's assignment, using the same public property core writes. | SOURCE VERIFIED — `canvas/placeables/placeable-object.mjs:368` |
| B6 | Public hook `drawToken(token)` fires after `_draw()` creates the nameplate but **while the placeable is still `visible=false, renderable=false`** — masking here prevents any first-paint true-name flash. | SOURCE VERIFIED — `placeable-object.mjs:421-436` |
| B7 | `token.renderFlags.set({refreshNameplate: true})` is the public, core-canonical way to request a nameplate refresh (documented property + `RenderFlags#set(changes)`). | SOURCE VERIFIED — `canvas/interaction/render-flags.mjs:94-100, 152-188` |
| B8 | Nameplate **visibility** is display-mode driven (`nameplate.visible = !isSecret && _canViewMode(document.displayName)`) and independent of text. The module changes text only ⇒ display-mode semantics preserved automatically. | SOURCE VERIFIED — `token.mjs:1263` |
| B9 | `TokenPF extends Token` with no `_refreshNameplate`/`_getTooltipText` overrides; core token tooltip shows elevation, not name. | SOURCE VERIFIED — pf1.js, `token.mjs:1396-1399` |

No unresolved APIs; no internal/underscore paths required. Stop-condition not triggered.

### 14.3 Design

**Shared resolver (groundwork).** State API generalizes from combatant-shaped to ref-shaped:
any object with `{sceneId, tokenId}` resolves a mask. Combatants already have those properties;
TokenDocuments get a tiny adapter (`refForTokenDocument(doc)` → `{sceneId: doc.parent?.id,
tokenId: doc.id}`). Tracker code is unchanged in behavior.

**HUD controls (GM only).** On `renderTokenHUD`: append to `.col.left` a mask button
(`button.control-icon`, fa-mask) opening the existing DialogV2 editor via the token ref, plus a
reveal/conceal toggle (fa-masks-theater / fa-eye) when an entry exists. Fresh part DOM per
render ⇒ idempotent; listeners use stopPropagation; after a toggle write resolves, the captured
`app.render()` refreshes the HUD (public AppV2 method). Non-GM clients get no HUD additions.

**Canvas masking (player clients).** Two hooks, one function:
- `drawToken(token)` → mask immediately after plate creation (pre-first-paint, B6);
- `refreshToken(token, flags)` → when `flags.refreshNameplate`, re-apply after core resets the
  text (B5).
Masking = `token.nameplate.text = alias` when an unrevealed entry exists and user is not GM.
Unmasked/revealed tokens are never touched (core text already correct). GM canvas plates show
the **plain true name — no glyph** (decided in roadmap review).

**Sync.** Registry `onChange` additionally requests `renderFlags.set({refreshNameplate: true})`
for all placeable tokens on the viewed canvas (cheap text-only refresh; tokens on other scenes
funnel through `drawToken` when their scene renders). Combat-tracker re-render unchanged.

### 14.4 Visibility matrix additions

| Surface | Masked, GM | Masked, Player | Revealed, Player | No alias |
|---|---|---|---|---|
| Canvas nameplate text | true name (plain) | **alias** | true name | true name |
| Nameplate visibility / display modes | core | core | core | core |
| Token HUD mask/reveal controls | visible | absent | visible | edit only |
| Token tooltip (elevation) | core — not a name surface | core | core | core |

### 14.5 Acceptance criteria (0.2.0)

1. HUD set/edit/clear/reveal round-trip on a token with **no combat in the world**.
2. Player nameplate shows alias across the display-mode × ownership matrix (NONE/HOVER/ALWAYS
   × owner/non-owner — explicit runtime grid).
3. Reveal/conceal propagates to player canvas live; tracker and canvas always agree.
4. Hostile alias inert on the nameplate (PIXI text node — no DOM, but verify literal rendering).
5. No TokenDocument/Actor mutation; registry shape unchanged (v1 flat map).
6. Unmasked tokens behave identically to core (text, visibility, modes).
7. No first-paint true-name flash on masked tokens (drawToken pre-masking); observed honestly.
8. Combatant-less masking: a token never added to combat still masks on canvas.
9. All 0.1.0 scenarios remain green (regression sweep: A, B, C, D, F, K minimum).
