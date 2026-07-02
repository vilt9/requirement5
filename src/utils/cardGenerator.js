import { hslToHex } from './cardData';

// All randomness in this module flows through `rng` so a card can be generated
// DETERMINISTICALLY from a seed: /card/<uuid> renders the same card for
// everyone, forever, without a database row — the uuid IS the card. Unseeded
// callers keep plain Math.random behaviour.
let rng = Math.random;

// mulberry32 — tiny, fast, good-enough PRNG for visuals.
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// FNV-1a over the seed string → 32-bit state for mulberry32.
const hashSeed = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

// Run fn with the module RNG seeded; always restore Math.random after.
const withSeed = (seed, fn) => {
  rng = mulberry32(hashSeed(String(seed)));
  try {
    return fn();
  } finally {
    rng = Math.random;
  }
};

// Function to generate a random number in a range
const random = (min, max) => rng() * (max - min) + min;

// Seed-aware pick (cardData's getRandomItem uses Math.random directly).
const getRandomItem = (array) => array[Math.floor(rng() * array.length)];

// Function to generate circle pattern CSS
export const generateCirclePattern = () => {
  const size = random(5, 20);
  const density = random(40, 80);
  return {
    type: 'Circles',
    css: `radial-gradient(circle at ${random(20, 80)}% ${random(20, 80)}%, transparent ${size}px, rgba(255,255,255,0.03) ${size + 1}px, transparent ${size + 2}px) 0 0 / ${density}px ${density}px`
  };
};

// Function to generate spindles pattern CSS
export const generateSpindlesPattern = () => {
  const angle = Math.floor(random(0, 180));
  const size = random(10, 20);
  const density = random(20, 50);
  return {
    type: 'Spindles',
    css: `repeating-linear-gradient(${angle}deg, transparent, transparent ${size}px, rgba(255,255,255,0.05) ${size + 1}px, transparent ${size + 2}px) 0 0 / ${density}px ${density}px`
  };
};

