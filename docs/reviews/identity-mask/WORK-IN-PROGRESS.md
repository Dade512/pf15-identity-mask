# WORK-IN-PROGRESS — pf15-identity-mask

Last checkpoint: 2026-06-12 — **0.2.0 RELEASED** (Michael approved remotely; Fable executed):
commit `88aa89a` pushed to `origin/main`, tags `v0.1.0` (45289c9, retroactive for the existing
0.1.0 commit) and `v0.2.0` (88aa89a) pushed and verified via ls-remote. GitHub Release
creation NOT done (separate step per ROADMAP).

Git note: pushes on this machine hang if Git Credential Manager engages (hidden GUI prompt);
use `git -c credential.helper= push ...` — the PAT embedded in the remote URL then works.
SECURITY: that PAT is stored in plaintext in `.git/config` and surfaced in session logs —
Michael should rotate it when convenient.

## Current phase

0.3.0 — **RUNTIME VERIFIED two-client (2026-06-12)** + Michael's independent manual
confirmation of masking/reveal. One fix landed during verification: ChatLog#render does NOT
rebuild posted message elements, so the registry onChange now sweeps rendered messages via
the public `ChatLog#updateMessage` (state.mjs; SOURCE VERIFIED chat.mjs:1206-1214) — verified
live: GM conceal flipped the player's already-posted senders back to the alias with no reload,
zero leaks; fresh loads render reveal state correctly; both directions share the same path.
Census attack-card item RESOLVED: Michael manually confirmed (DXWarlock seat) that attack
cards rolled by his masked goblin and the tracker both show "Shadowy Figure". Remaining
sub-case (player attacking a masked TARGET — target-name inside the card) was not separately
observed; fail-open by design, watch in live play. ALL acceptance items closed. Awaiting
Michael's explicit word to commit/push/tag v0.3.0. Michael's test entry ("Shadowy Figure",
key 5WCQM12c4ePSXOko:2mgq1ZWcqQiaDC6d) left in the registry untouched.

### 0.3.0 candidate (this session)
- Census complete + scope frozen: `2026-06-12-identity-mask-0.3.0-census.md`. Spec §15 added.
- New `scripts/chat.mjs` — `renderChatMessageHTML(message, html)`: non-GM clients set
  `.message-sender` textContent to the alias when `speaker.scene+token` resolve to a masked
  entry. Defensive guards; content/flavor untouched; fail open elsewhere.
- `state.mjs` onChange now also `ui.chat?.render()` (retroactive re-mask/unmask).
- `main.mjs` registers the hook; `module.json` → 0.3.0; README ledger updated.
- Static gates: 8/8 syntax, JSON valid, guardrails clean.

### Runtime tests still required (spec §15 acceptance)
1. Player sees alias as sender on IC message + PF1 initiative + skill cards; GM sees true name.
2. Reveal/conceal retroactively updates existing player chat log (no reload).
3. No-alias/revealed messages identical to core; chat scroll fine; hostile alias inert.
4. MANUAL: PF1 attack card vs masked target (automated flow produced no card).
5. 0.1.0/0.2.0 regression sweep.

### 0.3.0 frozen scope
- Mask chat sender display (`.message-sender`) via `renderChatMessageHTML(message, html)`
  when `speaker.scene + speaker.token` resolve to a masked entry (key finding: PF1 fills
  speaker.token/scene even on actor-alias skill cards — existing resolver suffices).
- Re-render chat log on registry onChange (verify `ui.chat.render()` + popout at impl recon).
- MANUAL TEST REQUIRED: PF1 attack card vs masked target (automated player attack flow
  produced no card; retest manually).
- Fail-open/unsupported: message content, PF1 card target lines, third-party surfaces,
  actor-only speakers, GM dialog titles.

### Anomaly flagged for Michael
Dev world's prior "Round 10" test encounter is gone; round-0 combat `Xv3MFaCSWsVSDpI0`
("Unknown Participant" ×2) exists, origin unknown, left untouched. See census doc.

## 0.2.0 deliverables

- HUD mask controls (GM, AppV2 `renderTokenHUD`, works with zero combats)
- Canvas nameplate masking (`drawToken` pre-paint guard + `refreshToken` re-apply;
  GM plates plain true name)
- Resolver groundwork: state API takes `{sceneId, tokenId}` refs; `refForTokenDocument`
  adapter; registry schema unchanged (v1)
- Files changed: `module.json` (0.2.0), `scripts/{main,const,state,editor,hud,canvas}.mjs`
  (hud/canvas new), `styles/identity-mask.css`, `README.md`, spec §14
- Reports: `2026-06-12-identity-mask-0.2.0-verify.md` (this milestone),
  `2026-06-12-identity-mask-verify.md` (0.1.0)

## Verification status

- Static: all gates green (syntax 7/7, imports 14/14, i18n 16/16, zero forbidden patterns,
  CSS scoped).
- Runtime: all spec §14.5 acceptance criteria PASS on Vivaldi(GM)/Chrome(player), including
  live reveal/conceal canvas sync, owner-leg (0 HUD controls for owner player; server rejects
  forged write even as OWNER), hostile alias inert on plate, tracker+canvas agreement,
  0.1.0 regression sweep. Consoles clean. Details + honest limitations in the 0.2.0 report §5.

## Environment facts

- Foundry data: `V:\FoundryVTTData`; install source `S:\FoundryVTT\resources\app`.
- Junction `V:\FoundryVTTData\Data\modules\pf15-identity-mask` → repo. KEEP.
- Dev world `baphomets-fall-dev`; Vivaldi=Dade(GM), Chrome=DXWarlock(player, no password).
- World was relaunched at closeout so the manifest reports 0.2.0; both clients rejoined.
- Known automation quirks in this world: ninja-notes overlay eats coordinate clicks
  (use element .click()); backgrounded Chrome tab pauses canvas ticker (render-flag reads
  look stale until the tab renders a frame).

## Disposable Foundry test state currently present

- None. Test actor/tokens/combat deleted; registry `{}`; Round-10 encounter untouched/active.

## Exact next actions

1. Michael: review `docs/reviews/identity-mask/2026-06-12-identity-mask-0.2.0-verify.md`
   §9-14 (independent closeout). On approval → commit, push, tag `v0.2.0`
   (version already matches), GitHub Release as a separate step.
2. 0.3.0 recon/census per ROADMAP (do not start implementation before the census freeze).

## Closeout verification summary (2026-06-12)

Independent review by Claude Sonnet 4.6 — no source changes made.

- Architecture review: PASS (AppV2 hooks, idempotent DOM, no forbidden patterns)
- Installed-source API verification: 6/6 PASS against Foundry 13.350 source
- Static check: 16/16 categories PASS
- Runtime A-N: all PASS, Vivaldi(GM) + Chrome(Player), live sync verified
- Consoles: zero pf15-identity-mask errors on both clients
- Source changes during closeout: NONE
