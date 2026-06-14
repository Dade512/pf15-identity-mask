# PF1.5 Identity Mask (`pf15-identity-mask`)

> *Describe wrongness first; do not name a creature until the characters identify it.*

Identity masking for Foundry VTT v13.350+ with the Pathfinder 1e (`pf1`) system. A GM gives
any scene token a **public alias** — `Hunched Figure`, `Pale Thing`, `Hooded Spellcaster` —
and players see only that alias in the combat tracker, on the canvas nameplate, and in the
chat sender line, until the GM moves the **display tier** toward the truth:
**Masked → Partial → Revealed**. The Partial tier shows an optional **partial alias** (a
half-identified guess like `Diseased Kinder?`). The real Actor and Token names are never
changed.

Version **0.5.0** · Croaker's Ledger visual language · reusable infrastructure (not
campaign-specific).

> **Updating to 0.5.0**: the registry storage format changed again (v3). Restart the world and
> have **every connected client reload — especially GM clients — before using any mask
> controls.** A stale GM client could otherwise write the old format over the migrated
> registry.

---

## Installation

In Foundry's **Add-on Modules → Install Module**, paste this **Manifest URL**:

```
https://raw.githubusercontent.com/Dade512/pf15-identity-mask/main/module.json
```

This tracks the latest release on `main`. Then enable **PF1.5 Identity Mask** in a `pf1` world
(Foundry v13.350+).

## What it does

- **Mask**: GM sets an alias per token — from the combat-tracker row or from the **Token HUD**
  (right-click a token), with no combat needed. Players see the alias in the tracker, on the
  canvas nameplate, and as the chat sender; the GM sees the true name plus a tier status line.
- **Three display tiers** (0.5.0): the reveal toggle is now a 3-state cycle —
  `MASKED` (public alias) → `PARTIAL` (partial alias, falling back to the public alias when
  none is set — never the true name) → `REVEALED` (true name). The tier is global (all players
  see the same thing) and **only the GM's toggle changes it** — identification records never
  do.
- **Per-PC identification log** (0.5.0): the editor records the identification context once
  per creature (skill used, DC needed, a universal public note) and each player's roll total
  and outcome on their own row — one editable row per non-GM player. Records inform the GM's
  tier call; they automate nothing.
- **Mask all** (0.5.0): one editor button masks every same-Actor token on the current scene,
  with a confirmation dialog showing the affected count, an opt-in overwrite of existing
  entries, and optional numbered aliases (`Shadowy Figure 1/2/3`).
- **Per-token independence**: two tokens of the same Actor (`Ghoul`) can carry different aliases
  (`Starved Corpse`, `Crawling Shape`) with independent display tiers.
- **Persistence**: mask state survives combatant removal/re-add, combat deletion/recreation,
  reloads, and reconnects (it is keyed to the scene token, stored in a world setting).
- **No alias ⇒ no change**: unmasked tokens behave exactly as core Foundry/PF1.

## Who can use it

Setting, editing, clearing, revealing, and concealing are **GM-only**, enforced server-side:
mask state lives in a world-scope setting, and Foundry's server rejects world-setting writes
from users without the *Modify Configuration Settings* permission (by default, Assistant GM and
Gamemaster). Actor ownership grants players **no** control over mask state — deliberately, the
state is not stored on Actors, Tokens, or Combatants, all of which owners can write to.

## Security: presentation-layer masking, honestly stated

**This is table-facing concealment, not secrecy.** Foundry replicates the Combatant, Token, and
visible Actor documents — including true names — to every player client that can see them. A
technically knowledgeable player can read true names from the browser console (e.g.
`game.combat.combatants.contents.map(c => c.name)`). No module can prevent that without
server-side redaction, which Foundry does not provide.

What this module guarantees:

- The ordinary player-facing combat-tracker surface shows only the tier display name while
  masked or partial (name text and token-image alt text — the two places the core template
  prints the name).
