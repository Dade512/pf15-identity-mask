# WORK-IN-PROGRESS — pf15-identity-mask 0.1.0

Last checkpoint: 2026-06-12 — **ALL PHASES COMPLETE**. Milestone 0.1.0 delivered and
runtime-verified on two clients.

## Current phase

Done. No work in progress.

## Completed

- Phase 1 recon (APIs source-verified against installed Foundry 13.350.0 + PF1 11.11)
- Phase 2 canonical spec — `docs/specs/identity-mask/identity-mask.spec.md`
- Phase 3 plan artifact — intentionally skipped (spec sufficed)
- Phase 4 implementation — module.json, lang/en.json, scripts/{main,const,state,tracker,editor}.mjs, styles/identity-mask.css, README.md
- Phase 5 static validation — all green (see verify report §3)
- Phase 6 two-client runtime — scenarios A–L all PASS (Vivaldi GM / Chrome Player), consoles clean
- Phase 7 report — `docs/reviews/identity-mask/2026-06-12-identity-mask-verify.md`

## Environment facts for resumption

- Foundry data path: `V:\FoundryVTTData` (NOT S:\FoundryVTTData; from
  `%LOCALAPPDATA%\FoundryVTT\Config\options.json`, which shows port 30000 — the live dev server
  runs on 30001).
- Installed Foundry source for API verification: `S:\FoundryVTT\resources\app\client|common`.
- Junction created: `V:\FoundryVTTData\Data\modules\pf15-identity-mask` → repo. KEEP.
- Module left ENABLED in world `baphomets-fall-dev` ("Echoes Dev Sandbox").
- Dev world login: Vivaldi = Dade (GM), Chrome = DXWarlock (player, no join password needed).

## Disposable Foundry test state currently present

- None. Test actor/tokens/combats deleted, registry setting emptied `{}`, pre-existing
  Round-10 encounter reactivated untouched.

## Known failures / unresolved

- None. Optional follow-ups listed in verify report §9–10.

## Exact next action (next milestone, when authorized)

0.2.0 candidates: Token-HUD/token-config alias editing, registry purge tool, mask-all-NPCs
action. Start from the spec's Deferred Features section.
