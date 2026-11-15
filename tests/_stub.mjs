/**
 * Minimal Foundry globals for node --test (no DOM, no canvas).
 * Installs game.settings (in-memory), game.user, game.users, game.scenes,
 * ui.notifications and foundry.utils.deepClone. pf1 stays undefined, so
 * skill ids are validated by the regex fallback in state.mjs.
 */
export function installStub({ isGM = true, registry = {}, mysteryArt = "", users = ["u1", "u2"] } = {}) {
  const store = { registry: structuredClone(registry), mysteryArt, profiles: {} };
  let writes = 0;
  globalThis.game = {
    user: { isGM, id: "gm" },
    users: new Map(users.map(id => [id, { id, name: id, isGM: false }])),
    scenes: new Map(),
    settings: {
      get: (_module, key) => structuredClone(store[key]),
      set: async (_module, key, value) => { writes++; store[key] = structuredClone(value); return value; }
    },
    i18n: { localize: k => k, format: k => k }
  };
  globalThis.ui = { notifications: { warn: () => {}, error: () => {}, info: () => {} } };
  globalThis.foundry = { utils: { deepClone: v => structuredClone(v) } };
  return { writes: () => writes, registry: () => structuredClone(store.registry) };
}
