import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  loopPhase, scrubTo, motionPaused, toggleMotion, onMotionChange,
  motionSpeed, cycleMotionSpeed,
  SHINY_START, SHINY_END
} from '../utils/cardMotion';

// The universal card-motion bar: a vertical track whose dot rides the global
// motion clock. Dragging the dot scrubs that clock — every synced card on the
// page follows. The gold stretch is the shiny zone; the button at the base
// pauses/plays card motion everywhere (persisted in the browser).
//
// This component carries the bar's look; each placement wraps it with
// styled(MotionBar) to add positioning only.
const MotionBar = ({ className }) => {
  const trackRef = useRef(null);
  const dotRef = useRef(null);
  const draggingRef = useRef(false);
  const [paused, setPaused] = useState(motionPaused());
  const [speed, setSpeed] = useState(motionSpeed());

  useEffect(() => onMotionChange(({ paused: p, speed: s }) => {
    setPaused(p);
    setSpeed(s);
  }), []);

  // The dot mirrors the clock — cheap DOM write, no re-render per frame.
  useEffect(() => {
    let raf;
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      if (dotRef.current) dotRef.current.style.top = `${loopPhase(t) * 100}%`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const scrubFromEvent = (e) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    scrubTo((e.clientY - rect.top) / rect.height);
  };
  const onDown = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    try { trackRef.current.setPointerCapture(e.pointerId); } catch { /* already released */ }
    scrubFromEvent(e);
  };
  const onMove = (e) => {
    if (draggingRef.current) scrubFromEvent(e);
  };
  const onUp = () => { draggingRef.current = false; };

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
        <span className="line" />
        <span className="zone" />
        <span className="dot" ref={dotRef} />
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

  .line, .zone {
    position: absolute;
    left: 50%;
    width: 2px;
    transform: translateX(-50%);
    border-radius: 1px;
    pointer-events: none;
  }
  .line { top: 0; bottom: 0; background: rgba(255, 255, 255, 0.16); }
  .zone {
    top: ${SHINY_START * 100}%;
    bottom: ${(1 - SHINY_END) * 100}%;
    background: rgba(232, 180, 85, 0.45);
  }

  .dot {
    position: absolute;
    left: 50%;
    top: 0%;
    width: 22px;
    height: 22px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: rgba(248, 212, 136, 0.85);
    border: 2px solid rgba(0, 0, 0, 0.4);
    box-shadow: 0 0 10px rgba(232, 180, 85, 0.45);
    pointer-events: none;
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
