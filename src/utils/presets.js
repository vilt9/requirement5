// A preset (a "base template" in the UI) is a named, reusable starting point for
// the customizer: the design parameters plus default tags. Images are excluded by
// default (a template is the reusable "look"), but can be opted in so people can
// reuse base/holo images too. Stored client-side in localforage so it works
// logged-out — device-scoped, never sent to the server.
//
// NOT to be confused with a published card's SET (server-side, username-namespaced,
// groups a creator's published cards — see server/utils/setName.js).
import { ensureTags } from './tags';

// The reusable "look" of a card — everything except the image and identity.
export const DESIGN_FIELDS = [
  'baseBackground',
  'backgroundColor',
  'patternInfo',
  'effectParams',
  'imageEffects',
  'borderEffects',
  'holoEffects',
  'rareHoloParams',
  'rareHoloGalaxyParams',
  'wowaHoloParams',
  'rareHoloVmaxParams',
  'rarity',
  'animationSpeed',
  'pixelDensity',
];

// The card's image identity: the uploaded base image, the holo image, and the
// imagePath marker that tells the renderer which to use. Optional in a template.
export const IMAGE_FIELDS = ['customImageUrl', 'customHoloImageUrl', 'imagePath'];

// Pull just the design fields out of a customCard (skip undefined ones).
export const extractDesign = (card) => {
  const design = {};
  if (!card) return design;
  for (const key of DESIGN_FIELDS) {
    if (card[key] !== undefined) design[key] = card[key];
  }
  return design;
};

// Pull the image fields out of a customCard (skip undefined ones).
export const extractImages = (card) => {
  const images = {};
  if (!card) return images;
  for (const key of IMAGE_FIELDS) {
    if (card[key] !== undefined) images[key] = card[key];
  }
  return images;
};

// Build a preset record from the current card + its tags. Pass includeImages to
// also capture the base/holo images (off by default to keep sets lightweight).
export const makePreset = (name, card, { includeImages = false } = {}) => ({
  id: (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `preset_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
  name: String(name || 'Untitled template').trim(),
  tags: ensureTags(card?.tags),
  design: extractDesign(card),
  ...(includeImages ? { images: extractImages(card) } : {}),
});

// Whether a template carries images (for UI hints).
export const presetHasImages = (preset) =>
  !!(preset?.images && Object.keys(preset.images).length > 0);

// Apply a preset onto a card: overlay the design, replace tags with the preset's
// default tags. If the template carries images, overlay those too; otherwise the
// current card's image is kept.
export const applyPreset = (card, preset) => {
  if (!preset) return card;
  return {
    ...card,
    ...preset.design,
    ...(preset.images || {}),
    tags: ensureTags(preset.tags),
  };
};
