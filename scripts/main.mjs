/**
 * pf15-identity-mask — entrypoint.
 *
 * Conceal a creature's true identity in the combat tracker behind a GM-set
 * public alias. Presentation-layer masking: Foundry still replicates the
 * underlying documents (and their names) to player clients; see README.
 */

import { registerSettings } from "./state.mjs";
import { onRenderCombatTracker } from "./tracker.mjs";

Hooks.once("init", () => {
  registerSettings();
});

Hooks.on("renderCombatTracker", onRenderCombatTracker);
