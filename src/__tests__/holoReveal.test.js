/* global describe, expect, test */
import {
  HOLO_REVEAL_DIRECTIONS,
  HOLO_REVEAL_EASINGS,
  HOLO_REVEAL_MODES,
  normalizeHoloReveal
} from '../utils/holoReveal';

describe('normalizeHoloReveal', () => {
  test('preserves the legacy fade when a card has no reveal fields', () => {
    expect(normalizeHoloReveal()).toEqual({
      mode: 'fade',
      direction: 'right',
      easing: 'smooth',
      easingCss: 'cubic-bezier(0.22, 1, 0.36, 1)',
      duration: 0.2,
      softness: 12
    });
  });

  test('accepts every exposed option', () => {
    for (const { value: mode } of HOLO_REVEAL_MODES) {
      expect(normalizeHoloReveal({ holoRevealMode: mode }).mode).toBe(mode);
    }
    for (const { value: direction } of HOLO_REVEAL_DIRECTIONS) {
      expect(normalizeHoloReveal({ holoRevealDirection: direction }).direction).toBe(direction);
    }
    for (const { value: easing } of HOLO_REVEAL_EASINGS) {
      expect(normalizeHoloReveal({ holoRevealEasing: easing }).easing).toBe(easing);
    }
  });

  test('falls back from unknown options and clamps numeric values', () => {
    expect(normalizeHoloReveal({
      holoRevealMode: 'explode',
      holoRevealDirection: 'sideways',
      holoRevealEasing: 'mystery',
      holoRevealDuration: 99,
      holoRevealSoftness: -4
    })).toMatchObject({
      mode: 'fade',
      direction: 'right',
      easing: 'smooth',
      duration: 3,
      softness: 0
    });
  });
});
