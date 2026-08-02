import { memoryDb } from '../config/database.js';
import { getTier, tierForScore } from './economy.js';

const FEED_LIMIT = 12;
const SPECIAL_RARITY_KEYS = new Set(['wowa', 'ultra', 'vmax']);
export const COMMUNITY_ACTIVITY_REFRESH_MS = 60_000;

let cachedRevision = -1;
let cachedSnapshot = [];
let cachedSavedCardsByUser = new Map();

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

  const completedSetKeys = new Set();
  cachedSnapshot = memoryDb.getActivities()
    .map(activity => {
      const actor = users.get(activity.actor_id);
      const card = cards.get(activity.card_id);
      if (!actor || actor.banned || !isPublicCollectionCard(card, savedCardIds)) return null;
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
      const tier = getTier(card.tier) || tierForScore(card.rarity_score);
      return {
        id: activity.id,
        type: activity.type,
        signal: activity.signal || null,
        createdAt: activity.created_at,
        actorId: actor.id,
        actor: {
          username: actor.username,
          collectionPath: `/${actor.username}/collection`
        },
        card: {
          id: card.id,
          name: card.name || 'Untitled card',
          creatorId: card.creator_id,
          preview: previewFor(card),
          rarity: {
            key: tier.key,
            name: tier.name,
            color: tier.color,
            special: SPECIAL_RARITY_KEYS.has(tier.key)
          }
        },
        ...(completedSet ? { set: completedSet } : {})
      };
    })
    .filter(Boolean);
  cachedRevision = memoryDb.getCommunityRevision();
};

const ensureSnapshot = () => {
  if (cachedRevision !== memoryDb.getCommunityRevision()) rebuildSnapshot();
  return cachedSnapshot;
};

const record = ({ sourceType, sourceId, actorId, card, type, signal, setId, createdAt }) => {
  if (!sourceId || !actorId || !card) return null;
  const actor = memoryDb.getUserById(actorId);
  if (!actor || actor.banned) return null;
  // Normal published cards need no save scan. Only a cloud card relies on a
  // current collection save to make its otherwise-private record public.
  const savedCardIds = card.creator_id === 'cloud'
    ? new Set(memoryDb.getAllSaves().map(save => save.card_id))
    : new Set();
  if (!isPublicCollectionCard(card, savedCardIds)) return null;
  return memoryDb.createActivity({
    source_type: sourceType,
    source_id: sourceId,
    actor_id: actorId,
    card_id: card.id,
    type,
    signal: signal || null,
    set_id: setId || null,
    created_at: createdAt
  });
};

export const recordCommunitySave = (save, card) => {
  let completedSet = null;
  if (save?.user_id && card?.set_id) {
    const set = memoryDb.getSetById(card.set_id);
    const setCardIds = memoryDb.getAllCards()
      .filter(candidate => candidate.set_id === card.set_id && memoryDb.isCirculating(candidate))
      .map(candidate => candidate.id);
    const ownedIds = new Set(
      memoryDb.getSavesByUser(save.user_id).map(candidate => candidate.card_id)
    );
    if (set && setCardIds.length > 0 && setCardIds.every(cardId => ownedIds.has(cardId))) {
      completedSet = set;
    }
  }

  return record({
    sourceType: 'save',
    sourceId: save?.id,
    actorId: save?.user_id,
    card,
    type: completedSet ? 'set_complete' : 'save',
    setId: completedSet?.id,
    createdAt: save?.created_at
  });
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
  save?.id ? memoryDb.deleteActivityBySource('save', save.id) : null;

export const removeCommunityReaction = (reaction) =>
  reaction?.id ? memoryDb.deleteActivityBySource('signal', reaction.id) : null;

export const getCommunityActivityFeed = (viewerId = null) => {
  const snapshot = ensureSnapshot();
  const savedByViewer = cachedSavedCardsByUser.get(viewerId) || new Set();

  const activities = snapshot
    .filter(activity => activity.actorId !== viewerId)
    .map(activity => {
      const relevance = viewerId && activity.card.creatorId === viewerId
        ? 'created'
        : viewerId && savedByViewer.has(activity.card.id)
          ? 'collected'
          : null;
      return { ...activity, relevance };
    })
    .sort((a, b) => {
      const relevanceRank = { created: 2, collected: 1 };
      const priority = (relevanceRank[b.relevance] || 0) - (relevanceRank[a.relevance] || 0);
      return priority || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    })
    .slice(0, FEED_LIMIT)
    .map(activity => {
      const publicActivity = { ...activity };
      delete publicActivity.actorId;
      publicActivity.card = { ...publicActivity.card };
      delete publicActivity.card.creatorId;
      return publicActivity;
    });

  return { activities, refreshAfterMs: COMMUNITY_ACTIVITY_REFRESH_MS };
};
