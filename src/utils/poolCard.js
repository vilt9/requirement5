import { apiBase } from './api';

// Card image URLs are stored as server-relative paths (e.g. "/uploads/card-images/x.png")
// when using the local storage driver. The SPA may be served from a different origin
// (dev: :5173 vs API :4000; prod: same host but still safest to be explicit), so resolve
// those against the API base. Absolute (http/data/blob) URLs pass through untouched.
const resolveImageUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  if (url.startsWith('/')) return `${apiBase}${url}`;
  return url;
};

// Convert a pool card record (server shape: { state_data: { customCard } })
// into the prop shape the Card component renders.
export const poolCardToCardData = (record) => {
  const customCard = record?.state_data?.customCard || record?.stateData?.customCard;
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
    rarity: typeof customCard.rarity === 'number' ? customCard.rarity : 0.5
  };
};

// "1 : 238" from a probability
export const asOdds = (p) => {
  if (!p || p <= 0) return null;
  return `1 : ${Math.round(1 / p).toLocaleString()}`;
};
