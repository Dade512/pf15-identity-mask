# pf15-identity-mask 0.3.0 — Verification Report

Date: 2026-06-12
Environment: Foundry VTT **13.350**, system **pf1 11.11**, world **Echoes Dev Sandbox**
(`baphomets-fall-dev`), full module load. Clients: **Vivaldi = GM** (`Dade`, GAMEMASTER) ·
**Chrome = Player** (`DXWarlock`, TRUSTED). GM identity re-verified after every reload.
Spec: `docs/specs/identity-mask/identity-mask.spec.md` §15. Census:
`docs/reviews/identity-mask/2026-06-12-identity-mask-0.3.0-census.md` (scope gate).
Roadmap: `ROADMAP.md` (approved 2026-06-12).

**Evidence sources.** This document is an independent closeout written 2026-06-12 by a
subsequent session (Sonnet). Primary runtime evidence is the Fable verification session
(same date) plus Michael's manual in-play confirmation. Section §9 (Sonnet independent
re-verification) adds a second live smoke test on the 0.3.1 candidate, whose behavior
for all 0.3.0 acceptance criteria is identical to the 0.3.0 code (the 0.3.1 delta is
hygiene only — see §3).

---

## 1. What 0.3.0 adds

- **Chat sender masking:** hook `renderChatMessageHTML(message, html)` (non-GM clients
  only) — when `{sceneId: message.speaker?.scene, tokenId: message.speaker?.token}`
  resolves to a masked, unrevealed registry entry, every `.message-sender` element
  inside the rendered `html` has its `textContent` replaced with the alias. GM display
  is untouched. ChatMessage documents are never edited.
- **Retroactive chat sync:** registry `onChange` calls `ui.chat?.render()` so that
  already-posted messages re-mask or unmask live on reveal/conceal — no reload needed.
  The popout follows (AbstractSidebarTab pattern; confirmed same as tracker sync).
- **Scope frozen by census:** the only confirmed player-facing leak beyond 0.2.0 was the
  `.message-sender` element of token-speaker messages, PF1 initiative cards, and PF1 skill
  cards. Census key finding: PF1 fills `speaker.token`/`speaker.scene` on all three card
  types, so the existing `{sceneId, tokenId}` registry key covers every in-scope leak.
- **Fail-open surfaces (documented, out of scope):** message content/flavor, PF1 card inner
  target lines, third-party module name surfaces (monks/chat-portrait/smarttarget/
  koboldworks), actor-only speakers with no token id, GM-side dialog titles.

---

## 2. Recon outcome — API surface verified

| Claim | Basis |
|---|---|
| `renderChatMessageHTML(message, html)` — v13 replacement of `renderChatMessage`; `html` is `HTMLElement` | SOURCE VERIFIED: `chat-message.mjs:378/419` (0.1.0 recon, confirmed during implementation) |
| `message.speaker?.scene` / `message.speaker?.token` populated by PF1 for token-speaker messages, initiative cards, and skill cards | RUNTIME VERIFIED: census session, inspected speaker payload of each card type from the player console |
| `ui.chat?.render()` re-renders posted messages and the popout (AbstractSidebarTab) | RUNTIME VERIFIED: census session; same pattern as `ui.combat?.render()` used since 0.1.0 |
| `.message-sender` is the player-visible sender element in the rendered chat message | SOURCE VERIFIED: core Foundry chat message template; confirmed by census session DOM inspection |
| Registry key `"<sceneId>:<tokenId>"` covers both token-speaker and actor-alias-speaker PF1 cards | RUNTIME VERIFIED: census session (skill card speaker carried `token` + `scene` ids); see census §Key finding |

---

## 3. Static validation

Static validation was run against the 0.3.1 candidate (working tree at time of closeout).
**Delta from 0.3.0:** (a) `state.mjs` onChange split into three isolated try/catch-guarded
helpers; (b) `chat.mjs` sender replacement changed from `textContent = alias` to a
text-node walk (`replaceTextNodes`). Neither change alters any behavior tested by the
0.3.0 acceptance criteria; both are defensive improvements to already-passing behavior.

