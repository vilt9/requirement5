import { memoryDb } from '../config/database.js';

export const GLOBAL_POSITION_LIMIT = 18;
export const SOURCE_POSITION_LIMIT = 8;

const scoreOf = (card) => {
  const score = Number(card?.rarity_score);
  return Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0;
};

const byRarity = (a, b) =>
  scoreOf(b) - scoreOf(a) || String(a.id).localeCompare(String(b.id));

// Only data needed to paint an owned thumbnail. Unknown cards deliberately do
// not leak their name, id or design through the collection-position response.
const thumbnailCard = (card) => ({
  id: card.id,
  name: card.name,
  rarity_score: card.rarity_score,
  state_data: card.state_data
});

const windowAround = (cards, cardId, limit, before) => {
  if (cards.length <= limit) return cards;
  const index = Math.max(0, cards.findIndex(card => card.id === cardId));
  const start = Math.max(0, Math.min(index - before, cards.length - limit));
  return cards.slice(start, start + limit);
};

const positionSlot = (card, position, ownedIds, currentId) => {
  const owned = ownedIds.has(card.id);
  return {
    position,
    rarity: scoreOf(card),
    owned,
    current: card.id === currentId,
    ...(owned ? { card: thumbnailCard(card) } : {})
  };
};
// Build the post-save collection view with a fixed number of store reads:
// one card snapshot, one user-save snapshot, and at most one set/user lookup.
// The production store is hydrated into memory at startup, so this performs
// zero Postgres queries and never looks up a card from inside a loop.
export const buildCollectionPosition = (card, userId) => {
  if (!card || !userId) return null;

  const allCards = memoryDb.getAllCards();
  const saves = memoryDb.getSavesByUser(userId);
  const ownedIds = new Set(saves.map(save => save.card_id));

  // Rank cards that can legitimately be encountered and saved: public cards
  // currently in circulation plus claimed synthetic draws. Private drafts are
  // omitted; a creator's unfinished work is not part of the collection ladder.
  const ranked = allCards
    .filter(candidate =>
      memoryDb.isCirculating(candidate) ||
      (candidate.creator_id === 'cloud' &&
        candidate.moderation_status !== 'flagged' &&
        candidate.moderation_status !== 'removed'))
    .sort(byRarity);

  // A just-saved record should already be present. Keep this defensive insert
  // so a future storage adapter cannot produce a receipt with no current slot.
  if (!ranked.some(candidate => candidate.id === card.id)) {
    ranked.push(card);
    ranked.sort(byRarity);
  }

  const rankIndex = ranked.findIndex(candidate => candidate.id === card.id);
  const globalCards = windowAround(ranked, card.id, GLOBAL_POSITION_LIMIT, 8);
  const globalStart = ranked.indexOf(globalCards[0]);

  let source = null;
  let sourceCards = [];
  let sourceMeta = null;

  if (card.set_id) {
    const set = memoryDb.getSetById(card.set_id);
    if (set) {
      sourceCards = allCards
        .filter(candidate => candidate.set_id === card.set_id && memoryDb.isCirculating(candidate))
        .sort(byRarity);
      sourceMeta = { type: 'set', id: set.id, label: set.label };
    }
  }

  // A card with no usable set falls back to its creator. Cloud-generated cards
  // have no finite creator catalogue, so they intentionally get no source row.
  if (!sourceMeta && card.creator_id && card.creator_id !== 'cloud') {
    const creator = memoryDb.getUserById(card.creator_id);
    if (creator) {
      sourceCards = allCards
        .filter(candidate => candidate.creator_id === card.creator_id && memoryDb.isCirculating(candidate))
        .sort(byRarity);
      sourceMeta = { type: 'creator', id: creator.id, label: creator.username };
    }
  }

  if (sourceMeta && sourceCards.length) {
    const visibleSource = windowAround(sourceCards, card.id, SOURCE_POSITION_LIMIT, 2);
    const sourceStart = sourceCards.indexOf(visibleSource[0]);
    source = {
      ...sourceMeta,
      total: sourceCards.length,
      collected: sourceCards.reduce((count, candidate) =>
        count + (ownedIds.has(candidate.id) ? 1 : 0), 0),
      cards: visibleSource.map((candidate, index) =>
        positionSlot(candidate, sourceStart + index + 1, ownedIds, card.id))
    };
  }

  return {
    global: {
      rank: rankIndex + 1,
      total: ranked.length,
      cards: globalCards.map((candidate, index) =>
        positionSlot(candidate, globalStart + index + 1, ownedIds, card.id))
    },
    source
  };
};
