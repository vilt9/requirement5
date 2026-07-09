// Turns a friendly card spec (see `r5c template` / CLI.md) into the exact
// publish payload the web customizer sends: { name, stateData, tier,
// rarityScore, tags } where stateData.customCard carries every visual knob.
//
// A minimal spec (name + tier + image) produces a complete, coherent card:
// we fill in the same structures the frontend's card generator would, derived
// deterministically from a base hue. Anything in spec.card deep-merges over
// those defaults, so a maximal spec can control every field.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const TIERS = ['common', 'holo', 'galaxy', 'wowa', 'ultra', 'vmax'];

const TIER_MID_SCORE = {
  common: 0.35, holo: 0.75, galaxy: 0.825, wowa: 0.875, ultra: 0.94, vmax: 0.99
};

export const BLEND_MODES = [
  'normal', 'color-dodge', 'color-burn', 'soft-light', 'hard-light', 'screen',
  'overlay', 'multiply', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
];

export const PATTERN_TYPES = [
  'Circles', 'Spindles', 'Squares', 'Triangles', 'Starburst', 'Hexagons',
  'Fractal Noise', '3D Grid', '3D Isometric', '3D Wave', 'Constellation'
];

export const MASK_TYPES = ['vignette', 'horizontal-fade', 'vertical-fade', 'diagonal-fade'];

// 'overlay' is the Veil — the card-wide "standard" holo. It carries no *Params
// block of its own: it reads the sheen* knobs under effectParams and, when a
// holoImage is supplied, blends that. The four rareHolo* keys are the animated
// texture systems, each with its own params block.
export const HOLO_EFFECTS = ['overlay', 'rareHolo', 'rareHoloGalaxy', 'wowaHolo', 'rareHoloVmax'];

const SPEC_KEYS = ['name', 'tier', 'rarityScore', 'tags', 'image', 'holoImage', 'card'];

export class SpecError extends Error {}

// ---------- defaults (mirrors src/utils/cardGenerator.js shapes)

const RAINBOW = [
  'rgb(255,0,0)', 'rgb(255,127,0)', 'rgb(255,255,0)', 'rgb(127,255,0)',
  'rgb(0,255,0)', 'rgb(0,255,127)', 'rgb(0,255,255)', 'rgb(0,127,255)',
  'rgb(0,0,255)', 'rgb(127,0,255)', 'rgb(255,0,255)', 'rgb(255,0,127)'
];

const hsl = (h, s, l) => `hsl(${((h % 360) + 360) % 360}, ${s}%, ${l}%)`;

