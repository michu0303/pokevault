# PokéVault — developer notes

Context for continuing development of PokéVault.

## What it is

A personal Pokémon TCG collection tracker. **One file: `PokeVault.html`** — HTML + CSS + vanilla JS, no framework, no build step, no npm dependencies. It runs by opening the file in a browser; it's mobile-first.

Keep it a single file unless there's a strong reason otherwise — that's deliberate (trivial to host, copy, and run anywhere). There is no build; "deploy" is just hosting the static file (Netlify, GitHub Pages, etc.).

## Data source

**TCGTracking Open TCG API** — `https://tcgtracking.com/tcgapi/v1`. No API key, no rate limits, CORS-enabled. Two categories are pulled: **`3`** (English, `CAT`) and **`85`** ("Pokemon Japan", `CAT_JP`) — `buildCatalog` fetches both and tags every product and `bySet` group with a `cat`. Endpoints (`{cat}` = 3 or 85):

- `GET /{cat}/sets` → `{ sets:[{id,name,published_on}, …] }`
- `GET /{cat}/sets/{id}` → `{ products:[{id,name,set_name,number,rarity,image_url, …}] }`
- `GET /{cat}/sets/{id}/pricing` → `{ prices:{ <productId>:{ tcg:{ <variant>:{low,market} } } } }`

News: PokéBeach RSS (`pokebeach.com/feed/`) fetched through the `api.allorigins.win` CORS relay. `loadNews()` and `state.news` still exist but are **dormant** — the news panel was dropped from the Home screen in the Figma redesign and `loadNews()` is no longer called.

## Storage

**IndexedDB** — database `pokevault`, store `catalog` (keyPath `i`). Holds the full catalog (~60k products across English + Japanese), built once via "Build card database".

**localStorage keys** — prefixes are versioned by when they were introduced; do not renumber them, it would orphan existing data:

- `pv3_owned`, `pv3_wishlist`, `pv3_tracked`, `pv4_favorites` — collection state
- `pv4_wishfolders` — named wishlist folders
- `pv3_prices` — cached prices for owned / wishlist products
- `pv4_history` — daily collection-value snapshots (still logged; the trend display was removed in the Figma redesign)
- `pv4_prefs` — binder layout, sort / filter preferences, Collection page-size (`colPerPage`) (also holds a now-dormant `theme` field — see Design system)
- `pv2_catalog_meta` — catalog build metadata
- `pv4_sync` — cloud sync config (url, key, passphrase)
- `pv4_dirty` — "unsynced local changes" flag
- `pv4_setdates` — `{ setId: "YYYY-MM-DD" }` map of set release dates; fetched from the `/sets` endpoints (small, separate from the catalog) so the recency sort works without a catalog rebuild

## Data model (`state`)

- `owned`: `{ productId: { variantName: qty } }` — per-printing quantities
- `wishlist`: `{ productId: 1 }`
- `wishFolders`: `[{ id, name, items:{ productId:1 } }]` — named wishlist folders; a card may belong to multiple folders. Un-wishlisting a card removes it from every folder. A card in zero folders is "Unsorted". Managed in the Wishlist tab (folder strip + a per-card folder picker modal reachable from the card detail).
- `tracked`: `{ setId: 1 }` — sets the user is completing
- `favorites`: `{ setId: 1 }` — sets pinned to the dashboard
- `flatPrices`: `{ productId: { variant: price } }`
- `setDates`: `{ setId: "YYYY-MM-DD" }` — set release dates; `setDate(sid)` reads it, `loadSetDates()` fills it (best-effort, on load if empty; also refreshed by `buildCatalog`)
- `history`: `[{ d:"YYYY-MM-DD", total, pv:{ pid:value } }]`
- `catalog`: `[{ i:id, n:name, s:setName, sid:setId, nu:number, r:rarity, g:imageUrl, cat:3|85, sealed:bool }]`
- `byId` — Map(id → catalog entry); `bySet` — Map(setId → `{ name, cat, cards, sealed, groups }`)

