# PokéVault TODO

Living backlog. Tag legend: **[P1]** = ship this month, **[P2]** = ship when time, **[P3]** = nice-to-have. Re-prioritize freely; this file is for us, not external.

---

## Tests & infrastructure

- [ ] **[P1] Test harness committed to the repo.** jsdom + fake-indexeddb + Node's `webcrypto`, mocking the three external services (TCGTracking, Supabase, allorigins). ~30-50 assertions covering: `indexCatalog` (grouping by collector number, sealed split, pattern-reverse dedup), `searchCatalog` + `matchScore` ranking, `looksSealed` / `isChaseRarity` / `isHighValueRarity`, sync `encryptBlob`→`decryptBlob` round-trip, JSON export→import round-trip (now including `wishFolders`), `normFolders` defensive behaviour. Why: every edit to a 170KB single-file app is currently unverified. Risk grows with every feature.

## Data / backend

- [ ] **[P1] Catalog as a pre-built static asset.** GitHub Action on a daily cron hits the TCGTracking `/sets` and `/sets/{id}` endpoints, builds a compressed JSON, commits to `gh-pages` (or a `catalog/` dir). Client downloads it on first run instead of making ~250 API calls. Drops first-device-setup from ~1 min to a few seconds. Biggest single multi-device UX win.
- [ ] **[P1] Passphrase fingerprint + empty-vault warning.** Show a 6-char SHA-256 fingerprint of the passphrase under the Connect input — same passphrase → same fingerprint on every device, visual confirmation across devices. Separately, on Connect, check if the vault row exists before adopting; if missing/empty, warn ("This vault is empty — fresh start, or did you mistype?"). Defends against the silent-empty-vault footgun without adding accounts.
- [ ] **[P2] Variant ID stability.** `state.owned[pid][variantName]` uses display strings as keys (`"Reverse Holofoil"`). If TCGTracking renames a variant upstream, owned data silently orphans. Investigate whether the API exposes a stable variant ID; if so, key by that and keep the name as display-only.
- [ ] **[P3] Optional catalog sync via Supabase.** Alternative to the pre-built asset above — sync the catalog blob through the existing Supabase project (gzip + base64, ~5-10MB). Bigger sync payload, simpler infra. Probably skip if the static asset path works.

## Render architecture

- [ ] **[P1] Apply shell/results split to remaining filter inputs.** `fltSetSearch`, `colSetSearch`, `wlSetSearch` (inside the three filter bottom sheets) still re-render their whole panel on each keystroke with the focus-restoration hack. Same fix as commit `2fe3541` for Search and Picker.
- [ ] **[P2] `renderInto(selector, html)` helper + "shell vs. content" as default pattern.** Codify the pattern from Search/Picker so future debounced inputs and animated regions don't fall into the same trap. ~50 lines of helpers + a one-time pass.

## Frontend / UX

- [ ] **[P1] Haptic feedback on check / toggle actions.** `navigator.vibrate(5)` on `own-toggle`, `wl-toggle`, `track-toggle`, and the per-printing `.vtog` taps. Turns the core checklist workflow from look-then-confirm into kinetic. Single highest-ROI UX change.
- [ ] **[P1] Image placeholders / skeleton tiles.** Currently tiles paint as empty boxes until images stream in. Add a neutral background + opacity transition on `<img onload>` so tiles fade in instead of popping. Eliminates layout jank during search results render.
- [ ] **[P1] Android hardware-back closes modals.** Right now (almost certainly) backing out of an open modal exits the app. Standard `history.pushState` + `popstate` pattern on `openModal()` / `closeModal()`. Same approach for the picker / set-detail sub-views.
- [ ] **[P2] Accessibility pass.** `aria-label` on every icon-only button (back chevron, swap, sort, filter, star, heart, badges). Check WCAG AA contrast on `--primary #cd5e69` over `--surface #fbfbfb` (probably borderline). Ensure focus rings are visible on all interactive elements.
- [ ] **[P2] Per-card price sparkline on detail modal.** Reuse `state.history`'s per-product values (`pv`) to draw a 7- or 30-day SVG line on the card detail. Brings the dormant history data back into view and makes the modal feel rich. ~80 lines.
- [ ] **[P2] Responsive grid breakpoints.** `@media (min-width: 600px)` → 4 cols, `(min-width: 900px)` → 5-6 cols for Search and Binder. Currently designed for phone width only.
- [ ] **[P2] Ship dark theme.** Palette is centralized in `:root`; `applyTheme()` + `theme` pref are stubbed. Add a `:root.dark` block + Settings toggle. Either ship it or delete the stubs (currently just clutter signalling unfinished intent).
- [ ] **[P3] Empty states with CTAs.** "Your wishlist is empty — search for a card and tap the heart" instead of a blank pane. Apply to wishlist, folders, collection, tracked sets.
- [ ] **[P3] First-run onboarding.** After "Build card database" completes, a one-screen tip orienting new users / new devices: "Search any card · Track sets for checklists · Tap to add."
- [ ] **[P3] Drag-to-reorder wishlist folders.** Only matters once you have 5+ folders.
- [ ] **[P3] Long-press on tile for context menu.** Quick "mark all printings owned" / "add to folder" without opening the modal. Needs care around mobile scroll interactions.

## Cleanup / dead code

- [ ] **[P2] Resolve `applyTheme()` + `theme` pref.** Ship dark theme (above) or delete the stubs.
- [ ] **[P2] Resolve `loadNews()` + `state.news`.** Dormant since the Figma redesign. Either resurrect a news section or delete the helpers and the `pv` references.
- [ ] **[P2] Resolve `state.history` logging.** Either repurpose for the sparkline (above) and/or a Home sparkline, or stop logging and remove the storage key.
- [ ] **[P3] Audit unused CSS / SVG constants** once the items above settle.

## Future / "possible next steps" from CLAUDE.md

- [ ] **[P3] Sealed-product ROI.** Link cards pulled to the box they came from; show pull-rate / ROI per sealed item.
- [ ] **[P3] Build-step option.** If the file grows past ~5000 lines and editing becomes painful, a 10-line concat script that builds `PokeVault.html` from `src/*.js` + `src/*.css` would preserve the single-file deploy property. Not now.

---

## Completed

- [x] **Include wishlist folders in JSON export/import** — commit `62ce869`.
- [x] **Stop destroying text inputs mid-typing on Search and Picker** — commit `2fe3541`.
- [x] **Faster search filter (cached lowercased fields) + no-cache meta tags for instant deploys** — commit `0a7137d`.
