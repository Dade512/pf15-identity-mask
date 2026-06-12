/**
 * pf15-identity-mask — entrypoint.
 *
 * Conceal a creature's true identity in the combat tracker behind a GM-set
 * public alias. Presentation-layer masking: Foundry still replicates the
 * underlying documents (and their names) to player clients; see README.
 */

import { registerSettings, migrateRegistry } from "./state.mjs";
import { onRenderCombatTracker } from "./tracker.mjs";
import { onRenderTokenHUD } from "./hud.mjs";
import { onDrawToken, onRefreshToken } from "./canvas.mjs";
import { onRenderChatMessageHTML } from "./chat.mjs";

Hooks.once("init", () => {
  registerSettings();
});

// One-time v1 -> v2 registry container migration (GM client; idempotent).
Hooks.once("ready", migrateRegistry);

Hooks.on("renderCombatTracker", onRenderCombatTracker);
Hooks.on("renderTokenHUD", onRenderTokenHUD);
Hooks.on("drawToken", onDrawToken);
Hooks.on("refreshToken", onRefreshToken);
Hooks.on("renderChatMessageHTML", onRenderChatMessageHTML);
