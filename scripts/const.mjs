/**
 * Shared constants for pf15-identity-mask.
 */

export const MODULE_ID = "pf15-identity-mask";

/** Key of the world-scope registry setting. */
export const SETTING_REGISTRY = "registry";

/** Maximum alias length after normalization. */
export const MAX_ALIAS_LENGTH = 64;

/** Current registry container schema version. */
export const REGISTRY_VERSION = 2;

/** Allowed identification statuses ("none" = no identification recorded). */
export const ID_STATUSES = ["unidentified", "partial", "identified"];

/** Maximum publicNote length after normalization. */
export const MAX_NOTE_LENGTH = 200;

/** CSS class names owned by this module (all selectors are scoped to these). */
export const CSS = {
  alias: "pf15im-alias",
  aliasState: "pf15im-alias-state",
  aliasText: "pf15im-alias-text",
  control: "pf15im-control",
  editor: "pf15im-editor",
  hudControl: "pf15im-hud-control"
};
