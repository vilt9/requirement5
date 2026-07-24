import { buildCaptureStates, captureOrbitState } from '../services/capture.js';

describe('moving media capture timeline', () => {
  const restFrames = 8;
  const orbitFrames = 75;

  test('runs a flat base followed by one uninterrupted shiny orbit', () => {
    const states = buildCaptureStates({ restFrames, orbitFrames });

    expect(states).toHaveLength(restFrames + orbitFrames);
    expect(states[0]).toEqual({ nx: 0, ny: 0, shiny: false, scale: 0.95 });
    expect(states[restFrames].shiny).toBe(true);
    expect(states[restFrames + orbitFrames - 1]).toMatchObject({
      nx: expect.closeTo(0),
      ny: expect.closeTo(0.45),
      shiny: true,
      scale: expect.closeTo(1)
    });
  });

  test('ramps into motion without returning to a flat non-shiny state', () => {
    const states = buildCaptureStates({ restFrames, orbitFrames });
    const plainStates = states.slice(0, restFrames);
    const shinyStates = states.slice(restFrames);

    expect(plainStates.every(state => state.nx === 0 && state.ny === 0)).toBe(true);
    expect(shinyStates.every(state => state.shiny)).toBe(true);
    expect(shinyStates.some(state => Math.abs(state.nx) > 0.2 || Math.abs(state.ny) > 0.2))
      .toBe(true);
    expect(Math.abs(shinyStates.at(-1).ny)).toBeGreaterThan(0.2);
  });

  test('continues the orbit during the fade instead of settling flat', () => {
    const beforeFade = captureOrbitState(1);
    const duringFade = captureOrbitState(1 + 1 / (orbitFrames - 1));

    expect(beforeFade.shiny).toBe(true);
    expect(duringFade.shiny).toBe(true);
    expect(duringFade.nx).not.toBeCloseTo(beforeFade.nx);
    expect(Math.abs(duringFade.nx) + Math.abs(duringFade.ny)).toBeGreaterThan(0.2);
  });
});
