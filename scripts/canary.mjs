/**
 * Selector-drift canary for pf15-identity-mask (0.8.4, TD-13 rider).
 *
 * All masking fails OPEN when a Foundry or module update changes the markup
 * the module targets: players silently see true names/art. The GM client
 * checks the structure it can see and warns once per session per surface,
 * turning a silent unmask into a visible warning. Never blocks anything.
 */

const warned = new Set();

/**
 * Warn the GM once per session that a masked surface's elements were not found.
 * @param {"tracker"|"chat"} surface
 */
export function warnDriftOnce(surface) {
  if ( warned.has(surface) ) return;
  warned.add(surface);
  console.warn(`pf15-identity-mask | selector drift: could not find the ${surface} elements it masks`);
  ui.notifications.warn(game.i18n.format("PF15IM.Warn.SelectorDrift", { surface }));
}
