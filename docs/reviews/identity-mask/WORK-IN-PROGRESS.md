# WORK-IN-PROGRESS — pf15-identity-mask

## Current milestone

**0.3.1 — hygiene pass (candidate ready, awaiting Michael's go-ahead)**

Code candidate complete. Runtime smoke-test and 0.3.0 closeout report done.
Awaiting Michael's explicit go-ahead before commit/push/tag (and PAT revocation before
remote URL cleanup). See task list: `docs/reviews/identity-mask/0.3.1-HANDOFF-FOR-SONNET.md`.

### 0.3.1 changes

- `scripts/state.mjs` onChange: split tracker / chat / nameplate sync into three separate
  try/catch-guarded helper functions (`syncTracker`, `syncChat`, `syncNameplates`); per-message
  try/catch inside `syncChat` so one bad message cannot abort the rest or the nameplate refresh.
- `scripts/chat.mjs`: sender masking now walks `childNodes` and replaces only TEXT NODES
  (preserves element children — icons, links — added by other modules). New helper
  `replaceTextNodes(el, text)`.
- `module.json` → 0.3.1; download URL pinned to `v0.3.1` tag.
- README, spec, and this file de-drifted.

### Still required before 0.3.1 tag

1. ~~Runtime smoke-test~~ — DONE (2026-06-12): sender masked, text-node walk confirmed,
   reveal/conceal retroactive sweep PASS, zero console errors.
2. ~~0.3.0 independent closeout report~~ — DONE: `2026-06-12-identity-mask-0.3.0-verify.md`
   written; all 16 static categories PASS, all runtime scenarios PASS.
3. **Michael's explicit go-ahead** to commit, push, tag `v0.3.1`. ← BLOCKING
4. Remote URL hygiene (PAT removal from `.git/config`) — Michael revokes PAT first. ← BLOCKING

---

## Release history

| Tag | Commit | Summary |
|-----|--------|---------|
| v0.1.0 | 45289c9 | Initial combat-tracker alias masking |
| v0.2.0 | 88aa89a | Token HUD controls + canvas nameplate masking |
| v0.3.0 | a39cc8f | Chat sender masking (census-frozen scope) |

GitHub Releases: not yet created (ROADMAP step, separate from tagging).

---

## 0.3.0 verification summary

Two-client runtime verified 2026-06-12 (GM + Player). All spec §15 acceptance criteria PASS:
- Token-speaker message, PF1 initiative, PF1 skill card: player sees alias as sender.
- Reveal/conceal retroactively updates existing chat log without reload.
- No-alias / revealed messages identical to core.
- Hostile alias inert in sender line.
- 0.1.0/0.2.0 regression green.
- Manual: attack cards rolled BY a masked creature show alias (confirmed by Michael from
  player seat). Player-attacks-masked-TARGET inner card text: not separately observed,
  fail-open by design, watch in live play.

Independent 0.3.0 closeout report: `2026-06-12-identity-mask-0.3.0-verify.md` — written.

---

## Dev-world anomaly (flagged for Michael)

The previous "Round 10" test encounter is gone; a round-0 combat with two token-less
"Unknown Participant" combatants now exists. Origin could not be reconstructed from session
records. Left untouched; Michael to review when convenient.
