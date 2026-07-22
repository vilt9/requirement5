export const HOLO_REVEAL_MODES = [
  { value: 'fade', label: 'Fade' },
  { value: 'iris', label: 'Iris' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'shutter', label: 'Shutter' },
  { value: 'glitch', label: 'Glitch' }
];

export const HOLO_REVEAL_DIRECTIONS = [
  { value: 'right', label: 'Left to right' },
  { value: 'left', label: 'Right to left' },
  { value: 'down', label: 'Top to bottom' },
  { value: 'up', label: 'Bottom to top' }
];

export const HOLO_REVEAL_EASINGS = [
  { value: 'smooth', label: 'Smooth' },
  { value: 'snap', label: 'Snap' },
  { value: 'elastic', label: 'Elastic' },
  { value: 'linear', label: 'Linear' }
];

const EASING_CSS = {
  smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
  snap: 'cubic-bezier(0.7, 0, 0.84, 0)',
  elastic: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  linear: 'linear'
};

const values = (options) => new Set(options.map(option => option.value));
const MODES = values(HOLO_REVEAL_MODES);
const DIRECTIONS = values(HOLO_REVEAL_DIRECTIONS);
const EASINGS = values(HOLO_REVEAL_EASINGS);

const bounded = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export const normalizeHoloReveal = (effectParams = {}) => {
  const mode = MODES.has(effectParams.holoRevealMode) ? effectParams.holoRevealMode : 'fade';
  const direction = DIRECTIONS.has(effectParams.holoRevealDirection) ? effectParams.holoRevealDirection : 'right';
  const easing = EASINGS.has(effectParams.holoRevealEasing) ? effectParams.holoRevealEasing : 'smooth';
  return {
    mode,
    direction,
    easing,
    easingCss: EASING_CSS[easing],
    duration: bounded(effectParams.holoRevealDuration, 0.2, 0.05, 3),
    softness: bounded(effectParams.holoRevealSoftness, 12, 0, 40)
  };
};
