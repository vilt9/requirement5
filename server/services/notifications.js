import { memoryDb } from '../config/database.js';
import { ECONOMY, round6 } from './economy.js';

const utcDay = (value = new Date().toISOString()) =>
  new Date(value).toISOString().slice(0, 10);

const utcWeek = (value = new Date().toISOString()) => {
  const date = new Date(value);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const createOnce = (notification) => {
  const existing = memoryDb.getNotificationByGroup(
    notification.recipient_id,
    notification.group_key
  );
  return existing || memoryDb.createNotification(notification);
};

const updateDailyCount = ({ recipientId, type, cardId, day, createdAt, data }) => {
  const groupKey = `${type}:${cardId}:${day}`;
  const existing = memoryDb.getNotificationByGroup(recipientId, groupKey);
  if (!existing) {
    return memoryDb.createNotification({
      recipient_id: recipientId,
      type,
      group_key: groupKey,
      card_id: cardId,
      data,
      created_at: createdAt,
      updated_at: createdAt
    });
  }
  return memoryDb.updateNotification(existing.id, {
    data,
    read_at: null,
    updated_at: createdAt
  });
};

export const recordReactionAdded = (signal, card) => {
  if (!signal || !card) return;

  if (card.creator_id !== signal.user_id && memoryDb.getUserById(card.creator_id)) {
    createOnce({
      recipient_id: card.creator_id,
      type: 'reaction',
      group_key: `reaction:${signal.id}`,
      card_id: card.id,
      actor_id: signal.user_id,
      signal: signal.signal,
      created_at: signal.created_at,
      updated_at: signal.updated_at || signal.created_at
    });
  }

  const day = utcDay(signal.created_at);
  const collectorIds = new Set(
    memoryDb.getAllSaves()
      .filter(save => save.card_id === card.id)
      .map(save => save.user_id)
  );
  for (const recipientId of collectorIds) {
    if (recipientId === signal.user_id || recipientId === card.creator_id) continue;
    const groupKey = `collection_reaction:${card.id}:${day}`;
    const existing = memoryDb.getNotificationByGroup(recipientId, groupKey);
    const counts = { ...(existing?.data?.counts || {}) };
    counts[signal.signal] = (counts[signal.signal] || 0) + 1;
    updateDailyCount({
      recipientId,
      type: 'collection_reaction',
      cardId: card.id,
      day,
      createdAt: signal.created_at,
      data: {
        day,
        counts,
        total: Object.values(counts).reduce((sum, count) => sum + count, 0)
      }
    });
  }
};

export const recordReactionRemoved = (signal, card) => {
  if (!signal || !card) return;
  if (card.creator_id !== signal.user_id) {
    memoryDb.deleteNotificationByGroup(card.creator_id, `reaction:${signal.id}`);
  }

  const groupKey = `collection_reaction:${card.id}:${utcDay(signal.created_at)}`;
  for (const notification of memoryDb.getAllNotifications()) {
    if (notification.group_key !== groupKey) continue;
    const counts = { ...(notification.data?.counts || {}) };
    counts[signal.signal] = Math.max(0, (counts[signal.signal] || 0) - 1);
    if (!counts[signal.signal]) delete counts[signal.signal];
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (!total) {
      memoryDb.deleteNotificationByGroup(notification.recipient_id, groupKey);
    } else {
      memoryDb.updateNotification(notification.id, {
        data: { ...notification.data, counts, total }
      });
    }
  }
};

export const recordSaveCreated = ({ save, card, dividend = 0, sourceUserId = null }) => {
  if (!save || !card) return;
  if (card.creator_id !== save.user_id && memoryDb.getUserById(card.creator_id)) {
    createOnce({
      recipient_id: card.creator_id,
      type: 'save',
      group_key: `save:${save.id}`,
      card_id: card.id,
      actor_id: save.user_id,
      amount: round6(dividend),
      created_at: save.created_at,
      updated_at: save.created_at
    });
  }

  if (!sourceUserId || sourceUserId === save.user_id || sourceUserId === card.creator_id) return;
  const day = utcDay(save.created_at);
  const groupKey = `collection_influence:${card.id}:${day}`;
  const existing = memoryDb.getNotificationByGroup(sourceUserId, groupKey);
  const count = (existing?.data?.count || 0) + 1;
  updateDailyCount({
    recipientId: sourceUserId,
    type: 'collection_influence',
    cardId: card.id,
    day,
    createdAt: save.created_at,
    data: { day, count }
  });
};

export const recordCreatorPublished = (card) => {
  if (!card?.creator_id || card.creator_id === 'cloud') return;
  const recipientIds = new Set();
  for (const save of memoryDb.getAllSaves()) {
    const savedCard = memoryDb.getCardById(save.card_id);
    if (savedCard?.creator_id === card.creator_id && save.user_id !== card.creator_id) {
      recipientIds.add(save.user_id);
    }
  }

  const week = utcWeek(card.created_at || card.updated_at);
  for (const recipientId of recipientIds) {
    const groupKey = `creator_activity:${card.creator_id}:${week}`;
    const existing = memoryDb.getNotificationByGroup(recipientId, groupKey);
    if (existing) {
      memoryDb.updateNotification(existing.id, {
        card_id: card.id,
        actor_id: card.creator_id,
        data: { week }
      });
    } else {
      memoryDb.createNotification({
        recipient_id: recipientId,
        type: 'creator_activity',
        group_key: groupKey,
        card_id: card.id,
        actor_id: card.creator_id,
        data: { week }
      });
    }
  }
};

const syncCreatorHistory = (creatorId) => {
  for (const signal of memoryDb.getSignalsForCreator(creatorId)) {
    const card = memoryDb.getCardById(signal.card_id);
    if (!card) continue;
    createOnce({
      recipient_id: creatorId,
      type: 'reaction',
      group_key: `reaction:${signal.id}`,
      card_id: card.id,
      actor_id: signal.user_id,
      signal: signal.signal,
      read_at: signal.read_at || null,
      created_at: signal.created_at,
      updated_at: signal.updated_at || signal.created_at
    });
  }

  const transactions = memoryDb.getAllTransactions();
  for (const save of memoryDb.getAllSaves()) {
    const card = memoryDb.getCardById(save.card_id);
    if (!card || card.creator_id !== creatorId || save.user_id === creatorId) continue;
    const transaction = transactions.find(txn =>
      txn.user_id === creatorId &&
      txn.type === 'dividend' &&
      txn.card_id === card.id &&
      txn.counterparty_id === save.user_id
    );
    const fallback = round6((Number(save.cost ?? save.value) || 0) * ECONOMY.DIVIDEND_RATE);
    createOnce({
      recipient_id: creatorId,
      type: 'save',
      group_key: `save:${save.id}`,
      card_id: card.id,
      actor_id: save.user_id,
      amount: transaction?.amount ?? fallback,
      created_at: save.created_at,
      updated_at: save.created_at
    });
  }
};

export const getNotificationFeed = (userId) => {
  syncCreatorHistory(userId);
  const notifications = memoryDb.getNotificationsByUser(userId)
    .slice()
    .sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at))
    .slice(0, 60)
    .map(notification => {
      const card = memoryDb.getCardById(notification.card_id);
      if (!card) return null;
      const actor = notification.actor_id?.startsWith('guest:')
        ? null
        : memoryDb.getUserById(notification.actor_id);
      return {
        id: notification.id,
        type: notification.type,
        signal: notification.signal || null,
        amount: notification.amount ?? null,
        data: notification.data || {},
        readAt: notification.read_at,
        createdAt: notification.updated_at || notification.created_at,
        actor: actor?.username || (notification.actor_id?.startsWith('guest:') ? 'Earth visitor' : null),
        actorCollection: actor ? `/${actor.username}/collection` : null,
        card: { id: card.id, name: card.name || 'Untitled card' }
      };
    })
    .filter(Boolean);

  return {
    unread: notifications.filter(notification => !notification.readAt).length,
    notifications
  };
};

export const markNotificationFeedRead = (userId) =>
  memoryDb.markNotificationsRead(userId);
