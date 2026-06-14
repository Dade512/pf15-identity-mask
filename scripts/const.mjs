/**
 * Shared constants for pf15-identity-mask.
 */

export const MODULE_ID = "pf15-identity-mask";

/** Key of the world-scope registry setting. */
export const SETTING_REGISTRY = "registry";

/** Maximum alias length after normalization. */
export const MAX_ALIAS_LENGTH = 64;

/** Current registry container schema version. */
export const REGISTRY_VERSION = 3;

/** Allowed display tiers, in toggle-cycle order (spec 17.3). */
export const DISPLAY_TIERS = ["masked", "partial", "revealed"];

/**
 * Per-tier UI metadata (spec 17.3): distinct icons AND text states, never
 * color alone. `next` defines the 3-state toggle cycle order.
 */
export const TIER_META = {
  masked: { lineIcon: "fa-mask", toggleIcon: "fa-masks-theater", next: "partial" },
  partial: { lineIcon: "fa-eye-low-vision", toggleIcon: "fa-eye-low-vision", next: "revealed" },
  revealed: { lineIcon: "fa-eye", toggleIcon: "fa-eye", next: "masked" }
};

/** Allowed identification outcomes ("none" = no record). */
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
