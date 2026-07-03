// The global card-motion clock. Every card in loop/scrub mode reads the same
// phase (0..1 over one run of the track = two orbits of the card), so any
// number of cards on a page move in perfect sync — and every scrub bar drives
// the same clock, so dragging one scrubs them all. Pause/play is a global
// setting persisted in the browser.
const LOOP_MS = 12000;
const PAUSE_KEY = 'r5c_motion_paused';
const SPEED_KEY = 'r5c_motion_speed';

// The speed dial's stops, in loop-runs relative to the 12s base.
export const SPEEDS = [0.5, 1, 2, 4];

let paused = (() => {
  try { return localStorage.getItem(PAUSE_KEY) === '1'; } catch { return false; }
})();

let speed = (() => {
  try {
    const s = parseFloat(localStorage.getItem(SPEED_KEY));
    return SPEEDS.includes(s) ? s : 1;
  } catch { return 1; }
})();

// Virtual time: accumulates only while playing, scaled by the speed dial.
// Pause/speed changes fold elapsed time into `acc` first, so the phase never
// snaps — pausing freezes the pose, a speed change just changes the pace.
let acc = 0;
let lastResume = performance.now();

const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn({ paused, speed }));

const virtualNow = (t = performance.now()) =>
  (paused ? acc : acc + (t - lastResume) * speed);

// The shared phase, 0..1. Same value for every caller at the same instant.
export const loopPhase = (t) => {
  const p = (virtualNow(t) / LOOP_MS) % 1;
  return p < 0 ? p + 1 : p;
};

export const motionPaused = () => paused;

export const setMotionPaused = (next) => {
  if (next === paused) return;
  const t = performance.now();
  if (next) acc = virtualNow(t); else lastResume = t;
  paused = next;
  try { localStorage.setItem(PAUSE_KEY, next ? '1' : '0'); } catch { /* private mode */ }
  notify();
};

export const toggleMotion = () => setMotionPaused(!paused);

export const motionSpeed = () => speed;

export const setMotionSpeed = (next) => {
  if (!SPEEDS.includes(next) || next === speed) return;
  const t = performance.now();
  acc = virtualNow(t); // fold time elapsed at the OLD speed — no phase snap
  lastResume = t;
  speed = next;
  try { localStorage.setItem(SPEED_KEY, String(next)); } catch { /* private mode */ }
  notify();
};

// The speed dial: step to the next stop, wrapping around.
export const cycleMotionSpeed = () =>
  setMotionSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);

// Subscribe to pause/speed changes (returns an unsubscribe). The callback
// receives { paused, speed }.
export const onMotionChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// Jump the clock to a phase — dragging any bar scrubs every synced card.
// Works while paused too (manual scrub mode); the loop continues from the
// dragged pose on resume.
export const scrubTo = (p) => {
  const clamped = Math.max(0, Math.min(1, p));
  acc = clamped * LOOP_MS;
  lastResume = performance.now();
};

// The shiny zone along the track: [1/16 rest][1/2 shiny][7/16 rest] — the
// flat→shiny transition lands almost immediately after the top, so a fresh
// generate shows its holo character fast enough to judge (and re-roll).
export const SHINY_START = 0.0625;
export const SHINY_END = 0.5625;
export const inShinyZone = (p) => p > SHINY_START && p < SHINY_END;
