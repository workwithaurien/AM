/**
 * state.js — tiny in-memory store for data fetched during this session.
 * Not persisted; each page decides whether to reuse cached state or refetch.
 */
const State = (() => {
  const store = {};
  return {
    get: k => store[k],
    set: (k, v) => (store[k] = v),
    clear: () => Object.keys(store).forEach(k => delete store[k])
  };
})();
