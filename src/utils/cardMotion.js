// The global card-motion clock. Every card in loop/scrub mode reads the same
// phase (0..1 over one run of the track = two orbits of the card), so any
// number of cards on a page move in perfect sync — and every scrub bar drives
// the same clock, so dragging one scrubs them all. Pause/play is a global
// setting persisted in the browser.
const LOOP_MS = 12000;
const PAUSE_KEY = 'r5c_motion_paused';

let paused = (() => {
  try { return localStorage.getItem(PAUSE_KEY) === '1'; } catch { return false; }
})();

// Virtual time: accumulates only while playing, so pausing freezes the phase
// and resuming continues from the same pose — no snap.
let acc = 0;
let lastResume = performance.now();

const listeners = new Set();

const virtualNow = (t = performance.now()) => (paused ? acc : acc + (t - lastResume));

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
  listeners.forEach((fn) => fn(paused));
};

export const toggleMotion = () => setMotionPaused(!paused);

// Subscribe to pause/play changes (returns an unsubscribe).
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

// The shiny zone along the track: [1/8 rest][1/2 shiny][3/8 rest] — the holo
// shows itself quickly after the top, with a longer wind-down after.
export const SHINY_START = 0.125;
export const SHINY_END = 0.625;
export const inShinyZone = (p) => p > SHINY_START && p < SHINY_END;
