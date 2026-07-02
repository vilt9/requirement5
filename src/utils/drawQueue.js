// Hand-off between the generate action and the card page. Entries are placed
// here when a card is minted or drawn ahead of time, so /card/:id can render
// WITHOUT waiting on the network:
//   'synthetic'   — a freshly minted uuid; the page generates it from the seed
//                   and skips the existence check (it can't be in the DB yet).
//   <card record> — a pool card prefetched by the draw; render it directly.
// Entries are consumed (deleted) on first use so a later revisit of the same
// URL does a real fetch — the card may have been claimed/saved by then.
export const prefetchedCards = new Map();