// Function to generate squares pattern CSS
export const generateSquaresPattern = () => {
  const size = random(10, 30);
  return {
    type: 'Squares',
    css: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px) 0 0 / ${size}px ${size}px`
  };
};

// Function to generate triangles pattern CSS
export const generateTrianglesPattern = () => {
  const size = random(20, 60);
  const color = `rgba(255,255,255,${random(0.01, 0.05)})`;
  return {
    type: 'Triangles',
    css: `linear-gradient(45deg, ${color} 25%, transparent 25%), linear-gradient(315deg, ${color} 25%, transparent 25%) 0 0 / ${size}px ${size}px`
  };
};

// Function to generate starburst pattern CSS
export const generateStarburstPattern = () => {
  const lines = Math.floor(random(6, 24));
  const angleIncrement = 360 / lines;
  let gradient = '';
  
  for (let i = 0; i < lines; i++) {
    const angle = i * angleIncrement;
    gradient += `rgba(255,255,255,0.03) ${angle}deg, transparent ${angle + 1}deg, `;
    if (i === lines - 1) {
      gradient += `transparent ${angle + angleIncrement}deg`;
    }
  }
  
  return {
    type: 'Starburst',
    css: `conic-gradient(${gradient}) center / ${random(90, 110)}%`
  };
};

// Function to generate hexagon pattern CSS
export const generateHexagonPattern = () => {
  const size = random(20, 60);
  return {
    type: 'Hexagons',
    css: `radial-gradient(circle at 0% 50%, rgba(255,255,255,0.03) 9px, transparent 10px) 0 0 / ${size}px ${size}px, radial-gradient(at 100% 50%, rgba(255,255,255,0.03) 9px, transparent 10px) 0 0 / ${size}px ${size}px`
  };
};

// Function to generate fractal noise pattern CSS
export const generateFractalNoise = () => {
  const noiseDetail = random(1, 5);
  let filter = 'contrast(1200%) brightness(1000%)';
  
  if (rng() > 0.5) {
    filter += ' invert(1)';
  }
  
  return {
    type: 'Fractal Noise',
    css: 'none',
    filter: filter,
    detail: noiseDetail,
    animation: 'noiseAnimation 8s infinite linear'
  };
};

// Function to generate 3D grid pattern CSS
export const generate3DGridPattern = () => {
  const skewAngle = random(15, 45);
  const size = random(15, 40);
  const opacity = random(0.02, 0.08);
  
  return {
    type: '3D Grid',
    css: `linear-gradient(rgba(255,255,255,${opacity}) 1px, transparent 1px), 
          linear-gradient(to right, rgba(255,255,255,${opacity}) 1px, transparent 1px) 0 0 / ${size}px ${size}px`,
    transform: `perspective(500px) rotateX(${random(10, 20)}deg) rotateY(${random(-10, 10)}deg) rotateZ(${random(-5, 5)}deg)`
  };
};

// Function to generate 3D isometric pattern CSS
export const generate3DIsometricPattern = () => {
  const size = random(20, 60);
  const opacity = random(0.02, 0.08);
  
  return {
    type: '3D Isometric',
    css: `linear-gradient(30deg, rgba(255,255,255,${opacity}) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,${opacity}) 87.5%, rgba(255,255,255,${opacity})),
          linear-gradient(150deg, rgba(255,255,255,${opacity}) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,${opacity}) 87.5%, rgba(255,255,255,${opacity})),
          linear-gradient(30deg, rgba(255,255,255,${opacity}) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,${opacity}) 87.5%, rgba(255,255,255,${opacity})) 0 0 / ${size}px ${size}px`,
    transform: `perspective(500px) rotateX(${random(10, 20)}deg)`
  };
};

// Function to generate 3D wave pattern CSS
export const generate3DWavePattern = () => {
  const size = random(50, 150);
  const amplitude = random(4, 12);
  const frequency = random(0.1, 0.5);
  const opacity = random(0.02, 0.08);
  
  const waveGradient = `repeating-linear-gradient(0deg, transparent, transparent ${amplitude}px, rgba(255,255,255,${opacity}) ${amplitude + 1}px, transparent ${amplitude + 2}px) 0 0 / ${size}px ${size}px`;
  
  return {
    type: '3D Wave',
    css: waveGradient,
    animation: `waveAnimation ${random(5, 15)}s infinite linear`,
    transform: `perspective(500px) rotateX(${random(30, 60)}deg)`
  };
};

// Function to generate constellation pattern CSS
export const generateConstellationPattern = () => {
  const dotSize = random(1, 3);
  const dotSpacing = random(30, 80);
  const numLines = Math.floor(random(5, 15));
  
  const backgroundSize = `${dotSpacing}px ${dotSpacing}px`;
  const backgroundImage = `radial-gradient(circle at center, rgba(255, 255, 255, 0.2) ${dotSize}px, transparent ${dotSize + 1}px)`;
  
  return {
    type: 'Constellation',
    css: backgroundImage,
    backgroundSize: backgroundSize,
    numLines: numLines,
    lineOpacity: random(0.02, 0.1)
  };
};

// Function to generate solid color background CSS
export const generateSolidColorBackground = (baseHue = null) => {
  // Use provided baseHue or generate a random one
  const hue = baseHue !== null ? baseHue : Math.floor(random(0, 360));
  
  // Always use vibrant colors for better visual impact
  // Default to using gradients for all cards (like working_index.html)
  const isGradient = rng() > 0.2; // 80% chance for gradient
  let gradient, color;
  
  if (isGradient) {
    // Create a vibrant 3-color gradient like working_index.html
    // Using proper color theory relationships - triadic and complementary colors
    
    // First color - base color with good saturation and lightness
    const color1Saturation = random(70, 90);
    const color1Lightness = random(30, 45);
    const color1 = `hsl(${hue}, ${color1Saturation}%, ${color1Lightness}%)`;
    
    // Second color - complement or adjacent (+60° works well)
    const color2Hue = (hue + 60) % 360;
    const color2Saturation = random(80, 95);
    const color2Lightness = random(35, 50);
    const color2 = `hsl(${color2Hue}, ${color2Saturation}%, ${color2Lightness}%)`;
    
    // Third color - opposite/complementary color (+180°)
    const color3Hue = (hue + 180) % 360;
    const color3Saturation = random(75, 90);
    const color3Lightness = random(30, 45);
    const color3 = `hsl(${color3Hue}, ${color3Saturation}%, ${color3Lightness}%)`;
    
    // Create CSS variable-compatible HSL values
    const cssVarHue = hue;
    
    // Use linear gradient by default (better for cards)
    const gradientDirection = `${Math.floor(random(120, 150))}deg`;
    
    gradient = `linear-gradient(${gradientDirection}, ${color1}, ${color2}, ${color3})`;
    color = color1; // Use primary color as fallback
  } else {
    // For solid colors, still use vibrant values
    const saturation = random(65, 85);
    const lightness = random(25, 40);
    color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    gradient = color;
  }
  
  return {
    type: 'Solid Color',
    baseHue: hue,
    baseSaturation: isGradient ? 80 : random(65, 85),
    baseLightness: isGradient ? 40 : random(25, 40),
    color: color,
    hexColor: hslToHex(hue, isGradient ? 80 : 75, isGradient ? 40 : 35),
    gradient: gradient,
    isGradient: isGradient,
    // Add CSS variables for the card element to use
    cssVars: {
      '--base-hue': `${hue}`,
      '--color-1': `hsl(${hue}, 80%, 40%)`,
      '--color-2': `hsl(${(hue + 60) % 360}, 90%, 45%)`,
      '--color-3': `hsl(${(hue + 180) % 360}, 85%, 40%)`
    }
  };
};

// Base background sits behind the card image (shows through as image opacity
// drops). A structured, fully user-editable model: type, up to 3 colours, fade
// stops, position/angle, plus vignette + grain texture. Returns hex colours so
// the colour pickers can edit them directly.
export const generateBaseBackground = (baseHue = null) => {
  const hue = baseHue !== null ? baseHue : Math.floor(random(0, 360));
  const type = getRandomItem(['linear', 'radial', 'conic']);
  const h2 = (hue + getRandomItem([30, 180, 210, 330])) % 360;
  const h3 = (hue + getRandomItem([60, 120, 300])) % 360;
  const r = (a, b) => Math.floor(random(a, b));
  const round2 = (n) => Math.round(n * 100) / 100;
  return {
    type,
    color1: hslToHex(hue, r(55, 80), r(12, 26)),
    color2: hslToHex(h2, r(45, 70), r(3, 11)),
    color3: hslToHex(h3, r(55, 80), r(16, 32)),
    useThird: rng() > 0.45,
    angle: r(0, 360),
    posX: r(20, 80),
    posY: r(20, 80),
    fadeStart: r(0, 25),
    fadeEnd: r(72, 100),
    vignette: round2(random(0.1, 0.55)),
    grain: round2(random(0, 0.22)),
  };
};

// Function to generate random card attributes.
// options.rarityRange: [low, high] forces the rarity score into a tier band
// (used when the server rolls a tier and the client synthesises the card).
export const generateCardAttributes = (options = {}) => {
  // A seed (the card's uuid) makes the whole card deterministic — same seed,
  // same card, on any machine. The seed becomes the card's id.
  if (options.seed) {
    return withSeed(options.seed, () => buildCardAttributes(options));
  }
  return buildCardAttributes(options);
};

const buildCardAttributes = (options = {}) => {
  // Generate rarity
  let rarity;
  if (options.rarityRange) {
    const [low, high] = options.rarityRange;
    rarity = low + rng() * (high - low);
  } else {
    rarity = rng();
  }
  
  // Determine card background color/gradient
  const bgColor = generateSolidColorBackground();
  
  // Select a random pattern
  const patternGenerators = [
    generateCirclePattern,
    generateSpindlesPattern,
    generateSquaresPattern,
    generateTrianglesPattern,
    generateStarburstPattern,
    generateHexagonPattern,
    generateFractalNoise,
    generate3DGridPattern,
    generate3DIsometricPattern,
    generate3DWavePattern,
    generateConstellationPattern
  ];
  
  const pattern = getRandomItem(patternGenerators)();

  // Select random image
  const cardImageSet = getRandomItem(Object.entries(getRandomItem(window.cardImagesData || [])));
  const cardImageCategory = cardImageSet[0];
  const cardImageVariant = getRandomItem(cardImageSet[1]);
  const cardImagePath = `${cardImageCategory}${cardImageVariant}.webp`;
  
  // Generate effect parameters based on rarity
  const effectParams = generateHolographicParams(rarity, bgColor.baseHue);
  
  // Generate image effects
  const imageEffects = generateImageEffects(rarity);

  // Generate border effects
  const borderEffects = generateBorderEffects(rarity, bgColor.baseHue);

  // Calculate animation speed based on rarity (higher rarity = faster animations)
  const animationSpeed = Math.max(0.5, 1 - (rarity * 0.5));
  
  // Calculate pixel density for info panel
  const pixelDensity = Math.floor(random(4, 12));
  
  return {
    id: options.seed || crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    rarity,
    patternInfo: {
      ...pattern,
      opacity: random(0.3, 0.9)
    },
    backgroundColor: bgColor,
    baseBackground: generateBaseBackground(bgColor.baseHue),
    imagePath: cardImagePath,
    effectParams,
    imageEffects,
    borderEffects,
    animationSpeed,
    pixelDensity
  };
};

// Generate holographic effect parameters based on rarity and base hue
export const generateHolographicParams = (rarity, baseHue) => {
  // Default parameters - will be customized based on rarity
  const params = {
    h: baseHue || Math.floor(random(0, 360)),
    s: 70,
    l: 50,
    space: 4,
    shineColor1: `rgba(255, 0, 0, 0.5)`,
    shineColor2: `rgba(0, 146, 255, 0.5)`,
    shineColor3: `rgba(0, 200, 0, 0.5)`,
    shineOffset1: '20%',
    shineOffset2: '40%',
    shineOffset3: '60%',
    imageShineIntensity: (0.6 + rarity * 0.4).toFixed(2),
    aberrationIntensity: ((rarity - 0.9) * 5).toFixed(2),
    aberrationSpeed: `${Math.floor(random(8, 12))}s`,
  };
  
  // Customize based on specific rarity tier
  if (rarity >= 0.98) { // VMAX cards
    params.space = 6;
    params.angle = 133;
    params.shineColor1 = `rgba(0, 146, 255, 0.6)`;
    params.shineColor2 = `rgba(255, 255, 0, 0.6)`;
    params.aberrationIntensity = '0.6';
  } else if (rarity >= 0.9) { // Ultra rare
    params.space = 5;
    params.shineColor1 = `rgba(255, 0, 0, 0.7)`;
    params.shineColor2 = `rgba(255, 255, 0, 0.7)`;
    params.shineColor3 = `rgba(0, 200, 0, 0.7)`;
    params.shineOffset1 = '25%';
    params.shineOffset2 = '50%';
    params.shineOffset3 = '75%';
    params.aberrationIntensity = '0.5';
  } else if (rarity >= 0.8) { // Galaxy holo
    params.space = 4;
    params.shineColor1 = `rgba(255, 0, 0, 0.5)`;
    params.shineColor2 = `rgba(0, 146, 255, 0.5)`;
    params.shineColor3 = `rgba(255, 0, 255, 0.5)`;
  } else if (rarity >= 0.7) { // Basic holo
    params.space = 1.5;
    params.h = 21;
  }
  
  return params;
};

// Function to apply holographic effect based on rarity
export const getHolographicEffectClass = (rarity) => {
  // Special case: Cards with rarity between 0.85 and 0.9 get the NEW WOWA Holo effect
  if (rarity >= 0.85 && rarity < 0.9) return 'wowa-holo';
  
  // Original effects for all other rarity levels (unchanged)
  if (rarity >= 0.95) return 'rare-ultra';
  if (rarity >= 0.9) return 'rare-holo-vmax';
  if (rarity >= 0.7) return 'rare-holo-galaxy';
  if (rarity >= 0.5) return 'rare-holo';
  return '';
};

// Function to get new shiny effect type based on rarity
export const getNewShinyEffectType = (rarity) => {
  // Map rarity ranges to specific effect types
  if (rarity >= 0.95) return { type: 'illusion2', name: 'NEW Illusion2 Effect (Ultra Rare)' };
  if (rarity >= 0.85) return { type: 'illusion', name: 'NEW Illusion Effect (VMAX)' };
  if (rarity >= 0.75) return { type: 'geometric', name: 'NEW Geometric Effect' };
  if (rarity >= 0.65) return { type: 'crossover', name: 'NEW Crossover Effect' };
  if (rarity >= 0.55) return { type: 'angular', name: 'NEW Angular Effect' };
  if (rarity >= 0.45) return { type: 'ancient', name: 'NEW Ancient Effect' };
  
  // For non-holo cards, return null
  return null;
};

// Function to generate border effects
export const generateBorderEffects = (rarity, baseHue = null) => {
  // Determine if card should have borders based on rarity
  const thickBorderEnabled = rarity >= 0.6 || rng() > 0.7;
  const thinEdgeEnabled = rarity >= 0.4 || rng() > 0.5;
  
  // Use provided baseHue or generate a random one
  const hue = baseHue !== null ? baseHue : Math.floor(random(0, 360));
  
  // Generate border colors based on rarity
  let borderColor, edgeColor1, edgeColor2, thinEdgeColor;
  
  // Higher rarity cards get more golden/premium borders
  if (rarity >= 0.9) {
    // Premium gold/platinum borders
    borderColor = 'rgba(255, 215, 0, 0.4)';
    edgeColor1 = 'rgba(255, 215, 0, 0.7)';
    edgeColor2 = 'rgba(255, 255, 255, 0.3)';
    thinEdgeColor = 'rgba(255, 215, 0, 0.8)';
  } else if (rarity >= 0.7) {
    // Silver/chrome borders
    borderColor = 'rgba(192, 192, 192, 0.4)';
    edgeColor1 = 'rgba(220, 220, 220, 0.7)';
    edgeColor2 = 'rgba(100, 100, 100, 0.3)';
    thinEdgeColor = 'rgba(192, 192, 192, 0.8)';
  } else {
    // Color-based borders using the card's hue
    const saturation = random(60, 90);
    const lightness = random(50, 70);
    
    borderColor = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.3)`;
    edgeColor1 = `hsla(${hue}, ${saturation}%, ${lightness + 10}%, 0.6)`;
    edgeColor2 = `hsla(${hue}, ${saturation - 10}%, ${lightness - 10}%, 0.2)`;
    thinEdgeColor = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.6)`;
  }
  
  // Border opacity based on rarity (higher rarity = more prominent)
  const borderOpacity = Math.min(0.8, 0.5 + (rarity * 0.3));
  const borderImageOpacity = Math.min(0.7, 0.4 + (rarity * 0.3));
  
  return {
    thickBorderEnabled,
    thinEdgeEnabled,
    borderColor,
    borderOpacity,
    borderImageOpacity,
    edgeColor1,
    edgeColor2,
    thinEdgeColor
  };
};

// Generate image effects based on rarity
export const generateImageEffects = (rarity) => {
  // Different mask types
  const maskTypes = ['vignette', 'horizontal-fade', 'vertical-fade', 'diagonal-fade'];
  
  return {
    maskType: getRandomItem(maskTypes),
    maskOpacity: (0.3 - rarity * 0.2).toFixed(2), // Higher rarity = less mask opacity
    blurAmount: rarity > 0.9 ? '1px' : '0px',
    glowIntensity: rarity > 0.8 ? '5px' : '0px',
    glowColor: `hsla(${Math.floor(random(0, 360))}, 70%, 50%, 0.3)`
  };
};

// Authentic rarity: read a card's ACTUAL parameters and recover a 0–1 score, by
// inverting the relationships the generators above encode (rarity → effects). This
// works for hand-customized cards too, where the stored `rarity` seed is meaningless
// — the score reflects what the card actually is, not what it was rolled as.
//   shine      0.6→1.0   maps to 0→1   (generateHolographicParams)
//   border op  0.5→0.8   maps to 0→1   (generateBorderEffects)
//   mask op    0.3→0.1   maps to 0→1   (generateImageEffects, inverse)
//   anim speed 1.0→0.5   maps to 0→1   (generateCardAttributes, inverse)
//   aberration >0        implies the top band (>0.9)
//   glow/blur  present   premium flags
//   active holo effects  push toward the top
export const scoreCard = (customCard) => {
  const cc = customCard || {};
  const ep = cc.effectParams || {};
  const ie = cc.imageEffects || {};
  const be = cc.borderEffects || {};
  const holo = cc.holoEffects || {};
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };

  const signals = []; // [value 0–1, weight]
  const push = (v, w = 1) => { if (Number.isFinite(v)) signals.push([clamp(v), w]); };

  const shine = num(ep.imageShineIntensity ?? ep.shineIntensity);
  if (shine != null) push((shine - 0.6) / 0.4, 2);

  const borderOp = num(be.borderOpacity);
  if (borderOp != null) push((borderOp - 0.5) / 0.3, 1);

  const maskOp = num(ie.maskOpacity);
  if (maskOp != null) push((0.3 - maskOp) / 0.2, 1);

  const animSpeed = num(cc.animationSpeed);
  if (animSpeed != null) push((1 - animSpeed) * 2, 1);

  const aberration = num(ep.aberrationIntensity);
  if (aberration != null && aberration > 0) push(0.9 + clamp(aberration / 0.5) * 0.1, 1.5);

  const glow = num(ie.glowIntensity);
  if (glow != null) push(glow > 0 ? 0.85 : 0.4, 0.5);

  const blur = num(ie.blurAmount);
  if (blur != null) push(blur > 0 ? 0.95 : 0.5, 0.3);

  const HOLO_WEIGHTS = { rareHoloVmax: 0.99, wowaHolo: 0.87, rareHoloGalaxy: 0.82, rareHolo: 0.6 };
  Object.entries(holo).forEach(([k, on]) => { if (on && HOLO_WEIGHTS[k]) push(HOLO_WEIGHTS[k], 1.5); });

  if (!signals.length) return 0.5; // nothing to score on
  const totalW = signals.reduce((s, [, w]) => s + w, 0);
  const score = signals.reduce((s, [v, w]) => s + v * w, 0) / totalW;
  return Math.round(clamp(score) * 1000) / 1000;
};
