import { memoryDb } from '../config/database.js';

export const GLOBAL_POSITION_LIMIT = 18;
export const SOURCE_POSITION_LIMIT = 8;
export const GRID_PAGE_SIZE = 200;
export const GRID_MAX_PAGE_SIZE = 250;

const scoreOf = (card) => {
  const score = Number(card?.rarity_score);
  return Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0;
};

const byRarity = (a, b) =>
  scoreOf(b) - scoreOf(a) || String(a.id).localeCompare(String(b.id));

const rankedCollectionCards = (cards) => cards
  .filter(candidate =>
    memoryDb.isCirculating(candidate) ||
    (candidate.creator_id === 'cloud' &&
      candidate.moderation_status !== 'flagged' &&
      candidate.moderation_status !== 'removed'))
  .sort(byRarity);

let gridRankCache = { revision: -1, cards: [] };
const rankedGridCards = () => {
  const revision = memoryDb.getCardsRevision();
  if (gridRankCache.revision !== revision) {
    gridRankCache = {
      revision,
      cards: rankedCollectionCards(memoryDb.getAllCards())
    };
  }
  return gridRankCache.cards;
};

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
    current: !!currentId && card.id === currentId,
    ...(owned ? { card: thumbnailCard(card) } : {})
  };
};

const sourceDefinition = ({ type, id, label, cards, ownedIds }) => ({
  type,
  id,
  label,
  total: cards.length,
  collected: cards.reduce((count, candidate) =>
    count + (ownedIds.has(candidate.id) ? 1 : 0), 0),
  cards
});

const sourceMeta = (source) => ({
  type: source.type,
  id: source.id,
  label: source.label,
  total: source.total,
  collected: source.collected
});

const pageBounds = (cursor, limit) => {
  const start = Math.max(0, Number.parseInt(cursor, 10) || 0);
  const requested = Number.parseInt(limit, 10) || GRID_PAGE_SIZE;
  return {
    start,
    limit: Math.max(1, Math.min(GRID_MAX_PAGE_SIZE, requested))
  };
};