- The canvas **token nameplate** shows only the tier display name while masked or partial,
  across all nameplate display modes (visibility rules stay core's).
- The **chat sender line** shows the tier display name for messages spoken by a masked token
  (in-character speech, PF1 initiative and skill cards); tier changes retroactively update
  the existing chat log. Message *content* and third-party chat decorations are not masked.
- At the Partial tier with no partial alias set, the fallback is the **public alias — never
  the true name**.
- The module **adds zero additional true-name exposure**: the registry setting stores only
  `{alias, partialAlias?, displayTier, identification?}` (never the true name), and
  module-created DOM contains no true name in tooltips, titles, ARIA attributes, alt text,
  hidden text, comments, data attributes, or debug output.
- The GM can log manual **identification rolls** (shared skill/DC/public note per creature,
  plus each player's roll total and outcome). **The entire identification record is
  technically readable by player clients** via the replicated setting — skill, DC, note,
  and every player's total, outcome, and timestamp included. Never put secrets in it.
  Logging a roll never changes what players see; the display tier remains a separate manual
  GM control.

Out of scope (unchanged by this module): targeting UI, the actor directory, journal content,
token tooltips, message content/flavor, and third-party chat decorations.

## Safe alias handling

Aliases are untrusted input: control characters are stripped, whitespace collapsed and trimmed,
length capped at **64 characters**. The partial alias is sanitized identically; public notes
get the same treatment with a 200-character cap. All are rendered exclusively through
`textContent`/`alt`/PIXI-text property assignment — never interpolated into HTML — so
`<img src=x onerror=alert(1)>` displays as inert text.

## Usage

1. Enable the module in a `pf1` world (Foundry v13.350+).
2. As GM, either right-click a token and use the **mask** button in the Token HUD (works with
   no combat anywhere), or use the same button on a combat-tracker row.
3. Type an alias (and optionally a partial alias), **Save**. Players now see the alias in the
   tracker, on the nameplate, and in chat; you see the true name plus a `MASKED` tier line.
4. Click the **tier** toggle (HUD or tracker) as the table earns the name: each click cycles
   Masked → Partial → Revealed → Masked.
5. Log identification rolls in the editor as players attempt Knowledge checks: set the skill,
   DC, and (universal) public note once, then enter each player's roll total and outcome on
   their row. The tier never changes on its own.
6. Use **Mask All** in the editor to mask every same-Actor token on the scene at once
   (confirmation dialog first; existing entries are skipped unless you opt into overwrite).
7. **Clear** in the editor (or saving an empty alias) removes the mask entirely.

Combatants without a scene token (rare) cannot be masked and keep core behavior.

## Architecture (summary)

- State: one world-scope setting `pf15-identity-mask.registry`, a versioned container
  `{_v: 3, entries: {"<sceneId>:<tokenId>" → {alias, partialAlias?, displayTier,
  identification?}}}`; older v1/v2 data migrates once on the GM client at `ready`.
- Masking: `renderCombatTracker` hook (ApplicationV2, native `HTMLElement`), DOM mutation of
  fresh per-render nodes — idempotent by construction.
- Sync: the world setting's `onChange` runs on every client on every change, re-renders the
  tracker (popout included), sweeps posted chat messages via `ChatLog#updateMessage`, and
  refreshes canvas nameplates via `renderFlags`. No custom socket.
- Full rationale, evidence, and the visibility/permission matrices:
  [`docs/specs/identity-mask/identity-mask.spec.md`](docs/specs/identity-mask/identity-mask.spec.md).

## Known limitations (0.5.0)

- Presentation-layer only (see Security above).
- The display tier is global — every player sees the same thing. Per-player tiers (only the
  roller sees the name) are deliberately deferred.
- Targeting UI, actor directory, journal content, and third-party chat decorations still show
  true names (out of scope; see Security section).
- Message *content* and PF1 card inner target lines are not masked (fail-open by design).
- Registry entries for since-deleted tokens linger harmlessly; a purge tool is deferred.
- Assistant GMs share mask authority (they hold `SETTINGS_MODIFY` by default).
- English localization only.

## Future possibilities (roadmap: `docs/specs/identity-mask/ROADMAP.md`)

Roll-assisted identification (prerequisites in the roadmap) · per-player display tiers ·
actor-directory masking · registry purge tool · alias suggestion tables.
