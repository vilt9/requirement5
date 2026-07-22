import process from 'node:process';
import { memoryDb } from '../config/database.js';
import User, { normalizeReservedUsername, publicUser } from '../models/User.js';
import { issue } from './ledger.js';
import { round6 } from './economy.js';
import { setNameFor } from '../utils/setName.js';

const MAX_CARDS_PER_HANDOFF = 20;

export class HandoffError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'HandoffError';
    this.status = status;
  }
}

const claimBase = () => (
  process.env.APP_URL || process.env.API_URL || 'http://localhost:5173'
).replace(/\/$/, '');

const validateCardIds = (cardIds) => {
  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    throw new HandoffError('At least one card id is required');
  }
  if (cardIds.length > MAX_CARDS_PER_HANDOFF) {
    throw new HandoffError(`A handoff may contain at most ${MAX_CARDS_PER_HANDOFF} cards`);
  }
  const ids = cardIds.map(id => String(id || '').trim());
  if (ids.some(id => !id)) throw new HandoffError('Card ids must be non-empty strings');
  if (new Set(ids).size !== ids.length) throw new HandoffError('Card ids must be unique');
  return ids;
};

const validateOpeningBalance = (openingBalance, maximum) => {
  const balance = Number(openingBalance);
  if (!Number.isFinite(balance) || balance < 0) {
    throw new HandoffError('openingBalance must be a non-negative number');
  }
  if (balance > maximum) {
    throw new HandoffError(`openingBalance exceeds the operator maximum of ${maximum} /t26`);
  }
  return round6(balance);
};

// Transfer a reviewed group of studio cards into a reserved account. All
// validation happens before the synchronous atomic mutation, so callers never
// observe a partially-created account or a half-transferred set.
export const createHandoff = ({ username: requestedUsername, openingBalance, cardIds }, operator) => {
  const username = normalizeReservedUsername(requestedUsername);
  const balance = validateOpeningBalance(openingBalance, operator.maxOpeningBalance);
  const ids = validateCardIds(cardIds);
  const studio = memoryDb.getUserByUsername(operator.studioUsername);
  if (!studio) throw new HandoffError('Configured studio account does not exist', 503);
  if (studio.username.toLowerCase() === username) {
    throw new HandoffError('Destination username must differ from the studio account');
  }

  const existingTarget = memoryDb.getUserByUsername(username);
  if (existingTarget && (existingTarget.claimed_at || !existingTarget.bot_created)) {
    throw new HandoffError('Username is already in use', 409);
  }
  if (existingTarget?.opening_balance != null && existingTarget.opening_balance !== balance) {
    throw new HandoffError(
      `Account was already prepared with an opening balance of ${existingTarget.opening_balance} /t26`,
      409
    );
  }

  const cards = ids.map((id) => {
    const card = memoryDb.getCardById(id);
    if (!card) throw new HandoffError(`Card not found: ${id}`, 404);
    return card;
  });
  const allowedOwners = new Set([studio.id, existingTarget?.id].filter(Boolean));
  for (const card of cards) {
    if (!allowedOwners.has(card.creator_id)) {
      throw new HandoffError(`Card is not owned by the studio account: ${card.id}`, 409);
    }
    if (card.moderation_status === 'flagged' || card.moderation_status === 'removed') {
      throw new HandoffError(`Card is not eligible for handoff: ${card.id}`, 409);
    }
    if (memoryDb.getAllSaves().some(save => save.card_id === card.id)) {
      throw new HandoffError(`Card already has a collector and cannot be handed off: ${card.id}`, 409);
    }
    if (card.creator_id === studio.id && card.set_id) {
      const set = memoryDb.getSetById(card.set_id);
      if (set && set.owner_id !== studio.id) {
        throw new HandoffError(`Card belongs to a set not owned by the studio: ${card.id}`, 409);
      }
    }
  }

  return memoryDb.atomic(() => {
    const reservation = User.reserve({ username, openingBalance: balance });
    if (!reservation.success) {
      throw new HandoffError(reservation.error, reservation.code || 400);
    }
    let { user: target, claim_token: claimToken, reused } = reservation.data;

    // A legacy reserved account may predate explicit opening-balance tracking.
    // Bring it up to the requested total once, then pin that amount so retries
    // never replenish later spending or dividends.
    if (reused && target.opening_balance == null) {
      if (target.balance > balance) {
        throw new HandoffError(
          `Existing reserved account balance (${target.balance}) exceeds requested opening balance (${balance})`,
          409
        );
      }
      const topUp = round6(balance - target.balance);
      if (topUp > 0) issue(target.id, 'operator_grant', topUp, { reason: 'account_handoff' });
      target = memoryDb.updateUser(target.id, {
        opening_balance: balance,
        operator_managed: true
      });
    }

    if (!claimToken) throw new HandoffError('Reserved account has no active claim link', 409);

    const setMap = new Map();
    const transferred = [];
    const alreadyAssigned = [];
    const now = new Date().toISOString();
    for (const card of cards) {
      if (card.creator_id === target.id) {
        alreadyAssigned.push(card.id);
        if (card.is_public) memoryDb.updateCard(card.id, { is_public: false, updated_at: now });
        continue;
      }

      let targetSetId = null;
      if (card.set_id) {
        if (!setMap.has(card.set_id)) {
          const sourceSet = memoryDb.getSetById(card.set_id);
          if (sourceSet) {
            const id = setNameFor(target.username, sourceSet.label);
            const targetSet = memoryDb.upsertSet({
              id,
              owner_id: target.id,
              label: sourceSet.label,
              info: sourceSet.info
            });
            setMap.set(card.set_id, targetSet.id);
          } else {
            setMap.set(card.set_id, null);
          }
        }
        targetSetId = setMap.get(card.set_id);
      }

      memoryDb.updateCard(card.id, {
        creator_id: target.id,
        set_id: targetSetId,
        is_public: false,
        updated_at: now
      });
      transferred.push(card.id);
    }

    const studioRoll = memoryDb.getActiveRollByUser(studio.id);
    if (studioRoll?.draft_card_id && ids.includes(studioRoll.draft_card_id)) {
      memoryDb.deleteRoll(studioRoll.id);
    }

    memoryDb.createEvent({
      type: 'operator_handoff',
      user_id: target.id,
      actor_user_id: studio.id,
      card_ids: ids,
      opening_balance: target.opening_balance,
      reused
    });

    target = memoryDb.getUserById(target.id);
    return {
      user: publicUser(target),
      claimUrl: `${claimBase()}/claim/${claimToken}`,
      openingBalance: target.opening_balance,
      balance: target.balance,
      cards: ids.map(id => {
        const card = memoryDb.getCardById(id);
        return { id: card.id, name: card.name, tier: card.tier, isPublic: !!card.is_public };
      }),
      transferred,
      alreadyAssigned,
      reused
    };
  });
};
