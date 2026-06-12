# pf15-identity-mask 0.3.0 — Leak Census (Phase 1, scope gate)

Date: 2026-06-12. Environment as 0.2.0 report. Method: masked NPC ("Ghoul C" / alias
"Pale Thing", token+scene-keyed registry entry) put through combat-adjacent flows; every
surface read from the player seat (Chrome, DXWarlock). Census state fully cleaned afterward
(incl. the 4 census chat messages).

## Player-facing observations

| Surface | Observed | Verdict |
|---|---|---|
| Chat sender line (`.message-sender`), token-speaker message (in-character) | **"Ghoul C" — LEAK** | SUPPORTED target |
| Chat sender line, PF1 initiative card | **"Ghoul C" — LEAK** | SUPPORTED target (same surface) |
| Chat sender line, PF1 skill card (actor-alias speaker) | **"PF15IM Ghoul" — LEAK** | SUPPORTED target (same surface; see key finding) |
| Message *content* of the above | no true name in content/flavor | n/a |
| Combat tracker row (0.2.0 masking) | masked | already covered |
| Canvas nameplate (0.2.0 masking) | masked (stale-flag automation artifact aside) | already covered |
| Player targets masked token (core target UI) | no name surface observed | no action |
| monks-combat-details / chat-portrait / smarttarget / koboldworks little-helper extra name text outside chat | none observed during census round | UNSUPPORTED (third-party); fail open; re-check manually in live play |
| PF1 attack card rolled BY a masked creature | **RESOLVED — MANUALLY TESTED by Michael (2026-06-12, DXWarlock seat)**: goblin's attack cards and the combat tracker both showed "Shadowy Figure" (alias), no true name | PASS under 0.3.0 sender masking |
| PF1 attack card BY a player VS a masked target (target-name display inside the card) | Not separately observed (automated flow produced no card) | Watch in live play; fail-open by design |
| GM-side dialog titles (PF1 "Ghoul C – Initiative Check", "PF15IM Ghoul: Perception Check") | true names, **GM client only** | Not a player surface; out of scope |

## Key finding (simplifies implementation)

Both token-speaker and actor-alias-speaker PF1 messages carry **`speaker.token` and
`speaker.scene`** (verified on the census messages: skill card speaker =
`{token: <tokenId>, scene: <sceneId>, actor: <actorId>}`). Every leaking message therefore
resolves through the existing registry key — no actor-level fallback needed at 0.3.0.

## FROZEN supported-surface list for 0.3.0

1. **Chat message sender display** (core `.message-sender` element of rendered chat messages,
   sidebar + popout + re-renders) when `message.speaker.scene + message.speaker.token`
   resolve to a masked, unrevealed registry entry. Masking = alias via `textContent`.
2. **Retroactive consistency**: chat log re-renders on registry change so existing messages
   re-mask/unmask with reveal state.

Explicitly NOT in 0.3.0 (documented, fail open): message content/flavor text, PF1 card inner
target lines (pending the manual attack-card test), third-party module surfaces
(monks/chat-portrait/smarttarget/koboldworks), actor-only speakers with no token id, GM-side
dialog titles, dice-tooltip internals.

## Implementation notes for Phase 3 (from 0.1.0 recon, SOURCE VERIFIED)

- Hook: `renderChatMessageHTML(message, html)` — v13 replacement of renderChatMessage;
  html is HTMLElement (chat-message.mjs:378/419).
- Re-render path on registry change: verify public API for re-rendering the chat log
  (`ui.chat.render()` expected — AbstractSidebarTab; confirm popout coverage) during
  implementation recon.
- ChatMessage documents are never edited; display-only, GM client untouched.

## Open census anomaly (for Michael)

After census cleanup, the dev world's previous "Round 10" test encounter
(Pants/Oswald/Boots/Reginald) is no longer present; a round-0 combat with two token-less
"Unknown Participant" combatants (`Xv3MFaCSWsVSDpI0`) exists instead. The census only
created and deleted its own combat (`pJtEAiaCJjFwAc5D`); the cause of the Round-10
disappearance could not be reconstructed from session records. The unknown combat was NOT
touched. Flagged for manual review.