| Category | Result |
|---|---|
| `node --check` syntax (8 files) | PASS — 8/8 |
| `module.json` valid JSON, required fields | PASS |
| `lang/en.json` valid JSON | PASS |
| 16 ESM import paths resolve on disk | PASS — 16/16 |
| 16 i18n keys defined and used (0 unused, 0 missing) | PASS — 16/16 |
| `innerHTML` / `insertAdjacentHTML` absent | PASS |
| `eval` / `Function(` absent | PASS |
| `alert` / `console.log` absent | PASS |
| `prototype` mutation absent | PASS |
| jQuery (`$(` / `jQuery(`) absent | PASS |
| `fetch` / remote network calls absent | PASS |
| Underscore-API calls absent | PASS |
| All CSS selectors `.pf15im-` scoped | PASS |
| No `!important` in CSS | PASS |
| No direct `TokenDocument`/`Actor`/`Token` `.update()` calls for name mutation | PASS |
| `chat.mjs` aliases via `textContent` only (no DOM interpolation) | PASS |

---

## 4. Runtime scenarios — primary evidence (Fable session + Michael manual)

Environment as header; scenarios run 2026-06-12 by Fable session with two-client live verification.

| Scenario | GM (Vivaldi) | Player (Chrome) | Sync | Leak |
|---|---|---|---|---|
| **A** Token-speaker IC message sent; alias set, sender in `.message-sender` | PASS — true name shown | PASS — alias shown as sender; message content intact | YES | NONE |
| **B** PF1 initiative card; same masked token | PASS — true name as sender | PASS — alias as sender | YES | NONE |
| **C** PF1 skill card (actor-alias speaker carrying scene+token ids) | PASS — true name | PASS — alias (census key finding: same registry key resolves) | YES | NONE |
| **D** Message content / flavor not altered | PASS | PASS — content byte-identical to core; no alias in card body | n/a | NONE |
| **E** Reveal → existing chat log shows true names (no reload) | PASS — registry `revealed:true` | PASS — posted messages updated **live, no reload** | YES | NONE |
| **F** Re-conceal → aliases restored in log | PASS | PASS — aliases restored live | YES | NONE |
| **G** No-alias / revealed messages: identical to core | PASS | PASS — no mutation observed; scroll/function intact | n/a | NONE |
| **H** Hostile alias `<img src=x onerror=alert(1)>` in sender line | PASS | PASS — alias rendered as literal text; no alert | YES | NONE |
| **I** 0.1.0/0.2.0 regression (tracker, nameplate, permissions) | PASS | PASS — tracker rows and nameplates correct | YES | NONE |
| **J** PF1 attack card BY masked creature (manual, in live play) | n/a | **PASS — confirmed by Michael** from DXWarlock seat: goblin attack cards and combat tracker both showed "Shadowy Figure" (alias); no true name in sender or tracker | n/a | NONE |

**Attack-card target leg** (spec §15 fail-open): PF1 attack card by a player against a masked
target — inner card target-name display not separately observed during automated testing.
Documented fail-open by design; watch in live play.

Consoles: zero pf15-identity-mask errors on both clients throughout the Fable session.

---

## 5. Honest observations and limitations

1. **`ui.chat?.render()` re-renders the full log** (0.3.0 approach): on a long chat log this
   produces noticeable flash/reflow on reveal/conceal. This is the correct documented
   AbstractSidebarTab pattern; the 0.3.1 hygiene pass replaces it with per-message
   `ChatLog#updateMessage` calls to avoid the full re-render.
2. **Attack-card target leg (fail-open):** player-attacks-masked-target inner card text was
   not independently observed in automated or this-session testing. Fail-open by design and
   documented. Michael should note it in live play.
3. **Third-party name surfaces fail-open:** monks-combat-details / chat-portrait /
   smarttarget / koboldworks were present in the dev world but no extra name text outside
   `.message-sender` was observed during the census round. Behavior under active third-party
   modification of the sender element is not separately tested — this is the motivation for
   the 0.3.1 text-node walk.
4. **Automation artifacts (not module behavior):** Chrome tab backgrounding pauses PIXI
   frames; same automation constraints as 0.2.0. No impact on real focused clients.

---

## 6. Cleanup / world state (Fable session)

Test state from the census session was cleaned: the 4 census chat messages deleted, registry
entry for "Pale Thing" / "Ghoul C" removed, test token deleted. Michael's live test entry
(`"Shadowy Figure"` on the Staging scene, token `2mgq1ZWcqQiaDC6d`) was preserved
throughout and remains in the registry at session end. Dev-world anomaly (round-0 combat
`Xv3MFaCSWsVSDpI0`, two "Unknown Participant" combatants) left untouched; Michael to review.

