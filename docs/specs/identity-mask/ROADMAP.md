# pf15-identity-mask — Approved Roadmap (0.2.0 → 0.4.0 → later)

Status: **APPROVED with revisions, 2026-06-12** (Michael). This document is the canonical
staging plan. Per-milestone specs supersede it on detail once written; conflicts resolve in
favor of the newer milestone spec.

Baseline: 0.1.0 verified primitives — world-setting registry (server-authoritative GM writes),
`onChange` cross-client sync, post-render display-only mutation, true names never stored.
Every stage extends these primitives; none redesigns them.

---

## Cross-cutting groundwork

### Shared resolver
One core lookup, `resolveMask({sceneId, tokenId})` → entry, with thin adapters
(combatant → token → chat speaker). No surface invents its own definition of "masked."

### Registry container versioning (registry level, not per entry)
The first schema change (0.4.0) normalizes the container:

```js
{
  _v: 2,
  entries: {
    "sceneId:tokenId": { alias, revealed, identification }
  }
}
```

One `_v` at registry level = one migration boundary; no metadata mixed into token-keyed
entries. Migration runs once on `ready` (GM client) from the v1 flat map.
0.2.0 / 0.3.0 must not require schema changes.

### Honest scope ledger
Every milestone updates README + spec with exactly which surfaces are masked and which still
leak. Presentation-layer framing never lapses into implying secrecy.

### API verification discipline
All mechanism notes below are **hypotheses until source-confirmed** against the installed v13
client (`S:\FoundryVTT\resources\app\client`). If a needed capability turns out to require an
undocumented/underscore/internal path, that portion STOPS and is reported — no brittle hacks.

### Release discipline (repo now exists: Dade512/pf15-identity-mask)
Local-first, exactly like baphomet-utils:
1. Work locally from the last verified tag.
2. Recon → spec → implement → static gates → two-client runtime lanes (GM + Player).
3. Focused closeout review.
4. Only after Michael's explicit approval: update release metadata, commit, push, tag.

Hard rules: module.json version and git tag must match · no tag before runtime closeout ·
no pushing experimental milestone work without explicit approval · GitHub Release/package
creation is a separate step from commit/tag.

---

## 0.2.0 — Token HUD controls + canvas/nameplate masking

**Goal:** masking stops being tracker-only. GM sets/edits/clears/reveals from the token
(pre-combat masking); players stop seeing true names on canvas nameplates.

### Workstream A — Token HUD controls (GM)
- **Recon item (neutral):** verify TokenHUD's actual v13 base class, hook signature, and
  element type against installed source. Current project references indicate **V1/jQuery**
  (`renderTokenHUD` with `html[0]` for the native element); installed-source confirmation
  controls. Do not assume AppV2.
- GM-only mask button in the HUD opens the existing DialogV2 editor via a token-document
  adapter; reveal/conceal toggle appears when an entry exists.
- Token-config tab rejected for 0.2.0 (HUD is faster mid-session; avoids form integration
  with core/PF1 token sheets).

### Workstream B — Canvas nameplate masking (Player)
- All mechanisms provisional until source-confirmed: `token.nameplate`, `refreshToken`,
  `drawToken`, `renderFlags.set(...)` are **hypotheses**, not commitments. Recon determines
  the public, supported path for (a) setting displayed plate text per-client and (b)
  triggering a redraw when the registry changes. If no public path exists, Workstream B
  stops and reports rather than touching internals.
- Display-only: never the TokenDocument.
- GM canvas plates show the **plain true name — no mask glyph** (decided: HUD + tracker
  already carry mask status; Croaker's Ledger puts scan speed before decoration; revisit
  only if play shows GMs forgetting which tokens are masked).
- Out of scope: token tooltips, hover overlays from other modules.

### Runtime acceptance (two-client, dev sandbox, full module load)
- HUD set/edit/clear/reveal round-trip from a token with no combat anywhere.
- Player nameplate shows alias across **all display modes** (NONE/HOVER/ALWAYS, owner and
  non-owner variants) — explicit display-mode × ownership test matrix.
- Reveal/conceal propagates to canvas live; combat tracker and canvas agree at all times.
- Hostile alias inert on the plate; unmasked tokens pixel-identical to core; no document
  mutation; registry shape unchanged (v1).
- Nameplate flash measured/observed honestly (more plausible on canvas than in the tracker).

---

## 0.3.0 — Chat, targeting, and ancillary surfaces (scope-gated)

