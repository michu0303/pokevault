# PokéVault

A personal Pokémon TCG collection tracker — one self-contained HTML file. Browse sets, check off the cards you own, track sealed products, keep a wishlist, see what your collection is worth, and optionally sync everything across your devices.

No build step, no framework, no dependencies. Open the file in any browser — it's mobile-first and works great on a phone.

## Features

- **Sets & binder view** — track set completion; flip through cards in a 3×3 or 4×3 binder layout, tap a card to zoom
- **Per-printing tracking** — tap-to-check for everyday cards; quantity steppers for ex / chase cards and sealed products
- **Card grouping** — finish and pattern variants (reverse holo, Poké Ball, Master Ball, energy patterns…) that share a collector number group under one card
- **Sealed products** — tracked in their own section
- **Collection & worth** — owned cards sorted by value, with a rarity filter
- **Wishlist** — flag cards to look for at card shows, with current prices
- **Home dashboard** — collection worth, a value trend, your pinned sets, newest sets, and Pokémon TCG news
- **Light / dark theme**
- **Cloud sync** — optional, passphrase-based, encrypted on-device (see below)

## Getting started

Open `PokeVault.html` in a browser. On first run, tap **Build card database** — it downloads the Pokémon catalog (~30k cards and sealed products) into the browser so search and browsing are instant and work offline. You do this once per device.

To use it on more than one device, host the file at a stable URL — drag it into [Netlify Drop](https://app.netlify.com/drop), or enable **GitHub Pages** on this repo — then open that URL on each device.

## Cloud sync (optional)

Sync your collection across devices with a passphrase. Your data is **encrypted on your device** before upload, so the server only ever stores an encrypted blob. The backend is a free [Supabase](https://supabase.com) project.

One-time setup:

1. Create a free Supabase project.
2. In the project's **SQL Editor**, run the snippet below.
3. In **Project Settings → API**, copy the **Project URL** and the **anon public key**.
4. In PokéVault: **Settings → Cloud sync** — paste the URL, the key, and a passphrase, then Connect.
5. On other devices, enter the same URL, key, and passphrase.

```sql
create table if not exists vault (
  id text primary key,
  data text,
  updated_at timestamptz default now()
);
alter table vault enable row level security;
drop policy if exists "pv" on vault;
create policy "pv" on vault for all to anon using (true) with check (true);
grant all on table vault to anon;
notify pgrst, 'reload schema';
```

Use the exact same passphrase everywhere — there are no accounts, so a different passphrase opens a different (empty) vault. The passphrase is the only key, and there's no recovery if it's lost. The JSON export in Settings is a separate backup.

## Data & privacy

- The card catalog lives in the browser's IndexedDB; your collection lives in localStorage.
- Card data and prices come from the [TCGTracking Open TCG API](https://tcgtracking.com/tcgapi/) — no key required.
- News headlines come from PokéBeach via a public CORS relay (best-effort).
- With cloud sync on, your collection is AES-GCM encrypted client-side; the passphrase never leaves your device.
- Not affiliated with Nintendo or The Pokémon Company.

## Project files

- `PokeVault.html` — the entire app
- `CLAUDE.md` — architecture and technical notes for continued development
- `README.md` — this file