function defaultCustomCard({ hue, rarity, tags }) {
  const h2 = (hue + 60) % 360;
  const h3 = (hue + 180) % 360;
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    rarity,
    animationSpeed: Math.round((1 - rarity * 0.5) * 100) / 100,
    pixelDensity: 8,
    tags,
    imagePath: 'default',
    backgroundColor: {
      type: 'Solid Color',
      baseHue: hue,
      baseSaturation: 80,
      baseLightness: 40,
      color: hsl(hue, 78, 38),
      hexColor: null,
      gradient: `linear-gradient(135deg, ${hsl(hue, 78, 38)}, ${hsl(h2, 88, 45)}, ${hsl(h3, 82, 40)})`,
      isGradient: true,
      cssVars: {
        '--base-hue': String(hue),
        '--color-1': hsl(hue, 80, 40),
        '--color-2': hsl(h2, 90, 45),
        '--color-3': hsl(h3, 85, 40)
      }
    },
    baseBackground: {
      type: 'radial',
      color1: '#1c1033',
      color2: '#070310',
      color3: '#2b1a4a',
      useThird: true,
      angle: 210,
      posX: 50,
      posY: 42,
      fadeStart: 12,
      fadeEnd: 88,
      vignette: 0.4,
      grain: 0.12
    },
    patternInfo: {
      type: 'Constellation',
      css: 'radial-gradient(circle at center, rgba(255,255,255,0.2) 2px, transparent 3px)',
      backgroundSize: '56px 56px',
      numLines: 9,
      lineOpacity: 0.07,
      opacity: 0.6
    },
    effectParams: {
      h: hue, s: 70, l: 50, space: 5,
      angle: 133,
      shineColor1: 'rgba(0, 146, 255, 0.6)',
      shineColor2: 'rgba(255, 255, 0, 0.6)',
      shineColor3: 'rgba(0, 200, 0, 0.5)',
      shineOffset1: '20%', shineOffset2: '40%', shineOffset3: '60%',
      imageShineIntensity: '0.9',
      aberrationIntensity: '0.5',
      aberrationSpeed: '10s',
      filterBrightness: 1.05, filterContrast: 1.2, filterSaturate: 1.25,
      holoAngle: 133,
      // 0–1, same band as the customizer slider (scales the artwork's 3D shift)
      parallaxDepth: 0.4,
      customHoloBlendMode: 'color-dodge'
    },
    imageEffects: {
      maskType: 'vignette',
      maskOpacity: '0.10',
      blurAmount: '0px',
      glowIntensity: '4px',
      glowColor: `hsla(${hue}, 70%, 50%, 0.3)`,
      opacity: 1, opacityHover: 1, contrast: 1.1, saturation: 1.2
    },
    borderEffects: {
      thickBorderEnabled: true,
      thinEdgeEnabled: true,
      borderImageEnabled: false,
      borderColor: 'rgba(255, 215, 0, 0.4)',
      borderOpacity: 0.7,
      opacityHover: 0.9,
      edgeColor1: 'rgba(255, 215, 0, 0.7)',
      edgeColor2: 'rgba(255, 255, 255, 0.3)',
      thinEdgeColor: 'rgba(255, 215, 0, 0.8)',
      colorHover: 'rgba(255, 235, 120, 0.6)',
      transitionDuration: 0.3
    },
    holoEffects: {
      rareHolo: false, rareHoloGalaxy: false, wowaHolo: false, rareHoloVmax: false
    }
  };
}

// Default parameter blocks for each holo effect, applied when the spec turns an
// effect on without supplying its params (mirrors HoloEffectToggles.jsx defaults).
const HOLO_PARAM_DEFAULTS = {
  rareHolo: {
    key: 'rareHoloParams',
    value: {
      space: 1.5, hue: 21, saturation: 70, lightness: 50,
      intensity: 'subtle', filterStrength: 1.2, mouseSpeed: 1.0,
      blendMode: 'soft-light', colors: RAINBOW
    }
  },
  rareHoloGalaxy: {
    key: 'rareHoloGalaxyParams',
    value: {
      space: 4, brightness: 0.75, contrast: 1.2, saturation: 1.5,
      blendMode: 'color-dodge', gradientSize: 400, gradientHeight: 900,
      smoothTransitions: 0.4,
      colors: [
        'rgb(219,204,86)', 'rgb(121,199,58)', 'rgb(58,192,183)',
        'rgb(71,98,207)', 'rgb(170,69,209)', 'rgb(255,90,180)'
      ]
    }
  },
  wowaHolo: {
    key: 'wowaHoloParams',
    value: { space: 4, angle: 133, brightness: 0.9, contrast: 1.4 }
  },
  rareHoloVmax: {
    key: 'rareHoloVmaxParams',
    value: { space: 6, angle: 133, brightness: 0.5, contrast: 2.0 }
  }
};

// ---------- merging + image inlining

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function deepMerge(base, overrides) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    result[key] = isPlainObject(value) && isPlainObject(base[key])
      ? deepMerge(base[key], value)
      : value;
  }
  return result;
}

const IMAGE_MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif'
};

