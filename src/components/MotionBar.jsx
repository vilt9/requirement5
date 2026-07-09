import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  loopPhase, scrubTo, beginScrub, endScrub,
  motionPaused, toggleMotion, onMotionChange,
  motionSpeed, cycleMotionSpeed,
  FLAT_FRAC, SHINY_END, resumeCountdown
} from '../utils/cardMotion';

// The universal card-motion bar: a vertical track whose dot rides the global
// motion clock. Dragging the dot scrubs that clock — every synced card on the
// page follows. The track wears the run's three states: dotted ends where
// the card lies flat, a gold stretch where the holo shines, a plain line
// where it rotates without holo. The button at the base pauses/plays card
// motion everywhere (persisted in the browser).
//
// This component carries the bar's look; each placement wraps it with
// styled(MotionBar) to add positioning only.
const MotionBar = ({ className }) => {
  const trackRef = useRef(null);
  const dotRef = useRef(null);
  const timerRef = useRef(null);
  const draggingRef = useRef(false);
  const [paused, setPaused] = useState(motionPaused());
  const [speed, setSpeed] = useState(motionSpeed());

  useEffect(() => onMotionChange(({ paused: p, speed: s }) => {
    setPaused(p);
    setSpeed(s);
  }), []);

  // The dot mirrors the clock — a transform write per frame (never `top`,
  // which would dirty layout every frame). Track height is cached and kept
  // fresh by a ResizeObserver so the frame loop does zero DOM reads; a
  // paused clock produces the same string and skips the write entirely.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    let trackH = track.clientHeight;
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => { trackH = track.clientHeight; })
      : null;
    if (ro) ro.observe(track);
    let raf;
    let last = '';
    let lastRing = '';
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      if (!dotRef.current) return;
      // Countdown ring: drains over the parked delay so you can see the loop is
      // about to carry on. Updated BEFORE the dot's early-out, because the clock
      // is frozen during a hold (same phase every frame) and would skip it.
      if (timerRef.current) {
        const rc = resumeCountdown(t);
        if (rc == null) {
          if (lastRing !== '') { timerRef.current.style.opacity = '0'; lastRing = ''; }
        } else {
          const ring = `conic-gradient(var(--gold-bright) ${(rc * 360).toFixed(0)}deg, rgba(255,255,255,0.14) 0deg)`;
          if (ring !== lastRing) {
            timerRef.current.style.background = ring;
            timerRef.current.style.opacity = '1';
            lastRing = ring;
          }
        }
      }
      const next = `translate(-50%, ${(loopPhase(t) * trackH).toFixed(1)}px) translateY(-50%)`;
      if (next === last) return;
      last = next;
      dotRef.current.style.transform = next;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); if (ro) ro.disconnect(); };
  }, []);

  // Unmounting mid-drag (e.g. navigating away) must release the grip, or the
  // global clock would stay frozen with no hand on it.
  useEffect(() => () => { if (draggingRef.current) endScrub(); }, []);

  const scrubFromEvent = (e) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    scrubTo((e.clientY - rect.top) / rect.height);
  };
  const onDown = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    try { trackRef.current.setPointerCapture(e.pointerId); } catch { /* already released */ }
    beginScrub(); // a held dot must not drift — the clock freezes under the hand
    scrubFromEvent(e);
  };
  const onMove = (e) => {
    if (draggingRef.current) scrubFromEvent(e);
  };
  const onUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    endScrub(); // release arms a short delay before the loop carries on
  };

  return (
    <Bar className={className}>
      <div
        className="track"
        ref={trackRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <span className="dots dots-top" />
        <span className="zone" />
        <span className="line" />
        <span className="dots dots-bottom" />
        <span className="dot" ref={dotRef}>
          <span className="dot-ring" ref={timerRef} />
        </span>
      </div>
      {/* The speed dial: taps step through the stops, everywhere at once. */}
      <button
        type="button"
        className="speed"
        onClick={cycleMotionSpeed}
        title="Card motion speed (everywhere) — tap to change"
        aria-label={`Card motion speed ${speed}x — tap to change`}
      >
        {speed}×
      </button>
      <button
        type="button"
        className="pp"
        onClick={toggleMotion}
        title={paused ? 'Play card motion (everywhere)' : 'Pause card motion (everywhere)'}
        aria-label={paused ? 'Play card motion' : 'Pause card motion'}
      >
        {paused ? '▶' : '❚❚'}
      </button>
    </Bar>
  );
};

const Bar = styled.div`
  /* Placement (position/size) comes from the wrapping styled(MotionBar). */

  .track {
    position: absolute;
    top: 0;
    bottom: 64px; /* room for the speed dial + pause/play at the base */
    left: 0;
    right: 0;
    touch-action: none; /* dragging the dot must never scroll the page */
  }

  .line, .zone, .dots {
    position: absolute;
    left: 50%;
    width: 2px;
    transform: translateX(-50%);
    border-radius: 1px;
    pointer-events: none;
  }
  /* Dotted ends: the card lies flat here. */
  .dots {
    width: 3px;
    background-image: radial-gradient(circle, rgba(255, 255, 255, 0.5) 1px, transparent 1.4px);
    background-size: 3px 6px;
    background-repeat: repeat-y;
    background-position: center;
  }
  .dots-top { top: 0; height: ${FLAT_FRAC * 100}%; }
  .dots-bottom { bottom: 0; height: ${FLAT_FRAC * 100}%; }
  /* Gold stretch: rotating with the holo alive. */
  .zone {
    top: ${FLAT_FRAC * 100}%;
    bottom: ${(1 - SHINY_END) * 100}%;
    background: rgba(232, 180, 85, 0.45);
  }
  /* Plain line: rotating, holo off. */
  .line {
    top: ${SHINY_END * 100}%;
    bottom: ${FLAT_FRAC * 100}%;
    background: rgba(255, 255, 255, 0.16);
  }

  .dot {
    position: absolute;
    left: 50%;
    top: 0; /* the frame loop positions it via transform, never top */
    width: 22px;
    height: 22px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: rgba(248, 212, 136, 0.85);
    border: 2px solid rgba(0, 0, 0, 0.4);
    box-shadow: 0 0 10px rgba(232, 180, 85, 0.45);
    pointer-events: none;
  }

  /* Countdown ring around the parked dot: a gold arc that drains as the loop's
     auto-resume approaches. Hidden (opacity 0) except during that window; the
     conic-gradient + opacity are written per frame by the tick. */
  .dot .dot-ring {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
    -webkit-mask: radial-gradient(farthest-side, transparent 62%, #000 64%);
    mask: radial-gradient(farthest-side, transparent 62%, #000 64%);
  }

  .pp, .speed {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: 50%;
    border: 1px solid var(--panel-border);
    background: rgba(8, 6, 3, 0.85);
    color: var(--gold-bright);
    font-size: 9px;
    line-height: 1;
    cursor: pointer;
    display: grid;
    place-items: center;

    &:hover { border-color: var(--gold); color: var(--white); }
  }
  .speed { bottom: 30px; font-family: var(--font-mono); }
  .pp { bottom: 0; }
`;

export default MotionBar;
