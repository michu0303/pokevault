// A tiny observable store. Views subscribe; mutations go through update(),
// which persists the touched slices and notifies subscribers with the set
// of changed keys. No framework.
import { save } from "./storage.js";
import { prunePrices } from "./pricing.js";

export function createStore(initial, { ls = globalThis.localStorage, onDirty } = {}) {
  const listeners = new Set();
  const state = initial;
  const persist = {
    owned: () => { save.owned(state.owned, ls); save.prices(prunePrices(state.flatPrices, state.owned, state.wishlist), ls); dirty(); },
    wishlist: () => { save.wishlist(state.wishlist, ls); save.prices(prunePrices(state.flatPrices, state.owned, state.wishlist), ls); dirty(); },
    wishFolders: () => { save.wishFolders(state.wishFolders, ls); dirty(); },
    tracked: () => { save.tracked(state.tracked, ls); dirty(); },
    favorites: () => { save.favorites(state.favorites, ls); dirty(); },
    flatPrices: () => save.prices(prunePrices(state.flatPrices, state.owned, state.wishlist), ls),
    setDates: () => save.setDates(state.setDates, ls),
    prefs: () => save.prefs(state.prefs, ls),
    history: () => { state.history = save.history(state.history, ls); },
    catalogMeta: () => save.catalogMeta(state.catalogMeta, ls),
    sync: () => save.sync(state.sync, ls),
  };
  function dirty() { state.dirty = true; save.dirty(true, ls); if (onDirty) onDirty(); }
  function emit(changed) { for (const fn of listeners) { try { fn(state, changed); } catch (e) { console.error(e); } } }
  return {
    state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** update(fn, ...keys): fn mutates state; keys name the slices to persist + announce */
    update(fn, ...keys) {
      fn(state);
      for (const k of keys) if (persist[k]) persist[k]();
      emit(new Set(keys));
    },
    /** announce a change without persisting (UI-only state) */
    touch(...keys) { emit(new Set(keys)); },
    clearDirty() { state.dirty = false; save.dirty(false, ls); },
  };
}
