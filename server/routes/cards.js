import express from 'express';
import Card from '../models/Card.js';
import { memoryDb } from '../config/database.js';
import crypto from 'node:crypto';
import { getTier, saveCostFor, saveValueFor, dividendFor, rollPublishStake, normalizeProvenance, round2, round6, tierForScore } from '../services/economy.js';
import { absorb, issue, InsufficientFundsError } from '../services/ledger.js';
import { cardStats } from '../services/drawEngine.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import path from 'path';
import { offloadImages, storeBuffer, UPLOADS_DIR } from '../storage/index.js';
import { renderCard, renderStills, MIME } from '../services/capture.js';

const router = express.Router();

// Publish a card into the pool. Costs the publish stake; embedded data-URL images
// are offloaded to storage (S3 or local) and replaced with URLs.
router.post('/publish', requireAuth, async (req, res) => {
  try {
    const { name, stateData, tier: tierKey, rarityScore, tags } = req.body || {};
    const tier = getTier(tierKey);
    if (!tier) {
      return res.status(400).json({ success: false, error: `Unknown tier: ${tierKey}` });
    }
    if (!stateData || typeof stateData !== 'object') {
      return res.status(400).json({ success: false, error: 'stateData is required' });
    }

    const [low, high] = tier.scoreRange;
    const score = typeof rarityScore === 'number'
      ? Math.min(high, Math.max(low, rarityScore))
      : Math.round(((low + high) / 2) * 1000) / 1000;

    const { value: offloadedState, stored } = await offloadImages(stateData, req.user.username);

    // The stake is rolled per publish within its band — small, and a little
    // different every time.
    const stake = rollPublishStake();
    absorb(req.user.id, 'publish_stake', stake);

    const result = await Card.create({
      name: name || 'Untitled card',
      stateData: offloadedState,
      creatorId: req.user.id,
      isPublic: true,
      tags: tags || []
    });
    if (!result.success) return res.status(400).json(result);

    const card = memoryDb.updateCard(result.data.id, {
      tier: tier.key,
      rarity_score: score,
      image_keys: stored.map(s => s.key)
    });

    res.status(201).json({
      success: true,
      data: {
        card,
        stats: cardStats(card),
        stake,
        balance: memoryDb.getUserById(req.user.id).balance,
        imagesStored: stored.length
      }
    });
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return res.status(402).json({ success: false, error: error.message });
    }
    console.error('Publish error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Save a drawn card to your collection. Spends /t26; the creator gets a dividend,
// the remainder is absorbed by the cloud.
router.post('/:id/save', requireAuth, async (req, res) => {
  try {
    // Saveable: pool cards, plus claimed synthetic draws (creator 'cloud') —
    // a shared draw isn't used up by its first saver; anyone with the link can
    // still claim it at the same per-id price.
    const card = memoryDb.getCardById(req.params.id);
    if (!card || !(card.is_public || card.creator_id === 'cloud')) {
      return res.status(404).json({ success: false, error: 'Card not found' });
    }
    if (memoryDb.getSave(req.user.id, card.id)) {
      return res.status(409).json({ success: false, error: 'Already in your collection' });
    }

    // How the saver reached this card. 'discovered' (pressed Generate) is worth
    // more than 'direct' (opened a shared link). Defaults to 'discovered' so the
    // existing generate→save flow is unchanged. The price is the card's own —
    // seeded from its id, independent of rarity.
    const provenance = normalizeProvenance(req.body?.provenance);
    const cost = saveCostFor(card.id);
    // No creator account (cloud-claimed draws) → no dividend; the cloud
    // absorbs the whole cost.
    const hasCreator = !!memoryDb.getUserById(card.creator_id);
    const dividend = hasCreator ? dividendFor(card.id, provenance) : 0;
    const value = saveValueFor(card.id, provenance);

    absorb(req.user.id, 'save', cost, { card_id: card.id });
    // Dividend leaves the absorbed pot and goes to the creator.
    if (dividend > 0) {
      issue(card.creator_id, 'dividend', dividend, {
        card_id: card.id, counterparty_id: req.user.id
      });
    }

    // The cost is stored on the save itself — the price you paid is part of
    // your collection's story (bands can move; this is what it cost THEN).
    const save = memoryDb.createSave({
      user_id: req.user.id, card_id: card.id, provenance, value, cost
    });
    memoryDb.incrementCardCounter(card.id, 'times_saved');
    memoryDb.incrementCollectionCount(card.id);

    res.status(201).json({
      success: true,
      data: {
        save,
        cost,
        dividend,
        value,
        provenance,
        cloudShare: round6(cost - dividend),
        balance: memoryDb.getUserById(req.user.id).balance,
        stats: cardStats(memoryDb.getCardById(card.id))
      }
    });
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return res.status(402).json({ success: false, error: error.message });
    }
    console.error('Save error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Save a synthetic card — one generated deterministically from its uuid rather
// than stored. Costs the same as a pool save at the CHOSEN tier; the whole cost
// is absorbed by the cloud since there is no creator. The card is stored
// privately, and if the request carries the uuid it was generated from, that
// uuid is claimed — the shared /card/<uuid> URL keeps working, now DB-backed.
router.post('/save-synthetic', requireAuth, async (req, res) => {
  try {
    const { id, name, stateData, tags } = req.body || {};
    if (!stateData || typeof stateData !== 'object') {
      return res.status(400).json({ success: false, error: 'stateData is required' });
    }
    // Claim the requested uuid if it's sane and free. (Once claimed the card
    // is DB-backed, and later savers of the same link go through /:id/save —
    // same card, same price.) The id is settled BEFORE charging: the card's
    // own id seeds its price.
    const requestedId = typeof id === 'string' && /^[0-9a-f-]{10,64}$/i.test(id) && !memoryDb.getCardById(id)
      ? id : undefined;
    const finalId = requestedId || crypto.randomUUID();

    const cost = saveCostFor(finalId);
    absorb(req.user.id, 'save', cost);

    const { value: offloadedState } = await offloadImages(stateData, req.user.username);
    const result = await Card.create({
      id: finalId,
      name: name || 'Synthetic draw',
      stateData: offloadedState,
      creatorId: 'cloud',
      isPublic: false,
      tags: tags || stateData?.customCard?.tags || []
    });
    // The card keeps its NATURAL rarity — price and rarity are decoupled, so a
    // rare-looking card can be cheap to claim (the diamond in the rough).
    const rawScore = Number(stateData?.customCard?.rarity);
    const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(1, rawScore)) : 0.35;
    const card = memoryDb.updateCard(result.data.id, {
      tier: tierForScore(score).key,
      rarity_score: score,
      times_saved: 1
    });
    const save = memoryDb.createSave({ user_id: req.user.id, card_id: card.id, cost });

    res.status(201).json({
      success: true,
      data: { save, card, cost, balance: memoryDb.getUserById(req.user.id).balance }
    });
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return res.status(402).json({ success: false, error: error.message });
    }
    console.error('Save-synthetic error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Your collection: saves joined with their cards. Saves made before costs
// were recorded fall back to the card's seeded price (same formula, current
// bands — an approximation for historical saves, exact for new ones).
router.get('/collection/mine', requireAuth, (req, res) => {
  const saves = memoryDb.getSavesByUser(req.user.id);
  const items = saves
    .map(save => {
      const card = memoryDb.getCardById(save.card_id);
      return card ? {
        save: { ...save, cost: save.cost ?? saveCostFor(save.card_id) },
        card,
        stats: cardStats(card)
      } : null;
    })
    .filter(Boolean);
  res.json({ success: true, data: items });
});

// Public: one user's save of one card — powers the user-scoped card page
// (/<username>/card/<id>), where a collector shows off their copy and what
// they paid for it. 404 when that user hasn't saved that card.
router.get('/:id/save-of/:username', (req, res) => {
  const owner = memoryDb.getUserByUsername(req.params.username);
  const save = owner ? memoryDb.getSave(owner.id, req.params.id) : null;
  if (!save) {
    return res.status(404).json({ success: false, error: 'Not in this collection' });
  }
  res.json({
    success: true,
    data: {
      username: owner.username,
      cost: save.cost ?? saveCostFor(save.card_id),
      provenance: save.provenance || null,
      saved_at: save.created_at
    }
  });
});

// Remove a card from your collection. No refund — /t26 spent is spent.
router.delete('/collection/:cardId', requireAuth, (req, res) => {
  const deleted = memoryDb.deleteSave(req.user.id, req.params.cardId);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Not in your collection' });
  }
  res.json({ success: true, data: deleted });
});

// ---------- Discover collections ----------
// A collection's makeup: total spent building it (sum of what was paid per
// save) and the rarity scores of its rarest few cards, highest first. The
// rarity score is the card's own auto-generated 0..1 rating.
const TOP_N = 3;
const collectionStats = (userId) => {
  const saves = memoryDb.getSavesByUser(userId);
  let value = 0;
  const scores = [];
  for (const s of saves) {
    const card = memoryDb.getCardById(s.card_id);
    if (!card) continue;
    value += (s.cost ?? saveCostFor(s.card_id));
    scores.push(Number(card.rarity_score) || 0);
  }
  scores.sort((a, b) => b - a);
  return {
    count: saves.length,
    value: round2(value),
    topScores: scores.slice(0, TOP_N).map(n => Math.round(n * 1000) / 1000)
  };
};

// The public roster shape for one collection owner.
const rosterEntry = (owner, viewerId) => ({
  username: owner.username,
  stars: memoryDb.countStarsForOwner(owner.id),
  starredByMe: viewerId ? !!memoryDb.getStar(viewerId, owner.id) : false,
  ...collectionStats(owner.id)
});

// Fisher-Yates, in place.
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// A random sample of collections worth browsing — owners holding more than five
// saved cards. Public (discovery works logged out). `exclude` (comma-separated
// usernames) lets "show more" pull a fresh batch; `limit` caps the batch.
router.get('/collections/discover', optionalAuth, (req, res) => {
  const exclude = new Set(String(req.query.exclude || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  const limit = Math.max(1, Math.min(12, parseInt(req.query.limit, 10) || 6));
  const MIN_CARDS = 5;

  const pool = memoryDb.getCollectionOwners(MIN_CARDS)
    .map(o => ({ owner: memoryDb.getUserById(o.userId), count: o.count }))
    .filter(({ owner }) => owner &&
      !exclude.has(owner.username.toLowerCase()) &&
      (!req.user || owner.id !== req.user.id));

  shuffle(pool);
  const collections = pool.slice(0, limit)
    .map(({ owner }) => rosterEntry(owner, req.user?.id));

  res.json({ success: true, data: { collections, remaining: Math.max(0, pool.length - collections.length) } });
});

// Collections the signed-in user has starred, newest first.
router.get('/collections/starred/mine', requireAuth, (req, res) => {
  const collections = memoryDb.getStarsByUser(req.user.id)
    .slice()
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .map(star => {
      const owner = memoryDb.getUserById(star.owner_id);
      return owner ? rosterEntry(owner, req.user.id) : null;
    })
    .filter(Boolean);
  res.json({ success: true, data: { collections } });
});

// Star / unstar another user's collection.
router.post('/collections/:username/star', requireAuth, (req, res) => {
  const owner = memoryDb.getUserByUsername(req.params.username);
  if (!owner) return res.status(404).json({ success: false, error: 'No such collection' });
  if (owner.id === req.user.id) {
    return res.status(400).json({ success: false, error: "You can't star your own collection" });
  }
  memoryDb.createStar(req.user.id, owner.id);
  res.status(201).json({ success: true, data: { stars: memoryDb.countStarsForOwner(owner.id), starredByMe: true } });
});

router.delete('/collections/:username/star', requireAuth, (req, res) => {
  const owner = memoryDb.getUserByUsername(req.params.username);
  if (!owner) return res.status(404).json({ success: false, error: 'No such collection' });
  memoryDb.deleteStar(req.user.id, owner.id);
  res.json({ success: true, data: { stars: memoryDb.countStarsForOwner(owner.id), starredByMe: false } });
});

// Public: one user's whole collection — the cards, plus the roster header
// (count, star total, whether the viewer has starred it). Powers peeking into a
// discovered collection.
router.get('/collections/:username', optionalAuth, (req, res) => {
  const owner = memoryDb.getUserByUsername(req.params.username);
  if (!owner) return res.status(404).json({ success: false, error: 'No such collection' });
  const items = memoryDb.getSavesByUser(owner.id)
    .map(save => {
      const card = memoryDb.getCardById(save.card_id);
      return card ? {
        save: { ...save, cost: save.cost ?? saveCostFor(save.card_id) },
        card,
        stats: cardStats(card)
      } : null;
    })
    .filter(Boolean);
  const stats = collectionStats(owner.id);
  res.json({
    success: true,
    data: {
      username: owner.username,
      count: items.length,
      value: stats.value,
      topScores: stats.topScores,
      stars: memoryDb.countStarsForOwner(owner.id),
      starredByMe: req.user ? !!memoryDb.getStar(req.user.id, owner.id) : false,
      items
    }
  });
});

// Cards you have published, with their statistics.
router.get('/published/mine', requireAuth, (req, res) => {
  const cards = memoryDb.getAllCards().filter(c => c.creator_id === req.user.id);
  res.json({
    success: true,
    data: cards.map(card => ({ card, stats: cardStats(card) }))
  });
});

// Get all cards
router.get('/', async (req, res) => {
  try {
    const result = await Card.findAll();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get card by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await Card.findById(req.params.id);
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error fetching card:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Render a card to a moving image (GIF/MP4) for sharing. Rendering is expensive
// (headless chromium + ffmpeg), so each card renders once and the result is stored
// under the 'renders/' prefix and served statically; concurrent requests share one
// render. Renders are meant to be disposable — set a bucket lifecycle rule to expire
// 'renders/' (e.g. 14 days). The in-memory URL cache has a shorter TTL than that
// expiry so it never hands back a URL the store has already cleared.
const renderCache = new Map();   // key -> { url, version, at }
const renderInFlight = new Map(); // key -> Promise<{ url }>
const RENDER_CACHE_TTL_MS = 10 * 24 * 60 * 60 * 1000; // 10 days (< the 14-day expiry)

const cardVersion = (card) => card?.updated_at || card?.updatedAt || '';

// Ensure a render exists for (card, format), sharing the cache and in-flight
// dedupe. Returns { payload, card } or { notFound: true }. An unclaimed
// uuid-ish id still renders: the capture page generates the card from its
// seed, the same way the share page shows it before anyone saves it.
const ensureRender = async (id, format, count) => {
  const found = await Card.findById(id);
  if (!found.success) {
    if (!/^[0-9a-f-]{10,64}$/i.test(id)) return { notFound: true, found };
    return ensureRenderJob(id, format, count, 'seed', { name: `Draw ${id.slice(0, 8)}` });
  }
  return ensureRenderJob(id, format, count, cardVersion(found.data), found.data);
};

const ensureRenderJob = async (id, format, count, version, card) => {
  const key = format === 'frames' ? `${id}:frames:${count}` : `${id}:${format}`;

  const cached = renderCache.get(key);
  const fresh = cached && cached.version === version &&
    (Date.now() - cached.at) < RENDER_CACHE_TTL_MS;
  if (fresh) return { payload: cached.payload, card };

  if (!renderInFlight.has(key)) {
    const job = (async () => {
      let payload;
      if (format === 'frames') {
        const buffers = await renderStills(id, { count });
        const urls = [];
        for (let i = 0; i < buffers.length; i++) {
          const { url } = await storeBuffer(buffers[i], MIME.png, `card_${id}_still${i}`, { prefix: 'renders' });
          urls.push(url);
        }
        payload = { urls };
      } else {
        const buffer = await renderCard(id, { format });
        const { url } = await storeBuffer(buffer, MIME[format], `card_${id}`, { prefix: 'renders' });
        payload = { url };
      }
      renderCache.set(key, { payload, version, at: Date.now() });
      return payload;
    })().finally(() => renderInFlight.delete(key));
    renderInFlight.set(key, job);
  }

  const payload = await renderInFlight.get(key);
  return { payload, card };
};

router.get('/:id/render', async (req, res) => {
  const format = req.query.format === 'mp4' ? 'mp4'
    : req.query.format === 'frames' ? 'frames' : 'gif';

  try {
    // 'frames' returns a set of still PNGs (rest pose + orbit poses) instead of
    // a stitched clip — cheap previews an agent can look at one by one.
    const count = format === 'frames'
      ? Math.max(1, Math.min(8, parseInt(req.query.count, 10) || 4))
      : null;
    const result = await ensureRender(req.params.id, format, count);
    if (result.notFound) return res.status(404).json(result.found);
    res.json({ success: true, data: { ...result.payload, format } });
  } catch (error) {
    console.error('Error rendering card:', error);
    res.status(500).json({ success: false, error: 'Failed to render card' });
  }
});

// Download a render as a file. The stored render lives on the object store
// (a different origin with no CORS headers), so the browser cannot fetch it
// itself — this endpoint streams the bytes same-origin with an attachment
// disposition. Pointing the browser here downloads without leaving the page,
// which is also the only pattern mobile Safari reliably honours.
router.get('/:id/render/download', async (req, res) => {
  const format = req.query.format === 'mp4' ? 'mp4' : 'gif';
  try {
    const result = await ensureRender(req.params.id, format, null);
    if (result.notFound) return res.status(404).json(result.found);

    const { url } = result.payload;
    const name = String(result.card.name || req.params.id).replace(/[^a-zA-Z0-9_-]+/g, '_') || 'card';
    res.setHeader('Content-Disposition', `attachment; filename="${name}.${format}"`);

    if (/^https?:/i.test(url)) {
      const upstream = await fetch(url);
      if (!upstream.ok) throw new Error(`upstream fetch failed: ${upstream.status}`);
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', MIME[format]);
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    } else {
      // Local driver: url is /uploads/<key>, backed by a file on disk.
      const key = url.replace(/^\/uploads\//, '');
      res.sendFile(path.resolve(UPLOADS_DIR, key));
    }
  } catch (error) {
    console.error('Error downloading render:', error);
    res.status(500).json({ success: false, error: 'Failed to download render' });
  }
});

// Create a card. Requires auth — every card has a real creator_id, never
// 'anonymous'. The customizer's Publish flow (POST /publish) is the usual entry
// point; this remains for direct/programmatic creation.
router.post('/', requireAuth, async (req, res) => {
  try {
    const result = await Card.create({ ...req.body, creatorId: req.user.id });
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Protected fields a card owner cannot rewrite through a generic update.
const PROTECTED_CARD_FIELDS = ['id', 'creator_id', 'created_at'];

// Update a card. Requires auth and ownership. Accepts the same camelCase
// fields as /publish (name, stateData, tier, rarityScore, tags) — a re-design
// of a card you already staked, so no new charge. Embedded data-URL images are
// offloaded to storage exactly like publish does.
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const existing = memoryDb.getCardById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Card not found' });
    if (existing.creator_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not your card' });
    }

    const { name, stateData, tier: tierKey, rarityScore, tags, ...rest } = req.body || {};
    const updateData = { ...rest };
    for (const field of PROTECTED_CARD_FIELDS) delete updateData[field];

    if (name !== undefined) updateData.name = name;
    if (tags !== undefined) updateData.tags = tags;

    if (tierKey !== undefined) {
      const tier = getTier(tierKey);
      if (!tier) return res.status(400).json({ success: false, error: `Unknown tier: ${tierKey}` });
      updateData.tier = tier.key;
    }
    if (rarityScore !== undefined) {
      const tier = getTier(updateData.tier || existing.tier);
      const [low, high] = tier ? tier.scoreRange : [0, 1];
      updateData.rarity_score = Math.min(high, Math.max(low, rarityScore));
    }
    if (stateData !== undefined) {
      if (!stateData || typeof stateData !== 'object') {
        return res.status(400).json({ success: false, error: 'stateData must be an object' });
      }
      const { value: offloadedState, stored } = await offloadImages(stateData, req.user.username);
      updateData.state_data = offloadedState;
      if (stored.length) {
        updateData.image_keys = [...(existing.image_keys || []), ...stored.map(s => s.key)];
      }
    }

    const result = await Card.update(req.params.id, updateData);
    if (result.success) {
      res.json({ success: true, data: { card: result.data, stats: cardStats(result.data) } });
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete a card. Requires auth and ownership.
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = memoryDb.getCardById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Card not found' });
    if (existing.creator_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not your card' });
    }
    const result = await Card.delete(req.params.id);
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Search cards by property and value
router.get('/search/:property/:value', async (req, res) => {
  try {
    const { property, value } = req.params;
    const result = await Card.searchByState(property, decodeURIComponent(value));
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error searching cards:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// New community endpoints
// Get all community cards
router.get('/community/all', async (req, res) => {
  try {
    const result = await Card.getCommunityCards();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error fetching community cards:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get random community card
router.get('/community/random', async (req, res) => {
  try {
    const result = await Card.getRandomCommunityCard();
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error fetching random community card:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get community statistics
router.get('/community/stats', async (req, res) => {
  try {
    const result = await Card.getCommunityStats();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error fetching community stats:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Increment collection count for a card
router.post('/:id/collect', requireAuth, async (req, res) => {
  try {
    const result = await Card.incrementCollectionCount(req.params.id);
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error incrementing collection count:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// (Removed: DELETE /admin/clear — an unauthenticated full-database wipe. There is
// no admin system yet; wipe via psql/the store directly if ever needed.)

export default router;