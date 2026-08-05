import { memoryDb } from '../config/database.js';
import { getTier, round6, tierForScore } from './economy.js';
import { issue } from './ledger.js';

const FEED_LIMIT = 12;
const SPECIAL_RARITY_KEYS = new Set(['galaxy', 'wowa', 'ultra', 'vmax']);
export const COMMUNITY_ACTIVITY_REFRESH_MS = 30_000;
const SYNTHETIC_CARD_LIMIT = 120;
const SYNTHETIC_USER_COUNT = 144;
const SYNTHETIC_INTERVAL_MS = 17 * 60 * 1000;

const ordinal = (n) => {
  const value = Number(n) || 0;
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
};

const fnv1a = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = (items, rand) => items[Math.floor(rand() * items.length) % items.length];

const normal01 = (rand) => {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export const communityRewardFor = (seed) => {
  const rand = mulberry32(fnv1a(`r5c:society-reward:v1:${seed}`));
  const base = Math.exp(Math.log(0.075) + 0.28 * normal01(rand));
  const tailGate = rand();
  const tail = tailGate > 0.985
    ? 1.15 + Math.pow(rand(), 0.35) * 1.85
    : tailGate > 0.91
      ? Math.pow(rand(), 0.45) * 0.55
      : 0;
  return round6(Math.min(3.25, Math.max(0.018, base + tail)));
};

const rewardActivity = (activity) => {
  if (!activity?.id || !activity.actor_id) return null;
  const duplicate = memoryDb.getAllTransactions().some(txn =>
    txn.type === 'society_reward' && txn.activity_id === activity.id
  );
  if (duplicate) return null;
  const amount = communityRewardFor(`${activity.source_type}:${activity.source_id}:${activity.type}`);
  return issue(activity.actor_id, 'society_reward', amount, {
    activity_id: activity.id,
    source_type: activity.source_type,
    source_id: activity.source_id
  });
};

let cachedRevision = -1;
let cachedSnapshot = [];
let cachedSavedCardsByUser = new Map();
let cachedSyntheticCards = [];

const safeString = (value, maxLength) => {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean && clean.length <= maxLength ? clean : null;
};

const previewFor = (card) => {
  const state = card?.state_data?.customCard || card?.state_data || {};
  const rawImagePath = safeString(state.imagePath, 512);
  const imagePath = rawImagePath === 'custom_image' || rawImagePath === 'default' ||
    /^[a-z0-9_-]+\.(?:avif|gif|jpe?g|png|webp)$/i.test(rawImagePath || '')
    ? rawImagePath
    : null;
  const rawCustomImageUrl = safeString(state.customImageUrl, 2048);
  const customImageUrl = /^(?:https?:\/\/|\/uploads\/)/i.test(rawCustomImageUrl || '')
    ? rawCustomImageUrl
    : null;
  const rawBackgroundColor = safeString(state.backgroundColor, 120);
  return {
    imagePath,
    customImageUrl,
    backgroundColor: /^#[0-9a-f]{3,8}$/i.test(rawBackgroundColor || '')
      ? rawBackgroundColor
      : null
  };
};

const publicCardSummary = (card) => {
  const tier = getTier(card.tier) || tierForScore(card.rarity_score);
  return {
    id: card.id,
    name: card.name || 'Untitled card',
    creatorId: card.creator_id,
    preview: previewFor(card),
    rarity: {
      key: tier.key,
      name: tier.name,
      color: tier.color,
      special: SPECIAL_RARITY_KEYS.has(tier.key)
    },
    setId: card.set_id || null,
    rarityScore: Number(card.rarity_score) || 0
  };
};

const isPublicCollectionCard = (card, savedCardIds) =>
  memoryDb.isCirculating(card) || (
    card?.creator_id === 'cloud' &&
    card.moderation_status !== 'flagged' &&
    card.moderation_status !== 'removed' &&
    savedCardIds.has(card.id)
  );

const rebuildSnapshot = () => {
  const users = new Map(memoryDb.getAllUsers().map(user => [user.id, user]));
  const cards = new Map(memoryDb.getAllCards().map(card => [card.id, card]));
  const sets = new Map(memoryDb.getAllSets().map(set => [set.id, set]));
  const saves = memoryDb.getAllSaves();
  const rewardsByActivity = new Map(
    memoryDb.getAllTransactions()
      .filter(txn => txn.type === 'society_reward' && txn.activity_id)
      .map(txn => [txn.activity_id, { amount: txn.amount }])
  );
  const savedCardIds = new Set(saves.map(save => save.card_id));
  const cardIdsBySet = new Map();
  for (const card of cards.values()) {
    if (!card.set_id || !memoryDb.isCirculating(card)) continue;
    const cardIds = cardIdsBySet.get(card.set_id) || [];
    cardIds.push(card.id);
    cardIdsBySet.set(card.set_id, cardIds);
  }
  cachedSavedCardsByUser = new Map();
  for (const save of saves) {
    const cardIds = cachedSavedCardsByUser.get(save.user_id) || new Set();
    cardIds.add(save.card_id);
    cachedSavedCardsByUser.set(save.user_id, cardIds);
  }
  cachedSyntheticCards = [...cards.values()]
    .filter(card => memoryDb.isCirculating(card))
    .sort((a, b) => {
      const recent = String(b.created_at || '').localeCompare(String(a.created_at || ''));
      return recent || String(a.id).localeCompare(String(b.id));
    })
    .slice(0, SYNTHETIC_CARD_LIMIT)
    .map(publicCardSummary);

  const completedSetKeys = new Set();
  cachedSnapshot = memoryDb.getActivities()
    .map(activity => {
      const actor = users.get(activity.actor_id);
      if (!actor || actor.banned) return null;
      if (activity.type === 'signup') {
        return {
          id: activity.id,
          type: activity.type,
          createdAt: activity.created_at,
          reward: rewardsByActivity.get(activity.id) || null,
          actorId: actor.id,
          actor: {
            username: actor.username,
            collectionPath: `/${actor.username}/collection`
          }
        };
      }
      const card = cards.get(activity.card_id);
      if (!isPublicCollectionCard(card, savedCardIds)) return null;
      let completedSet = null;
      if (activity.type === 'set_complete') {
        const set = sets.get(activity.set_id);
        const setCardIds = cardIdsBySet.get(activity.set_id) || [];
        const actorCardIds = cachedSavedCardsByUser.get(actor.id) || new Set();
        const complete = set && setCardIds.length > 0 &&
          setCardIds.every(cardId => actorCardIds.has(cardId));
        const dedupeKey = `${actor.id}:${activity.set_id}`;
        if (!complete || completedSetKeys.has(dedupeKey)) return null;
        completedSetKeys.add(dedupeKey);
        completedSet = { id: set.id, label: set.label, total: setCardIds.length };
      }
      return {
        id: activity.id,
        type: activity.type,
        signal: activity.signal || null,
        saveCount: activity.save_count || null,
        saveOrdinal: activity.save_count ? ordinal(activity.save_count) : null,
        createdAt: activity.created_at,
        reward: rewardsByActivity.get(activity.id) || null,
        actorId: actor.id,
        actor: {
          username: actor.username,
          collectionPath: `/${actor.username}/collection`
        },
        card: publicCardSummary(card),
        ...(completedSet ? { set: completedSet } : {})
      };
    })
    .filter(Boolean);
  cachedRevision = memoryDb.getCommunityRevision();
};

const syntheticUsername = (index) => {
  const first = [
    'Moss', 'Velvet', 'Static', 'Ivory', 'Paper', 'Amber', 'Sable', 'Chrome',
    'Lunar', 'Fern', 'Copper', 'Signal'
  ];
  const second = [
    'Archivist', 'Memento', 'Rabbit', 'Lantern', 'Mosaic', 'Relic', 'Threshold', 'Vessel',
    'Comet', 'Oracle', 'Figment', 'Weather'
  ];
  return `${first[index % first.length]}${second[Math.floor(index / first.length) % second.length]}${index + 1}`;
};

const syntheticActivityFor = (seed, index, viewerId, usedCardIds = new Set()) => {
  if (!cachedSyntheticCards.length) return null;
  const rand = mulberry32(fnv1a(`${seed}:${index}`));
  const cardPool = cachedSyntheticCards.filter(card => !usedCardIds.has(card.id));
  const card = pick(cardPool.length ? cardPool : cachedSyntheticCards, rand);
  if (!card) return null;
  usedCardIds.add(card.id);
  const username = syntheticUsername(Math.floor(rand() * SYNTHETIC_USER_COUNT));
  const typeRoll = rand();
  const syntheticType = card.rarity.special && typeRoll > 0.45
    ? 'set_rarest'
    : typeRoll > 0.18
      ? 'save'
      : 'reaction';
  const signal = syntheticType === 'reaction'
    ? pick(['flame', 'sparkle', 'scan', 'trophy', 'rare'], rand)
    : null;
  const ageMs = (2 + index * 3 + Math.floor(rand() * 4)) * 60 * 1000;
  return {
    id: `synthetic:${seed}:${index}:${card.id}`,
    synthetic: true,
    type: syntheticType,
    signal,
    createdAt: new Date(Date.now() - ageMs).toISOString(),
    actor: {
      username,
      collectionPath: null
    },
    card: { ...card },
    relevance: null
  };
};

const ambientActivitiesFor = (viewerId, realActivities) => {
  const seed = `${viewerId || 'public'}:${Math.floor(Date.now() / SYNTHETIC_INTERVAL_MS)}:${realActivities[0]?.id || 'quiet'}`;
  const usedCardIds = new Set(realActivities.map(activity => activity.card?.id).filter(Boolean));
  return Array.from({ length: FEED_LIMIT }, (_, index) =>
    syntheticActivityFor(seed, index, viewerId, usedCardIds)
  ).filter(Boolean);
};

const interleaveAmbient = (activities, ambient) => {
  if (!ambient.length) return activities.slice(0, FEED_LIMIT);
  const mixed = [];
  let ambientIndex = 0;
  for (const activity of activities) {
    mixed.push(activity);
    const lonely = activity.relevance === 'you' || (
      mixed.length >= 2 &&
      mixed.slice(-2).every(item => item.relevance === 'you')
    );
    if ((lonely || mixed.length % 3 === 2) && ambient[ambientIndex]) {
      mixed.push(ambient[ambientIndex++]);
    }
  }
  while (mixed.length < FEED_LIMIT && ambient[ambientIndex]) {
    mixed.push(ambient[ambientIndex++]);
  }
  return mixed.slice(0, FEED_LIMIT);
};

const ensureSnapshot = () => {
  if (cachedRevision !== memoryDb.getCommunityRevision()) rebuildSnapshot();
  return cachedSnapshot;
};

const record = ({ sourceType, sourceId, actorId, card, type, signal, setId, saveCount, createdAt }) => {
  if (!sourceId || !actorId || !card) return null;
  const actor = memoryDb.getUserById(actorId);
  if (!actor || actor.banned) return null;
  // Normal published cards need no save scan. Only a cloud card relies on a
  // current collection save to make its otherwise-private record public.
  const savedCardIds = card.creator_id === 'cloud'
    ? new Set(memoryDb.getAllSaves().map(save => save.card_id))
    : new Set();
  if (!isPublicCollectionCard(card, savedCardIds)) return null;
  const activity = memoryDb.createActivity({
    source_type: sourceType,
    source_id: sourceId,
    actor_id: actorId,
    card_id: card.id,
    type,
    signal: signal || null,
    set_id: setId || null,
    save_count: saveCount || null,
    created_at: createdAt
  });
  rewardActivity(activity);
  return activity;
};

export const recordCommunitySave = (save, card) => {
  let completedSet = null;
  let rarestInSet = false;
  if (save?.user_id && card?.set_id) {
    const set = memoryDb.getSetById(card.set_id);
    const setCards = memoryDb.getAllCards()
      .filter(candidate => candidate.set_id === card.set_id && memoryDb.isCirculating(candidate));
    const setCardIds = setCards.map(candidate => candidate.id);
    const ownedIds = new Set(
      memoryDb.getSavesByUser(save.user_id).map(candidate => candidate.card_id)
    );
    if (set && setCardIds.length > 0 && setCardIds.every(cardId => ownedIds.has(cardId))) {
      completedSet = set;
    }
    const topScore = Math.max(...setCards.map(candidate => Number(candidate.rarity_score) || 0));
    const topCards = setCards.filter(candidate => (Number(candidate.rarity_score) || 0) === topScore);
    rarestInSet = setCards.length > 1 && topCards.length === 1 && topCards[0].id === card.id;
  }

  const primary = record({
    sourceType: 'save',
    sourceId: save?.id,
    actorId: save?.user_id,
    card,
    type: completedSet ? 'set_complete' : 'save',
    setId: completedSet?.id,
    saveCount: card?.times_saved && card.times_saved <= 3 ? card.times_saved : null,
    createdAt: save?.created_at
  });
  if (rarestInSet) {
    record({
      sourceType: 'set_rarest_save',
      sourceId: save?.id,
      actorId: save?.user_id,
      card,
      type: 'set_rarest',
      setId: card.set_id,
      createdAt: save?.created_at
    });
  }
  return primary;
};

export const recordCommunityReaction = (reaction, card) => record({
  sourceType: 'signal',
  sourceId: reaction?.id,
  actorId: reaction?.user_id,
  card,
  type: 'reaction',
  signal: reaction?.signal,
  createdAt: reaction?.created_at
});

export const removeCommunitySave = (save) =>
  save?.id ? [
    memoryDb.deleteActivityBySource('save', save.id),
    memoryDb.deleteActivityBySource('set_rarest_save', save.id)
  ].find(Boolean) || null : null;

export const removeCommunityReaction = (reaction) =>
  reaction?.id ? memoryDb.deleteActivityBySource('signal', reaction.id) : null;

export const recordCommunitySignup = (user) => {
  if (!user?.id || user.banned) return null;
  const activity = memoryDb.createActivity({
    source_type: 'signup',
    source_id: user.id,
    actor_id: user.id,
    card_id: null,
    type: 'signup',
    created_at: user.created_at
  });
  rewardActivity(activity);
  return activity;
};

export const getCommunityActivityFeed = (viewerId = null) => {
  const snapshot = ensureSnapshot();
  const savedByViewer = cachedSavedCardsByUser.get(viewerId) || new Set();

  const realActivities = snapshot
    .map(activity => {
      const relevance = viewerId && activity.actorId === viewerId
        ? 'you'
        : viewerId && activity.card?.creatorId === viewerId
        ? 'created'
        : viewerId && savedByViewer.has(activity.card?.id)
          ? 'collected'
          : null;
      return { ...activity, relevance };
    })
    .sort((a, b) => {
      const relevanceRank = { you: 3, created: 2, collected: 1 };
      const priority = (relevanceRank[b.relevance] || 0) - (relevanceRank[a.relevance] || 0);
      return priority || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    })
    .slice(0, FEED_LIMIT);

  const activities = interleaveAmbient(realActivities, ambientActivitiesFor(viewerId, realActivities))
    .map(activity => {
      const publicActivity = { ...activity };
      delete publicActivity.actorId;
      if (publicActivity.card) {
        publicActivity.card = { ...publicActivity.card };
        delete publicActivity.card.creatorId;
        delete publicActivity.card.setId;
        delete publicActivity.card.rarityScore;
      }
      return publicActivity;
    });

  return { activities, refreshAfterMs: COMMUNITY_ACTIVITY_REFRESH_MS };
};