**Goal:** hold the masked name through ordinary combat flow on an explicitly enumerated set
of supported surfaces.

**Gated sequence — no implementation before the gate closes:**
1. **Leak census**: from the player seat, run a full PF1 combat round against a masked
   creature; record every true-name sighting (chat speaker names, PF1 card titles/content,
   initiative messages, targeting overlays, tracker tooltips, chat bubbles, third-party
   module surfaces).
2. **Freeze** the supported-surface list (first-party core + PF1 surfaces only; third-party
   overlays documented as unsupported).
3. Update the spec (visibility matrix gains the new surfaces).
4. Then implement. No opportunistic text-node sweeps of all of Foundry.

Mechanism candidates (verify at recon): `renderChatMessageHTML(message, html)` (SOURCE
VERIFIED to exist, 0.1.0 recon) keyed off `message.speaker` → resolver; re-render chat log on
registry `onChange` so history re-masks/unmasks (public API for that re-render to be
verified). ChatMessage documents are never edited.

**Acceptance (revised wording):** no true-name sightings on the **explicitly enumerated and
supported first-party/PF1 surfaces tested during the leak census**. Unsupported third-party
surfaces are documented and fail open without breaking their UI. PF1 card functionality
(buttons, apply-damage, etc.) unharmed; reveal retroactively re-renders existing chat;
unmasked combat byte-identical behavior. Tested-against PF1 version pinned in README; PF1
card DOM is not a stable API — selectors stay conservative and fail open.

---

## 0.4.0 — Manual identification workflow (GM keeps the reveal)

**Goal:** support the table loop — player rolls Knowledge → GM records the outcome → GM
decides what changes. No automation decides anything.

### Data model (`_v: 2` container migration happens here)
Compact, bounded, current-state only — **not** an append-only log:

```js
identification: {
  status: "unidentified" | "partial" | "identified",
  skill: "knowledge",     // which Knowledge variant, per PF1.5 docs
  total: 23,
  dc: 20,                  // optional
  userId: "...",          // who rolled (record-keeping only)
  updatedAt: <ms>,
  publicNote: ""          // EXPLICITLY player-readable; UI must warn
}
```

Decisions locked in:
- **`publicNote`, never `note`.** The editor UI labels it player-readable and warns. No
  generic field someone can type "actually a vampire lord" into at 2 a.m.
- **No GM-secret notes in 0.4.0.** Deferred until a verified storage mechanism exists that
  genuinely does not replicate to player clients. (The 0.1.0 lesson stands: User flags,
  Combatant flags, world settings all replicate or are owner-writable.)
- **Reveal stays global, manual, GM-only** — identical trust model to 0.1.0. Identification
  attempts record *who* rolled, but status is GM-facing and per-player true-name visibility
  is explicitly out of scope (it would complicate every render surface and sync path).
- If history later proves genuinely needed, a small fixed-cap list replaces the single
  object — not unbounded growth inside a shared world setting.

### UI
Editor dialog gains an identification section (ledger-entry styling): status, skill, total,
DC, publicNote. Tracker/HUD alias line gains a small GM-only status tag (e.g. `PARTIAL`).
Optional GM convenience: a reveal button next to `identified` status — still a manual click.

### Acceptance
v1→v2 container migration with a populated registry; identification CRUD round-trip;
player write attempts still server-rejected; audit confirms the only new player-visible
data is `{identification minus nothing}` — and `publicNote` is the documented, warned field;
reveal remains manual; no automation pathways exist.

---

## Later — roll-assisted identification (unversioned)

Prerequisites before this earns a number:
1. PF1.5 identification DCs / partial-information tiers settled in the campaign rules docs.
2. 0.4.0 field experience shows the manual loop is actually used.
3. Recon: PF1 skill-roll hooks (`pf1ActorRollSkill` payload) for detecting Knowledge rolls;
   read-only inspection of `local-lore-oracle` to design an integration contract (what it
   may answer, what it must never auto-reveal).

Committed stance: automation may **record and suggest** (pre-fill an identification entry
from a detected roll); the reveal itself is always a GM click.

---

## Sequencing

0.2.0 next: self-contained, highest play value (pre-combat masking), and its canvas recon
de-risks the 0.3.0 census. Each milestone runs the proven pipeline: recon (resolve the
hypothesis list) → spec update → implement → static gates → two-client runtime matrix →
verify report → closeout → (on approval) commit/push/tag.
