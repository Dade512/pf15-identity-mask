# PF1.5 Identity Mask (`pf15-identity-mask`)

> *Describe wrongness first; do not name a creature until the characters identify it.*

Combat-tracker identity masking for Foundry VTT v13.350+ with the Pathfinder 1e (`pf1`) system.
A GM gives any combatant a **public alias** — `Hunched Figure`, `Pale Thing`, `Hooded
Spellcaster` — and players see only that alias in the combat tracker until the GM reveals the
truth. The real Actor and Token names are never changed.

Version **0.3.1** · Croaker's Ledger visual language · reusable infrastructure (not
campaign-specific).

---

## What it does

- **Mask**: GM sets an alias per token — from the combat-tracker row or, since 0.2.0, from the
  **Token HUD** (right-click a token), with no combat needed. Players see the alias in the
  tracker **and on the canvas nameplate**; the GM sees the true name plus a `MASKED` alias line.
- **Reveal**: one click; every connected client's tracker updates immediately. Actor/Token names
  are untouched.
- **Re-conceal**: the reveal toggle reverses an accidental reveal; players see the alias again.
- **Per-token independence**: two tokens of the same Actor (`Ghoul`) can carry different aliases
  (`Starved Corpse`, `Crawling Shape`) with independent reveal states.
- **Persistence**: mask state survives combatant removal/re-add, combat deletion/recreation,
  reloads, and reconnects (it is keyed to the scene token, stored in a world setting).
- **No alias ⇒ no change**: unmasked combatants behave exactly as core Foundry/PF1.

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

- The ordinary player-facing combat-tracker surface shows only the alias while masked
  (name text and token-image alt text — the two places the core template prints the name).
- Since 0.2.0: the canvas **token nameplate** shows only the alias while masked, across all
  nameplate display modes (visibility rules stay core's).
- Since 0.3.0: the **chat sender line** shows the alias for messages spoken by a masked token
  (in-character speech, PF1 initiative and skill cards); reveal/conceal retroactively updates
  the existing chat log. Message *content* and third-party chat decorations are not masked.
- The module **adds zero additional true-name exposure**: the registry setting stores only
  `{alias, revealed}` (never the true name), and module-created DOM contains no true name in
  tooltips, titles, ARIA attributes, alt text, hidden text, comments, data attributes, or
  debug output.

Out of scope (unchanged by this module): targeting UI, the actor directory, journal content,
token tooltips, message content/flavor, and third-party chat decorations.

## Safe alias handling

Aliases are untrusted input: control characters are stripped, whitespace collapsed and trimmed,
length capped at **64 characters**. Aliases are rendered exclusively through `textContent`/`alt`
property assignment — never interpolated into HTML — so `<img src=x onerror=alert(1)>` displays
as inert text.

## Usage

1. Enable the module in a `pf1` world (Foundry v13.350+).
2. As GM, either right-click a token and use the **mask** button in the Token HUD (works with
   no combat anywhere), or use the same button on a combat-tracker row.
3. Type an alias, **Save**. Players now see the alias in the tracker and on the nameplate; you
   see the true name (plain nameplate, `MASKED` line in the tracker).
4. Click the **reveal** toggle (HUD or tracker) when the table earns the name. Click again to
   re-conceal.
5. **Clear** in the editor (or saving an empty alias) removes the mask entirely.

Combatants without a scene token (rare) cannot be masked and keep core behavior.

## Architecture (summary)

- State: one world-scope setting `pf15-identity-mask.registry`, a map of
  `"<sceneId>:<tokenId>" → {alias, revealed}`.
- Masking: `renderCombatTracker` hook (ApplicationV2, native `HTMLElement`), DOM mutation of
  fresh per-render nodes — idempotent by construction.
- Sync: the world setting's `onChange` runs on every client on every change, re-renders the
  tracker (popout included), sweeps posted chat messages via `ChatLog#updateMessage`, and
  refreshes canvas nameplates via `renderFlags`. No custom socket.
- Full rationale, evidence, and the visibility/permission matrices:
  [`docs/specs/identity-mask/identity-mask.spec.md`](docs/specs/identity-mask/identity-mask.spec.md).

## Known limitations (0.3.1)

- Presentation-layer only (see Security above).
- Targeting UI, actor directory, journal content, and third-party chat decorations still show
  true names (out of scope; see Security section).
- Message *content* and PF1 card inner target lines are not masked (fail-open by design).
- Registry entries for since-deleted tokens linger harmlessly; a purge tool is deferred.
- Assistant GMs share mask authority (they hold `SETTINGS_MODIFY` by default).
- English localization only.

## Future possibilities (roadmap: `docs/specs/identity-mask/ROADMAP.md`)

0.4.0 manual identification workflow · later: roll-assisted identification ·
actor-directory masking · registry purge tool · alias suggestion tables.
