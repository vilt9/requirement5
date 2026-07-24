import { buildCapturePhases } from '../services/capture.js';

describe('moving media capture timeline', () => {
  test('samples one complete six-second card-page run at the export frame rate', () => {
    const phases = buildCapturePhases(6000, 25);

    expect(phases).toHaveLength(150);
    expect(phases[0]).toBe(0);
    expect(phases.at(-1)).toBe(1);
  });

  test('keeps every sampled phase bounded and strictly increasing', () => {
    const phases = buildCapturePhases(6000, 25);

    expect(phases.every(phase => phase >= 0 && phase <= 1)).toBe(true);
    expect(phases.every((phase, index) => index === 0 || phase > phases[index - 1])).toBe(true);
  });
});
