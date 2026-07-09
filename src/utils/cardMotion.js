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

// A hand on the dot freezes the clock — a held scrub must not drift — and
// after release it stays frozen a beat longer so the chosen pose can be
// looked at before the loop carries on. Deliberately separate from `paused`:
// this is a transient grip, never persisted, never shown on the ▶/❚❚ button.
const RESUME_DELAY_MS = 3000;
let held = false;
let resumeAt = 0; // a released grip keeps the clock frozen until this time
let resumeFrom = 0; // when the current delay was armed (for the countdown UI)

const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn({ paused, speed }));

const virtualNow = (t = performance.now()) => {
  if (paused || held || t < resumeAt) return acc;
  if (resumeAt) { resumeAt = 0; lastResume = t; } // delay elapsed: clock restarts here
  return acc + (t - lastResume) * speed;
};

// The grip: MotionBar calls these around a drag. While held the clock is
// frozen solid (scrubTo still moves it — that's the hand), and release arms
// the resume delay.
export const beginScrub = () => {
  acc = virtualNow();
  held = true;
};

export const endScrub = () => {
  if (!held) return;
  held = false;
  resumeFrom = performance.now();
  resumeAt = resumeFrom + RESUME_DELAY_MS;
};

// Hovering the card to drive the holo by hand: snap the loop to the flat top and
// freeze it, so the bar stops looping under your mouse and the card sits in its
// natural rest pose for interaction. After the pointer leaves, the loop stays
// parked a short beat (with a visible countdown on the bar) before carrying on.
const HOVER_RESUME_DELAY_MS = 4000;
export const beginHoverHold = () => {
  scrubTo(0);   // move the loop to the top (flat) — the bar dot parks there
  held = true;  // freeze it while the hand is on the card
};

export const endHoverHold = () => {
  if (!held) return;
  held = false;
  resumeFrom = performance.now();
  resumeAt = resumeFrom + HOVER_RESUME_DELAY_MS;
};

// Fraction of the parked delay STILL REMAINING (1 → 0), or null when the clock
// isn't in a transient hold. Drives the countdown ring on the motion bar. A
// held grip (hand still down) shows no countdown — it hasn't started yet.
export const resumeCountdown = (t = performance.now()) => {
  if (paused || held || !resumeAt || t >= resumeAt || resumeAt <= resumeFrom) return null;
  return (resumeAt - t) / (resumeAt - resumeFrom);
};

// The shared phase, 0..1. Same value for every caller at the same instant.
export const loopPhase = (t) => {
  const p = (virtualNow(t) / LOOP_MS) % 1;
  return p < 0 ? p + 1 : p;
};

export const motionPaused = () => paused;

export const setMotionPaused = (next) => {
  if (next === paused) return;
  const t = performance.now();
  if (next) {
    acc = virtualNow(t);
  } else {
    // Explicit play cancels any transient hold (a scrub/hover park) so motion
    // begins the instant the button is pressed, not after the countdown.
    held = false;
    resumeAt = 0;
    lastResume = t;
  }
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

// The run's four stretches:
//   [1/20 flat] [9/20 holo rotation] [9/20 plain rotation] [1/20 flat]
// The flat ends hold the card completely still, so every loop shows the
// card COME TO LIFE — the transition from flat to moving that constant
// rotation never let you see. A fresh generate starts at the top: a beat of
// flat, then straight into the holo.
export const FLAT_FRAC = 0.05;
export const SHINY_START = FLAT_FRAC; // the holo wakes the moment motion does
export const SHINY_END = 0.5;
export const inShinyZone = (p) => p > SHINY_START && p < SHINY_END;
export const inFlatZone = (p) => p < FLAT_FRAC || p > 1 - FLAT_FRAC;
