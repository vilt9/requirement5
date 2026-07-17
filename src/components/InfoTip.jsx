import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

// A small "(i)" that reveals an explanation. Opens on hover (desktop) and
// toggles on tap (mobile); tapping elsewhere or pressing Escape closes it.
const InfoTip = ({ children, label = 'More info' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <Wrap
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
      >
        i
      </button>
      {open && <Bubble role="tooltip">{children}</Bubble>}
    </Wrap>
  );
};

const Wrap = styled.span`
  position: relative;
  display: inline-flex;
  vertical-align: middle;

  button {
    width: 14px;
    height: 14px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid var(--panel-border);
    background: transparent;
    color: var(--amber-dim);
    font-family: var(--font-mono);
    font-size: 10px;
    font-style: italic;
    line-height: 1;
    cursor: pointer;
  }
  button:hover { color: var(--gold-bright); border-color: var(--gold); }
`;

const Bubble = styled.span`
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  width: max-content;
  max-width: 240px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--panel-border);
  /* Opaque, not the translucent --panel — the bubble floats over card art and
     detail text, and must stay legible on top of them. */
  background: #120d06;
  backdrop-filter: blur(4px);
  color: var(--amber-text);
  font-size: 11px;
  font-weight: 400;
  line-height: 1.45;
  letter-spacing: 0;
  text-align: left;
  white-space: normal;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);

  b { color: var(--gold-bright); }
`;

export default InfoTip;