API IDs are numeric; object/Map keys are stringified consistently — keep that convention.

## Key behaviors

- **Card grouping** — within a set, products that share a collector `number` are grouped (finish / pattern variants of the same card). A different number means a different card, so an Illustration Rare and the base card stay separate even with the same name. See `indexCatalog()`.
- **Sealed detection** — `looksSealed()` flags products as sealed by a name regex; sealed products render in a separate section.
- **Rarity-driven input** — `isChaseRarity()`: ex / V / VMAX / VSTAR / GX / Illustration Rare / secret etc. get quantity steppers (value matters); everyday cards (commons, uncommons, rares, energies, Poké Ball variants…) get tap-to-check toggle rows. `isHighValueRarity()` (Ultra Rare and up) powers the Collection tab's rarity filter.
- **Variant order** — `variantRank()` sorts printings: Normal → Holo → Reverse → Energy → Poké Ball → Master Ball → other.
- **Price-less variants** — variant subtypes with no price are dropped when a product has at least one priced variant (avoids junk catalog entries); kept only if a product has no prices at all.
- **Pattern-reverse products** — in pattern-reverse sets (e.g. ME: Ascended Heroes) the patterned reverses are *separate products* sharing a card's collector number, named `"… (Energy Symbol Pattern)"` / `"… (Poké Ball)"` etc. `patternOf(name)` detects such a product and returns a short label (`Energy`, `Poké Ball`, …); `""` for a base card. In `getSetPricing`, once a card group contains any pattern product, the base product's own redundant `Reverse Holofoil` is dropped from `flatPrices` (the price API double-counts it). `groupPrintings()` labels each printing via `patternOf` (falling back to `shortVariant`), so the set-detail `.vtog` toggles read Normal / Energy / Poké Ball. Trainer cards have no pattern siblings and are untouched.
- **Ownership states** — `ownState()` / `groupState()` return none / partial / complete, driving the gray + / yellow – / green ✓ corner badge on tiles and the grayed-out look of unowned tiles. This applies on Home (set detail) only — Search tiles are rendered "plain" (see Search tab).
- **Search relevance** — `searchCatalog()` keeps a loose substring match for inclusion (so nothing is lost) but ranks results with `matchScore()`: exact name > name-prefix > full-phrase-in-name > whole-word > word-prefix > loose substring > set-name-only, with a short-name tie-breaker. This relevance order IS the "Best match" sort.

## UI

Five tabs: **Home**, **Search**, **Collection**, **Wishlist**, **Settings**. Rendering is plain template-string `innerHTML` into `#view-*` containers; interaction is event delegation on `data-action` attributes (single document click listener).

