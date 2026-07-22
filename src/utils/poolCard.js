import { apiBase } from './api';

// Card image URLs are stored as server-relative paths (e.g. "/uploads/card-images/x.png")
// when using the local storage driver. The SPA may be served from a different origin
// (dev: :5173 vs API :4000; prod: same host but still safest to be explicit), so resolve
// those against the API base. Absolute (http/data/blob) URLs pass through untouched.
export const resolveImageUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  // Uploaded files are served by the API in local development. Other
  // root-relative assets (the default holo and bundled card art) belong to
  // the frontend origin and must stay there.
  if (url.startsWith('/uploads/')) return `${apiBase}${url}`;
  return url;
};

export const cardArtworkUrl = (card) => {
  if (!card) return null;
  if (card.imagePath === 'custom_image') {
    return resolveImageUrl(card.customImageUrl) || null;
  }
  if (!card.imagePath || card.imagePath === 'default') return null;
  return `/assets/card_images/${card.imagePath}`;
};

// Convert a pool card record (server shape: { state_data: { customCard } })
// into the prop shape the Card component renders.
export const poolCardToCardData = (record) => {
  const state = record?.state_data || record?.stateData;
  const directCardFields = [
    'backgroundColor', 'baseBackground', 'imagePath', 'customImageUrl',
    'customHoloImageUrl', 'effectParams', 'imageEffects', 'borderEffects',
    'holoEffects', 'patternInfo', 'rarity'
  ];
  // New creation flows wrap render data in `customCard`. Older records and
  // the generic card API stored those same fields directly in state_data.
  const customCard = state?.customCard || (
    state && directCardFields.some(field => state[field] !== undefined) ? state : null
  );
  if (!customCard) return null;
  return {
    ...customCard,
    imagePath: customCard.imagePath || 'default',
    customImageUrl: resolveImageUrl(customCard.customImageUrl),
    customHoloImageUrl: resolveImageUrl(customCard.customHoloImageUrl),
    backgroundColor: customCard.backgroundColor || '#1a1a1a',
    effectParams: customCard.effectParams || {},
    holoEffects: customCard.holoEffects || {},
    borderEffects: customCard.borderEffects || {},
    imageEffects: customCard.imageEffects || {},
    patternInfo: customCard.patternInfo || {},
    rarity: typeof customCard.rarity === 'number'
      ? customCard.rarity
      : (typeof record?.rarity_score === 'number' ? record.rarity_score : 0.5)
  };
};