const pageSlots = (cards, ownedIds, cursor, limit) => {
  const bounds = pageBounds(cursor, limit);
  const visible = cards.slice(bounds.start, bounds.start + bounds.limit);
  const end = bounds.start + visible.length;
  return {
    cards: visible.map((card, index) =>
      positionSlot(card, bounds.start + index + 1, ownedIds)),
    nextCursor: end < cards.length ? end : null
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
  const ranked = rankedCollectionCards(allCards);

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

const ownedCreatorIdsFor = (ranked, ownedIds) => new Set(
  ranked
    .filter(card => ownedIds.has(card.id) && card.creator_id && card.creator_id !== 'cloud')
    .map(card => card.creator_id)
);

const buildSourceCatalogue = (ranked, ownedIds) => {
  const ownedCreatorIds = ownedCreatorIdsFor(ranked, ownedIds);
  if (!ownedCreatorIds.size) return [];

  const usersById = new Map(memoryDb.getAllUsers().map(user => [user.id, user]));
  const setsById = new Map(memoryDb.getAllSets().map(set => [set.id, set]));
  const buckets = new Map(
    [...ownedCreatorIds].map(creatorId => [
      creatorId,
      { ungrouped: [], sets: new Map() }
    ])
  );

  // `ranked` is already in rarity order, so appending here leaves every
  // resulting source row sorted without another per-source sort.
  for (const card of ranked) {
    const bucket = buckets.get(card.creator_id);
    if (!bucket) continue;
    const set = card.set_id ? setsById.get(card.set_id) : null;
    if (!set) {
      bucket.ungrouped.push(card);
      continue;
    }
    if (!bucket.sets.has(set.id)) bucket.sets.set(set.id, { set, cards: [] });
    bucket.sets.get(set.id).cards.push(card);
  }

  return [...buckets.entries()]
    .map(([creatorId, bucket]) => {
      const creator = usersById.get(creatorId);
      if (!creator) return null;

      const sources = [...bucket.sets.values()]
        .map(({ set, cards }) => sourceDefinition({
          type: 'set',
          id: set.id,
          label: set.label,
          cards,
          ownedIds
        }));

      if (bucket.ungrouped.length) {
        sources.push(sourceDefinition({
          type: 'creator',
          id: creator.id,
          label: creator.username,
          cards: bucket.ungrouped,
          ownedIds
        }));
      }

      sources.sort((a, b) =>
        b.collected - a.collected || a.label.localeCompare(b.label));
      const total = sources.reduce((sum, source) => sum + source.total, 0);
      const collected = sources.reduce((sum, source) => sum + source.collected, 0);

      return {
        id: creator.id,
        label: creator.username,
        total,
        collected,
        sources
      };
    })
    .filter(Boolean)
    .sort((a, b) =>
      b.collected - a.collected || a.label.localeCompare(b.label));
};

const gridContext = (userId) => {
  const ranked = rankedGridCards();
  const saves = userId ? memoryDb.getSavesByUser(userId) : [];
  const ownedIds = new Set(saves.map(save => save.card_id));
  return { ranked, ownedIds };
};

// The menu-level grid is the expanded version of the post-save receipt. The
// global ladder is cursor-paged; creator/set rows return metadata only and are
// fetched independently as they approach the viewport. Unknown card designs
// are never included in the response.
export const buildCollectionGrid = (
  userId = null,
  { cursor = 0, limit = GRID_PAGE_SIZE } = {}
) => {
  const { ranked, ownedIds } = gridContext(userId);
  const page = pageSlots(ranked, ownedIds, cursor, limit);
  // Catalogue metadata is invariant across later global pages, so only the
  // first response pays to construct it.
  const catalogue = pageBounds(cursor, limit).start === 0
    ? buildSourceCatalogue(ranked, ownedIds)
    : [];
  const collected = ranked.reduce((count, card) =>
    count + (ownedIds.has(card.id) ? 1 : 0), 0);

  return {
    global: {
      total: ranked.length,
      collected,
      cards: page.cards,
      nextCursor: page.nextCursor
    },
    creators: catalogue.map(creator => ({
      ...creator,
      sources: creator.sources.map(sourceMeta)
    }))
  };
};

// Fetch one source row only after its heading nears the viewport. The source
// must belong to a creator already unlocked by this viewer's collection.
export const buildCollectionGridSource = (
  userId,
  { type, id, cursor = 0, limit = GRID_PAGE_SIZE } = {}
) => {
  if (!userId || !type || !id) return null;
  const { ranked, ownedIds } = gridContext(userId);
  const ownedCreatorIds = ownedCreatorIdsFor(ranked, ownedIds);
  const sets = memoryDb.getAllSets();
  const setIds = new Set(sets.map(set => set.id));
  let source = null;

  if (type === 'set') {
    const set = sets.find(candidate => candidate.id === id);
    if (!set || !ownedCreatorIds.has(set.owner_id)) return null;
    source = sourceDefinition({
      type,
      id: set.id,
      label: set.label,
      cards: ranked.filter(card => card.set_id === set.id),
      ownedIds
    });
  } else if (type === 'creator' && ownedCreatorIds.has(id)) {
    const creator = memoryDb.getAllUsers().find(candidate => candidate.id === id);
    if (!creator) return null;
    source = sourceDefinition({
      type,
      id: creator.id,
      label: creator.username,
      cards: ranked.filter(card =>
        card.creator_id === creator.id && !setIds.has(card.set_id)),
      ownedIds
    });
  }

  if (!source || !source.cards.length) return null;

  const page = pageSlots(source.cards, ownedIds, cursor, limit);
  return {
    ...sourceMeta(source),
    cards: page.cards,
    nextCursor: page.nextCursor
  };
};