// Reads a local image file into a data URL. The server offloads these to
// object storage (downscaled + WebP) and replaces them with real URLs.
export function imageToDataUrl(ref, baseDir) {
  const filePath = path.isAbsolute(ref) ? ref : path.resolve(baseDir, ref);
  const mime = IMAGE_MIME[path.extname(filePath).toLowerCase()];
  if (!mime) {
    throw new SpecError(`"${ref}": unsupported image type (use ${Object.keys(IMAGE_MIME).join(', ')})`);
  }
  let buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch {
    throw new SpecError(`"${ref}": file not found (resolved to ${filePath})`);
  }
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

// Resolves an image reference in the spec: local path -> data URL;
// http(s)/data URLs pass through untouched.
function resolveImageRef(ref, baseDir, field) {
  if (typeof ref !== 'string' || !ref) {
    throw new SpecError(`${field} must be a file path or URL string`);
  }
  if (/^(https?:|data:image\/)/.test(ref)) return ref;
  return imageToDataUrl(ref, baseDir);
}

// Walks the merged customCard and inlines any remaining local-file image
// references (e.g. rareHoloParams.backgroundImage: "./texture.png").
function inlineLocalImages(node, baseDir) {
  if (Array.isArray(node)) return node.map((item) => inlineLocalImages(item, baseDir));
  if (isPlainObject(node)) {
    const result = {};
    for (const [key, value] of Object.entries(node)) result[key] = inlineLocalImages(value, baseDir);
    return result;
  }
  if (typeof node === 'string' && IMAGE_MIME[path.extname(node).toLowerCase()]
      && !/^(https?:|data:)/.test(node)) {
    const filePath = path.isAbsolute(node) ? node : path.resolve(baseDir, node);
    if (fs.existsSync(filePath)) return imageToDataUrl(node, baseDir);
  }
  return node;
}

// ---------- validation

function validate(spec, customCard) {
  const problems = [];

  for (const key of Object.keys(spec)) {
    if (!SPEC_KEYS.includes(key)) {
      problems.push(`unknown top-level key "${key}" (allowed: ${SPEC_KEYS.join(', ')})`);
    }
  }
  if (!spec.tier || !TIERS.includes(spec.tier)) {
    problems.push(`"tier" must be one of: ${TIERS.join(', ')} (got ${JSON.stringify(spec.tier)})`);
  }
  if (spec.rarityScore !== undefined && (typeof spec.rarityScore !== 'number' || spec.rarityScore < 0 || spec.rarityScore > 1)) {
    problems.push('"rarityScore" must be a number between 0 and 1');
  }
  if (spec.tags !== undefined && (!Array.isArray(spec.tags) || spec.tags.some((t) => typeof t !== 'string'))) {
    problems.push('"tags" must be an array of strings');
  }

  for (const [key, enabled] of Object.entries(customCard.holoEffects || {})) {
    if (!HOLO_EFFECTS.includes(key)) problems.push(`holoEffects.${key}: unknown effect (allowed: ${HOLO_EFFECTS.join(', ')})`);
    if (typeof enabled !== 'boolean') problems.push(`holoEffects.${key} must be true or false`);
  }
  const blendFields = [
    ['effectParams.customHoloBlendMode', customCard.effectParams?.customHoloBlendMode],
    ['rareHoloParams.blendMode', customCard.rareHoloParams?.blendMode],
    ['rareHoloGalaxyParams.blendMode', customCard.rareHoloGalaxyParams?.blendMode]
  ];
  for (const [field, value] of blendFields) {
    if (value !== undefined && !BLEND_MODES.includes(value)) {
      problems.push(`${field}: "${value}" is not a CSS blend mode (allowed: ${BLEND_MODES.join(', ')})`);
    }
  }
  if (customCard.patternInfo?.type && !PATTERN_TYPES.includes(customCard.patternInfo.type)) {
    problems.push(`patternInfo.type: "${customCard.patternInfo.type}" unknown (allowed: ${PATTERN_TYPES.join(', ')})`);
  }
  if (customCard.imageEffects?.maskType && !MASK_TYPES.includes(customCard.imageEffects.maskType)) {
    problems.push(`imageEffects.maskType: "${customCard.imageEffects.maskType}" unknown (allowed: ${MASK_TYPES.join(', ')})`);
  }

  if (problems.length) {
    throw new SpecError(`invalid card spec:\n  - ${problems.join('\n  - ')}\nRun \`r5c help spec\` for the full reference.`);
  }
}

// ---------- entry point

export function buildPublishPayload(spec, baseDir) {
  if (!isPlainObject(spec)) throw new SpecError('spec must be a JSON object');

  const rarityScore = spec.rarityScore ?? TIER_MID_SCORE[spec.tier] ?? 0.5;
  const tags = spec.tags || [];
  const overrides = spec.card || {};
  const hue = overrides.backgroundColor?.baseHue ?? 265;

  let customCard = deepMerge(defaultCustomCard({ hue, rarity: rarityScore, tags }), overrides);

  if (spec.image) {
    customCard.imagePath = 'custom_image';
    customCard.customImageUrl = resolveImageRef(spec.image, baseDir, 'image');
  }
  if (spec.holoImage) {
    customCard.customHoloImageUrl = resolveImageRef(spec.holoImage, baseDir, 'holoImage');
    // A holoImage is only ever seen through the Veil, so turn it on unless the
    // spec explicitly opted out — mirrors the web customizer's behaviour.
    customCard.holoEffects = { ...customCard.holoEffects };
    if (customCard.holoEffects.overlay === undefined) customCard.holoEffects.overlay = true;
  }

  // Enabling a holo effect without its params gets that effect's defaults.
  for (const [effect, { key, value }] of Object.entries(HOLO_PARAM_DEFAULTS)) {
    if (customCard.holoEffects?.[effect] && !customCard[key]) customCard[key] = value;
  }

  customCard = inlineLocalImages(customCard, baseDir);
  validate(spec, customCard);

  return {
    name: spec.name || 'Untitled card',
    tier: spec.tier,
    rarityScore,
    tags,
    stateData: {
      customCard,
      timestamp: new Date().toISOString(),
      version: '1.0'
    }
  };
}

// ---------- templates printed by `r5c template`

const MINIMAL_TEMPLATE = {
  name: 'My first card',
  tier: 'holo',
  tags: ['example'],
  image: './artwork.png'
};

const FULL_TEMPLATE = {
  name: 'Neon Reliquary',
  tier: 'ultra',
  rarityScore: 0.94,
  tags: ['cosmic', 'portrait', 'gold'],
  image: './artwork.png',
  holoImage: './holo-overlay.png',
  card: {
    backgroundColor: { baseHue: 268 },
    baseBackground: {
      type: 'radial', color1: '#2a1046', color2: '#080311', color3: '#3a1d55',
      useThird: true, angle: 210, posX: 60, posY: 40,
      fadeStart: 12, fadeEnd: 88, vignette: 0.42, grain: 0.15
    },
    patternInfo: { type: 'Constellation', opacity: 0.7, numLines: 11, lineOpacity: 0.07 },
    effectParams: {
      filterBrightness: 1.1, filterContrast: 1.3, filterSaturate: 1.4,
      parallaxDepth: 0.5, customHoloBlendMode: 'color-dodge'
    },
    imageEffects: {
      opacity: 0.98, opacityHover: 0.9, contrast: 1.15, saturation: 1.3
    },
    borderEffects: {
      thickBorderEnabled: true, thinEdgeEnabled: true, borderImageEnabled: true,
      color: 'rgb(255, 215, 0)', opacity: 0.4, imageOpacity: 0.7,
      edgeColor1: 'rgba(255, 215, 0, 0.7)', edgeColor2: 'rgba(255, 255, 255, 0.3)',
      thinEdgeColor: 'rgba(255, 215, 0, 0.8)'
    },
    holoEffects: { rareHolo: true, rareHoloGalaxy: true, wowaHolo: false, rareHoloVmax: false },
    rareHoloParams: {
      space: 1.5, hue: 21, saturation: 70, lightness: 50,
      intensity: 'extreme', filterStrength: 1.2, mouseSpeed: 1.0, blendMode: 'soft-light'
    },
    rareHoloGalaxyParams: {
      space: 4, brightness: 0.75, contrast: 1.2, saturation: 1.5,
      blendMode: 'color-dodge', gradientSize: 400, gradientHeight: 900, smoothTransitions: 0.4
    }
  }
};

export const TEMPLATES = {
  minimal: MINIMAL_TEMPLATE,
  full: FULL_TEMPLATE
};