The **Home** tab has modes (`state.home.mode`): `dashboard` (default), `picker` (add sets to track), `mysets` (all tracked sets), `detail` (a set's checklist / binder). `renderDashboard()` is built to match the Figma Home frame — in this exact order: a **Collection Worth** card, **Top Cards** (the 3 most valuable owned cards), **In Progress Sets** (up to 3 tracked-but-incomplete sets, then a full-width "View All" button), and **Latest Sets** (newest releases, horizontal scroll). Preserve that order and section set when editing — it mirrors the Figma design.

The **set detail** view (`renderSetDetail`, Home `detail` mode) matches the Figma set frames: a back chevron (returns to wherever the set was opened from — `state.home.from`, captured by `enterSet`; the bottom-nav Home tab always resets straight to `dashboard`) + set title + a **star** that tracks *and* pins the set in one tap (`toggleSetStar` keeps `tracked` and `favorites` in sync — the star's on-state is `isTracked`). Then a Cards/Sealed `.cardtoggle`, a **Progress** card (`% / X of Y cards / Total Value` + bar, scoped to the rarity filter), an inline **All Rarities** dropdown (`.fdrop`, single-select, `state.home.rarityOpen`), an All/Owned/Missing pill row + a List/Binder toggle. **Owned/Missing use a master-set definition** — `og(grp)` is `groupState(grp)==="complete"` (every printing collected); Owned = complete cards, Missing = anything not complete (none *or* partial), and the Progress count uses the same predicate so the three stay consistent. **List** view = `.setrow` rows (image, name, number) with a per-printing `.vtog` check toggle each — tapping one directly marks that (product, variant) owned via `own-toggle`; scrolls, no pagination. **Binder** view = a 4-col `.btile` grid with per-printing check badges, **paginated** 12/page (`state.home.page`). `groupPrintings(grp)` flattens a card group into its (product, variant) printings. Pagination uses the shared `pagenavHtml(pg,pages,kind)` (`kind` `"home"` or `"col"`); first/last buttons use `SVG_DBLARROW`, prev/next reuse `SVG_CARET` (rotated). **Black Bolt / White Flare special-case** — `renderSetDetail` filters `allGroups` to Illustration / Special Illustration Rares only for **English** sets whose name matches `/black bolt|white flare/i` (the user collects just the IR/SIR chase from those two sets). The Japanese releases (`bySet` group `cat===CAT_JP`) are excluded from the restriction since their rarity names differ; every other set shows all cards.

The **Search** tab (`renderSearch`): a search bar (matches card name OR set name — searching a set name returns its whole contents), a results header with a count, a Sort button (swap icon) and a Filters button, then a 3-column tile grid. `searchCatalog()` ranks by relevance then caps at 240 matches. Search tiles are **plain** — `cardTile(c, true)` renders no ownership badge, no count badge and no graying of unowned cards; every result shows fully. Ownership is managed in the card modal after tapping a tile.

The **Collection** tab (`renderCollection`): a Cards/Sealed toggle, a "Worth" summary card, a "Card/Sealed Values" heading with Sort + Filters buttons, then a **paginated** list of owned products (page size from `prefs.colPerPage`, default 30; page in `state.colflt.page`). Collection filters/sort live in `state.colflt` and are runtime-only (not persisted) — only the page size persists.

The **Wishlist** tab (`renderWishlist`) has two modes via `state.wl.folder` (`null` = main, or a folder id = folder detail). **Main**: a "Wishlist" title + "+ New Folder" button, a horizontal-scroll folder strip (`.hscroll` of `.foldercard`, each showing name + card count), then an "Unsorted" heading with Sort + Filters and a list of cards that are in **zero** folders. **Folder detail**: a back chevron + folder name + a `⋯` options button (rename/delete via the `wlfolder` bottom sheet), Sort + Filters, then that folder's cards. Rows are `.topcard.wlrow` (image, name, set · number, value, filled heart to un-wishlist). Wishlist sort/filter state is `state.wlflt` (runtime-only, shared by both modes); `wlSortFilter()` applies it. Filing a card into folders is done from the card detail modal's folder button (`wl-card-folders` → the `cardfolders` picker).

**Filter / sort sheets** — Search, Collection and Wishlist each have a Sort sheet and a Filters sheet, all bottom-sheet modals keyed by `state.modalMode` (`searchsort`, `filters`, `colsort`, `colfilters`, `wlsort`, `wlfilters`; plus `wlfolder` for folder rename/delete). The Wishlist sheets mirror Collection's (Value/Name/Language/Release-date sort; Language/Rarity/Set filters). The Rarity and Set filters use a shared custom multi-select dropdown (`.fdrop` / `.fdroplist` / `.fopt`); the Set list has its own search box. `SVG_CARET` is the dropdown arrow, `SVG_SWAP` the Sort-button icon. Search filters = Type + Language + Rarity + Set (no Ownership — Search shows every card fully visible); Collection filters = Language + Rarity + Set + page-size (no ownership/type — Collection is, by definition, what you own, and Cards/Sealed is the top toggle). Both Sort sheets offer Value, Name, Language (English/Japanese first) and Release date (Newest/Oldest sort values `date-new` / `date-old`, by `setDate(sid)`); Search additionally has Best match (the default, relevance order).

## Design system

The visual design matches a Figma file — **light theme only, no dark mode**. All colors are CSS variables on a single `:root` block. Palette: `--bg #f1f1f1`, `--surface #fbfbfb`, `--border #e3e3e3`, `--primary #cd5e69` (rose accent — flat header, section headings, active nav, primary buttons), `--text #515151`, `--muted #a2a2a2`, `--pos #7dad8f` (progress bars). Font is **Inter**, loaded from Google Fonts with a system-font fallback. Card / control radius is `8px` (`--radius`); page side margins are `15px`; rose section headings are `15px` and indented a further `20px` from the page margin (`h2.section`, `.colhd`, `.rowhead h2`, `.panel-sec`). The bottom nav shows an outline icon per tab and swaps to a solid (filled) icon on the active tab.

`applyTheme()` and the `theme` field in `pv4_prefs` are inert remnants of a removed dark mode. A dark theme is a planned future addition — it would slot back in as a `:root.dark` block plus a Settings toggle.

## Cloud sync — the chosen architecture

Optional, **passphrase-based, no accounts**. Backend = a user-owned **Supabase** project.

- **Table** `vault(id text primary key, data text, updated_at timestamptz)`, RLS enabled with one permissive policy for the `anon` role. The app talks to it via the **PostgREST API** (`/rest/v1/vault`) with the anon key — plain `fetch`, no Supabase JS SDK.
- **Client-side encryption** (Web Crypto API): the synced blob (`owned`, `wishlist`, `wishFolders`, `tracked`, `favorites`) is AES-GCM-256 encrypted. The key is derived from the passphrase via PBKDF2 (100k iterations, SHA-256, fixed salt). Row `id` = SHA-256 hex of `"pokevault::" + passphrase`. Stored `data` = base64(`iv[12]` ++ ciphertext). The passphrase never leaves the device; Supabase only ever holds ciphertext.
- **Sync model** — last-write-wins with an offline dirty flag (`pv4_dirty`). On load: if dirty → push local; otherwise → pull remote and adopt it. Edits during a session trigger a debounced (~1.6s) push. Only the collection syncs — the catalog stays local on each device.
- **Functions** — `connectSync`, `disconnectSync`, `syncPull`, `syncPush`, `initSync`, `applyVault`, `encryptBlob` / `decryptBlob`, `vaultId`, `deriveKey`, `scheduleSyncPush`, `syncPanel`. The Settings tab has the full Supabase setup walkthrough built in.
- **Known limitation** — a different or mistyped passphrase silently opens a separate empty vault (inherent to a no-accounts design). The setup text tells the user to use the exact same passphrase everywhere.
- `crypto.subtle` requires a secure context — the app must be opened over https (or `file://`), not plain http.

## Conventions & gotchas

- Top-level `function` declarations are global; `const` arrow helpers are not — relevant if you add a test harness.
- Code parses API responses defensively (optional chaining, fallbacks) because the live APIs cannot be reached from a build sandbox.
- IDs: catalog product IDs and set IDs are numeric; treat them as strings for keying.

## Verifying changes

Development so far has been verified with **jsdom + fake-indexeddb**, mocking the three external services (TCGTracking, Supabase, allorigins) and injecting Node's `webcrypto` for the encryption paths — several hundred assertions across feature additions. Formalizing that into a committed test file/runner is a sensible early step in the repo. There is no build to run.

## Possible next steps

- Sealed-product ROI (link cards pulled to the box they came from)
- A committed automated test suite
- A dark theme — the palette is centralized in one `:root` block, so it slots in as a `:root.dark` block plus a Settings toggle (the `theme` pref and `applyTheme()` hook are still in place)