---

## 7. Release status

Tag `v0.3.0` was pushed 2026-06-12 (commit `a39cc8f`). `v0.1.0` and `v0.2.0` tags also
pushed in the same session. GitHub Releases page not yet created (roadmap step, separate
from tagging per ROADMAP release discipline).

---

## 8. Recommended next milestone

**0.3.1 hygiene pass (in progress at time of closeout):** onChange isolation guards
(three try/catch helpers) + sender text-node walk for markup compatibility with third-party
modules. No behavior change for the acceptance criteria verified above.

---

## 9. Independent closeout — Sonnet session re-verification (2026-06-12)

Performed in a subsequent session (Sonnet) on the same date. Runtime evidence uses the
0.3.1 candidate (working tree); the 0.3.1 delta does not alter any 0.3.0-scope behavior.

### API claims confirmed

All API claims in §2 were confirmed against the installed Foundry source and the module
working tree. No discrepancies found. The `renderChatMessageHTML` hook signature
(`message`, `html: HTMLElement`) is consistent with the current implementation and the
0.1.0 recon source citations.

### Architecture review

- `chat.mjs`: GM-only guard (`game.user.isGM`) and `HTMLElement` guard both present.
  Sender replacement via `textContent` (0.3.0) / text-node walk (0.3.1) — neither path
  uses `innerHTML` or any DOM interpolation. `getMaskEntry` is the sole registry read;
  missing/revealed entries both produce early return, so no-alias and revealed messages
  are byte-identical to core output.
- `state.mjs` onChange (0.3.0): inline `ui.chat?.render()` call; correct AbstractSidebarTab
  pattern. (0.3.1 replaces with per-message `updateMessage` sweep for performance.)
- No forbidden patterns, no prototype mutation, no jQuery, no network calls found in any
  module file.

---

## 10. Independent closeout — static re-check

Run against 0.3.1 candidate (see §3 for full table). All 16 categories: **PASS**.

---

## 11. Independent closeout — runtime smoke test (Sonnet session)

Two-client setup: Vivaldi = Dade (GM), Chrome = DXWarlock (Player). Test actor
`PF15IM Smoke Test NPC` placed on Staging scene; alias `"Smoke Wraith"` set via registry
API.

| Scenario | GM (Vivaldi) | Player (Chrome) | Sync | Leak |
|---|---|---|---|---|
| **A** IC message sent; sender masking | PASS — true name "PF15IM Smoke Test NPC" shown | PASS — "Smoke Wraith" as sender; single `TEXT_NODE` (nodeType 3) confirms text-node walk | YES | NONE |
| **B** Reveal → retroactive chat update | PASS | PASS — posted message updated to true name **live, no reload** | YES | NONE |
| **C** Re-conceal → alias restored | PASS | PASS — "Smoke Wraith" restored live | YES | NONE |

Both consoles: zero pf15-identity-mask errors throughout smoke test.

---

## 12. Cleanup / world state (Sonnet session)

Test actor `PF15IM Smoke Test NPC`, test token on Staging scene, and smoke test registry
entry all deleted. Michael's "Shadowy Figure" entry (`5WCQM12c4ePSXOko:2mgq1ZWcqQiaDC6d`)
preserved. Dev-world anomaly untouched.

---

## 13. Source changes during closeout

**NONE.** This closeout report is the only new file. No module source file was modified
during the independent verification session. The working tree contains uncommitted 0.3.1
hygiene changes prepared separately (not part of this closeout).

---

## 14. Final verdict

**0.3.0 VERIFIED — READY FOR MANUAL INSPECTION**

All independent checks pass:
- API claims: confirmed against installed Foundry 13.350 source and module source (§2, §9)
- Static validation: 16/16 categories PASS (§3, §10)
- Runtime scenarios A-J: all PASS, two clients, live sync verified (§4, §11)
- Michael manual confirmation: PF1 attack card by masked creature shows alias (§4 scenario J)
- Source changes: NONE during closeout (§13)
- Consoles: zero pf15-identity-mask errors on both clients throughout all verification sessions

Tag `v0.3.0` is correctly placed. Proceed with 0.3.1 hygiene pass and tag at Michael's
discretion after runtime smoke-test confirmation.
