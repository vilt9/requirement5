import express from 'express';
import Card from '../models/Card.js';
import { memoryDb } from '../config/database.js';
import { getTier, saveCost, ECONOMY, dividendFor, saveValue, normalizeProvenance, round1, tierForScore } from '../services/economy.js';
import { absorb, issue, InsufficientFundsError } from '../services/ledger.js';
import { cardStats } from '../services/drawEngine.js';
import { requireAuth } from '../middleware/auth.js';
import { offloadImages, storeBuffer } from '../storage/index.js';
import { renderCard, MIME } from '../services/capture.js';

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

    absorb(req.user.id, 'publish_stake', ECONOMY.PUBLISH_STAKE);

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
        stake: ECONOMY.PUBLISH_STAKE,
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
    const card = memoryDb.getCardById(req.params.id);
    if (!card || !card.is_public) {
      return res.status(404).json({ success: false, error: 'Card not found' });
    }
    if (memoryDb.getSave(req.user.id, card.id)) {
      return res.status(409).json({ success: false, error: 'Already in your collection' });
    }

    // Every public card is saveable. Untiered legacy customs are priced by their
    // rarity (falling back to common) rather than refused — so the save flow, which
    // doubles as our signup hook, never dead-ends on a card the pool happens to hold.
    const tierKey = card.tier
      || tierForScore(card.rarity_score ?? card.state_data?.customCard?.rarity ?? 0).key;

    // How the saver reached this card. 'discovered' (pressed Generate) is worth
    // more than 'direct' (opened a shared link). Defaults to 'discovered' so the
    // existing generate→save flow is unchanged.
    const provenance = normalizeProvenance(req.body?.provenance);
    const cost = saveCost(tierKey);
    const dividend = dividendFor(tierKey, provenance);
    const value = saveValue(tierKey, provenance);

    absorb(req.user.id, 'save', cost, { card_id: card.id });
    // Dividend leaves the absorbed pot and goes to the creator, if they exist.
    if (dividend > 0 && memoryDb.getUserById(card.creator_id)) {
      issue(card.creator_id, 'dividend', dividend, {
        card_id: card.id, counterparty_id: req.user.id
      });
    }

    const save = memoryDb.createSave({
      user_id: req.user.id, card_id: card.id, provenance, value
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
        cloudShare: round1(cost - dividend),
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

// Save a synthetic draw (a card the client generated because the pool had none
// in the rolled tier). Costs the same as a pool save; the whole cost is absorbed
// by the cloud since there is no creator. The card is stored privately.
router.post('/save-synthetic', requireAuth, async (req, res) => {
  try {
    const { name, stateData, tier: tierKey, tags } = req.body || {};
    const tier = getTier(tierKey);
    if (!tier) {
      return res.status(400).json({ success: false, error: `Unknown tier: ${tierKey}` });
    }
    if (!stateData || typeof stateData !== 'object') {
      return res.status(400).json({ success: false, error: 'stateData is required' });
    }

    const cost = saveCost(tier.key);
    absorb(req.user.id, 'save', cost);

    const { value: offloadedState } = await offloadImages(stateData, req.user.username);
    const result = await Card.create({
      name: name || 'Synthetic draw',
      stateData: offloadedState,
      creatorId: 'cloud',
      isPublic: false,
      tags: tags || stateData?.customCard?.tags || []
    });
    const card = memoryDb.updateCard(result.data.id, {
      tier: tier.key,
      rarity_score: stateData?.customCard?.rarity ?? null,
      times_saved: 1
    });
    const save = memoryDb.createSave({ user_id: req.user.id, card_id: card.id });

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

// Your collection: saves joined with their cards.
router.get('/collection/mine', requireAuth, (req, res) => {
  const saves = memoryDb.getSavesByUser(req.user.id);
  const items = saves
    .map(save => {
      const card = memoryDb.getCardById(save.card_id);
      return card ? { save, card, stats: cardStats(card) } : null;
    })
    .filter(Boolean);
  res.json({ success: true, data: items });
});

// Remove a card from your collection. No refund — /t26 spent is spent.
router.delete('/collection/:cardId', requireAuth, (req, res) => {
  const deleted = memoryDb.deleteSave(req.user.id, req.params.cardId);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Not in your collection' });
  }
  res.json({ success: true, data: deleted });
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

router.get('/:id/render', async (req, res) => {
  const format = req.query.format === 'mp4' ? 'mp4' : 'gif';
  const { id } = req.params;

  try {
    const found = await Card.findById(id);
    if (!found.success) return res.status(404).json(found);

    const version = cardVersion(found.data);
    const key = `${id}:${format}`;

    const cached = renderCache.get(key);
    const fresh = cached && cached.version === version &&
      (Date.now() - cached.at) < RENDER_CACHE_TTL_MS;
    if (fresh) {
      return res.json({ success: true, data: { url: cached.url, format } });
    }

    if (!renderInFlight.has(key)) {
      const job = (async () => {
        const buffer = await renderCard(id, { format });
        const { url } = await storeBuffer(buffer, MIME[format], `card_${id}`, { prefix: 'renders' });
        renderCache.set(key, { url, version, at: Date.now() });
        return { url };
      })().finally(() => renderInFlight.delete(key));
      renderInFlight.set(key, job);
    }

    const { url } = await renderInFlight.get(key);
    res.json({ success: true, data: { url, format } });
  } catch (error) {
    console.error('Error rendering card:', error);
    res.status(500).json({ success: false, error: 'Failed to render card' });
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

// Update a card. Requires auth and ownership.
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const existing = memoryDb.getCardById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: 'Card not found' });
    if (existing.creator_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not your card' });
    }
    const updateData = { ...(req.body || {}) };
    for (const field of PROTECTED_CARD_FIELDS) delete updateData[field];

    const result = await Card.update(req.params.id, updateData);
    if (result.success) {
      res.json(result);
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