// Shared constants. Storage keys are versioned by when they were introduced —
// never renumber them, it would orphan existing data on every device.
export const API = "https://tcgtracking.com/tcgapi/v1";
export const CAT = 3;      // Pokémon (English)
export const CAT_JP = 85;  // Pokémon Japan
export const CATS = [CAT, CAT_JP];

// Pre-built catalog published daily by .github/workflows/catalog.yml to the
// orphan branch `catalog-data`. Set to "" to always crawl the API instead.
export const CATALOG_URL = "https://raw.githubusercontent.com/michu0303/pokevault/catalog-data/catalog.json.gz";
/** per-set price history lives next to the catalog: <base>/hist/<setId>.json.gz */
export const histUrlFor = (catalogUrl, sid) => catalogUrl ? catalogUrl.replace(/[^/]+$/, "hist/" + sid + ".json.gz") : "";
export const CATALOG_META_URL = "https://raw.githubusercontent.com/michu0303/pokevault/catalog-data/catalog-meta.json";

export const LS = {
  OWNED: "pv3_owned", WISH: "pv3_wishlist", PRICES: "pv3_prices", TRACKED: "pv3_tracked",
  FAV: "pv4_favorites", META: "pv2_catalog_meta", HISTORY: "pv4_history", PREFS: "pv4_prefs",
  SYNC: "pv4_sync", DIRTY: "pv4_dirty", WFOLDERS: "pv4_wishfolders", SETDATES: "pv4_setdates",
  LEGACY_COLLECTION: "pv2_collection", PRICES_AT: "pv5_pricesat",
};
export const IDB_NAME = "pokevault";
export const IDB_STORE = "catalog";

// "bundle" alone is split into a second branch so it only matches with a
// sealed-context prefix (booster|pack|battle|premium|art|sleeved). Bare
// "bundle" would catch the Pokémon "Iron Bundle" (Surging Sparks #055).
export const SEALED_RE = /\b(booster|box|tin|blister|elite trainer|build\s*&?\s*battle|collection|gift set|display|case|theme deck|battle deck|starter|toolkit|calendar)\b|\b(booster|pack|battle|premium|art|sleeved)\s+bundle\b/i;
// A product with NO collector number and one of these words is a sealed
// product even when the API gives it a card rarity ("… Mega Meganium ex Box"
// is "Double Rare", "Mini Tins 5-Pack" has none). Numbered cards named
// "Amulet Coin" or "Legend Box" are unaffected because they have numbers.
export const SEALED_NONUM_RE = /\b(tins?|decks?|kit|bundle|packs?|box|boxes|binder|sleeves|playmat|coins?|dice|poster|figure|pins?|lanyard|case|collection|display|blister|bundle|set)\b/i;
// Online code cards are not physical cards: dropped from sets and search.
export const CODE_RE = /^code card\b|\bcode card\b/i;
// Rarities whose quantity matters (value) — these get steppers, not toggles.
export const CHASE_RE = /double rare|ultra|illustration|hyper|secret|rainbow|amazing|radiant|shiny|prism|legend|break|prime|\bgx\b|\bex\b|vmax|vstar|v-?union|\bv\b|lv\.?\s?x|holo star|\bace\b/i;
// Ultra Rare and higher — the Collection tab's rarity filter.
export const HIVALUE_RE = /ultra|illustration|hyper|secret|rainbow|gold|crown|shiny|amazing|radiant|prism|vmax|vstar|legend|lv\.?\s?x|\bstar\b/i;

/** shown in Settings; tests/sw.test.js checks it matches sw.js VERSION */
export const APP_VERSION = "2026-09-17.2";
export const HISTORY_MAX = 365;        // daily totals kept for a year
export const HISTORY_DETAIL_DAYS = 60;  // per-card prices kept for two months
export const SEARCH_LIMIT = 240;
