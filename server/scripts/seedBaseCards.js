// Seed the pool with base cards so a fresh deployment has something to draw:
// simple commons — a coherent two-color backdrop, a faint constellation
// texture, no artwork, and the R5c card back as the Veil holo overlay. They
// give new users' cards company in the pool, and every draw of the common
// tier can surface one.
//
// Usage (idempotent — refuses to run if base cards already exist):
//   node server/scripts/seedBaseCards.js            # local JSON store
//   DATABASE_URL=... node server/scripts/seedBaseCards.js   # prod
import crypto from 'crypto';
import { initializeDatabase, shutdownDatabase, memoryDb, dbConfig } from '../config/database.js';

const COUNT = 24;
const rand = (min, max) => Math.random() * (max - min) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const buildCustomCard = (i) => {
  const hue = Math.floor((360 / COUNT) * i + rand(-6, 6) + 360) % 360;
  const rarity = rand(0.15, 0.6); // squarely common
  const type = pick(['linear', 'radial', 'conic']);
  const dotSize = rand(1, 2.5).toFixed(1);
  const spacing = Math.floor(rand(36, 72));

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    rarity,
    backgroundColor: { baseHue: hue },
    baseBackground: {
      type,
      color1: `hsl(${hue}, ${Math.floor(rand(45, 70))}%, ${Math.floor(rand(16, 26))}%)`,
      color2: `hsl(${(hue + Math.floor(rand(20, 60))) % 360}, ${Math.floor(rand(40, 65))}%, ${Math.floor(rand(5, 11))}%)`,
      useThird: false,
      angle: Math.floor(rand(0, 360)),
      posX: Math.floor(rand(30, 70)),
      posY: Math.floor(rand(30, 70)),
      fadeStart: Math.floor(rand(0, 15)),
      fadeEnd: Math.floor(rand(80, 100)),
      vignette: Number(rand(0.15, 0.4).toFixed(2)),
      grain: Number(rand(0.04, 0.14).toFixed(2))
    },
    patternInfo: {
      type: 'Constellation',
      css: `radial-gradient(circle at center, rgba(255,255,255,0.18) ${dotSize}px, transparent ${dotSize + 1}px) 0 0 / ${spacing}px ${spacing}px`,
      opacity: Number(rand(0.35, 0.7).toFixed(2))
    },
    // No artwork — the backdrop carries the card...
    imagePath: 'custom_image',
    customImageUrl: null,
    // ...and the R5c card back shines through as the Veil overlay on touch.
    customHoloImageUrl: '/r5c_card_back.png',
    effectParams: { customHoloBlendMode: 'color-dodge', parallaxDepth: 0 },
    imageEffects: { opacity: 1, contrast: 1, saturation: 1 },
    borderEffects: {
      thickBorderEnabled: false,
      thinEdgeEnabled: true,
      thinEdgeColor: `hsla(${hue}, 70%, 60%, 0.7)`,
      edgeColor1: `hsla(${hue}, 80%, 65%, 0.6)`,
      edgeColor2: 'rgba(0, 0, 0, 0)'
    },
    holoEffects: { rareHolo: false, rareHoloGalaxy: false, wowaHolo: false, rareHoloVmax: false },
    animationSpeed: 1,
    pixelDensity: Math.floor(rand(4, 12))
  };
};

const main = async () => {
  await initializeDatabase();

  const existing = memoryDb.getAllCards().filter(c =>
    c.creator_id === 'cloud' && (c.tags || []).includes('base'));
  if (existing.length > 0) {
    console.log(`Base cards already seeded (${existing.length} found) — nothing to do.`);
    await shutdownDatabase();
    return;
  }

  for (let i = 0; i < COUNT; i++) {
    const customCard = buildCustomCard(i);
    const card = memoryDb.createCard({
      id: customCard.id,
      name: `Cloud base ${String(i + 1).padStart(2, '0')}`,
      state_data: { customCard, timestamp: new Date().toISOString(), version: '1.0' },
      creator_id: 'cloud',
      is_public: true,
      collection_count: 0,
      tags: ['base'],
      tier: 'common',
      rarity_score: Number(customCard.rarity.toFixed(3)),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    console.log(`seeded ${card.id}  hue ${customCard.backgroundColor.baseHue}  rarity ${card.rarity_score}`);
  }

  // Local JSON persistence is debounced; give it a beat, then flush PG if used.
  await new Promise(r => setTimeout(r, 1500));
  await shutdownDatabase();
  console.log(`Done: ${COUNT} base cards (${dbConfig.type}).`);
};

main().catch(err => { console.error(err); process.exit(1); });
