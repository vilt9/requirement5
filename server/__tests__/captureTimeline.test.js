import { buildCaptureStates } from '../services/capture.js';

describe('moving media capture timeline', () => {
  const restFrames = 8;
  const orbitFrames = 75;
  const baseFrames = 18;

  test('runs flat base, one shiny orbit, then restored flat base', () => {
    const states = buildCaptureStates({ restFrames, orbitFrames, baseFrames });

    expect(states).toHaveLength(restFrames + orbitFrames + baseFrames);
    expect(states[0]).toEqual({ nx: 0, ny: 0, shiny: false, scale: 0.95 });
    expect(states[restFrames].shiny).toBe(true);
    expect(states[restFrames + orbitFrames - 1]).toMatchObject({
      nx: expect.closeTo(0),
      ny: expect.closeTo(0),
      shiny: true,
      scale: expect.closeTo(0.95)
    });
    expect(states.at(-1)).toEqual({ nx: 0, ny: 0, shiny: false, scale: 0.95 });
  });

  test('never rotates after shine disengages', () => {
    const states = buildCaptureStates({ restFrames, orbitFrames, baseFrames });
    const plainStates = states.filter(state => !state.shiny);

    expect(plainStates.every(state => state.nx === 0 && state.ny === 0)).toBe(true);
    expect(states.some(state => state.shiny && (Math.abs(state.nx) > 0.2 || Math.abs(state.ny) > 0.2)))
      .toBe(true);
  });
});
