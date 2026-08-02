import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { useScrollBloom } from '../utils/useScrollBloom';

// A dismissal is a device preference, not account data. Keep it in localStorage
// so the transmission stays gone across visits without setting a cookie or
// involving the server.
const DISMISSED_KEY = 'r5c:mission-transmission-dismissed:v1';

const wasDismissed = () => {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    // Private browsing/storage denial should not make the site unusable. The
    // message can still be dismissed for the lifetime of this mounted page.
    return false;
  }
};

const MissionTransmission = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(() => !wasDismissed());
  const scrolling = useScrollBloom();

  const dismiss = () => {
    setVisible(false);
    try { window.localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* storage unavailable */ }
  };

  // /capture is a headless render surface used to export cards, not an app page.
  if (!visible || location.pathname.startsWith('/capture/')) return null;

  return (
    <Frame>
      <Gem $active={scrolling} role="region" aria-label="Requirement5 introduction">
        <Close type="button" onClick={dismiss} aria-label="Dismiss this transmission">
          <span aria-hidden="true">&times;</span>
        </Close>

        <Content>
          <Copy>
            <Lead>Your imagination is needed.</Lead>{' '}
            Generate, publish and collect cards to defend imagination on Umdo1.{' '}
            <AccountLink to="/account">Sign up with 300 /t26</AccountLink>, earn more
            with every Generate, and receive <Value>70% of the save price</Value> when
            someone collects your work.
          </Copy>
        </Content>
      </Gem>
    </Frame>
  );
};

const arrive = keyframes`
  from { opacity: 0; transform: translateY(-8px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

const Frame = styled.div`
  width: 100%;
  max-width: 760px;
  margin: 0 auto 24px;
  padding: 0 2px;
  text-align: left;

  @media (max-width: 640px) {
    margin: 8px auto 18px;
    padding: 0 10px;
  }
`;

const Gem = styled.aside`
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel);
  animation: ${arrive} 480ms cubic-bezier(0.2, 0.8, 0.2, 1) both;

  /* Same bloom language as the card-page colour readout: a quiet system border
     at rest, then the card's purple/pink/green palette comes alive only while
     the reader scrolls. The colour is confined to the one-pixel border. */
  &::before {
    content: '';
    position: absolute;
    z-index: 4;
    inset: 0;
    padding: 1px;
    border-radius: 7px;
    pointer-events: none;
    background: linear-gradient(
      104deg,
      hsl(265, 80%, 40%),
      hsl(325, 90%, 45%) 38%,
      rgba(0, 146, 255, 0.72) 58%,
      hsl(85, 85%, 40%) 82%,
      rgba(255, 255, 0, 0.62)
    );
    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: ${p => (p.$active ? 1 : 0)};
    transition: opacity ${p => (p.$active ? '1.5s' : '1.2s')} ease;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    &::before { transition: none; }
  }
`;

const Content = styled.div`
  position: relative;
  z-index: 2;
  padding: 15px 54px 15px 16px;

  @media (max-width: 640px) {
    padding: 14px 46px 14px 14px;
  }
`;

const Copy = styled.p`
  max-width: 650px;
  margin: 0;
  color: var(--amber-text);
  font-size: 12px;
  line-height: 1.68;
  letter-spacing: 0.005em;

  @media (max-width: 640px) {
    font-size: 11px;
    line-height: 1.62;
  }
`;

const Lead = styled.strong`
  color: var(--amber-text);
  font-weight: 700;
`;

const Value = styled.span`
  color: var(--gold-bright);
  font-weight: 400;
`;

const AccountLink = styled(Link)`
  color: var(--gold-bright);
  font-weight: 700;
  text-decoration: underline;
  text-decoration-color: rgba(248, 212, 136, 0.42);
  text-underline-offset: 0.22em;

  &:hover {
    color: var(--white);
    text-decoration-color: var(--white);
  }
`;

const Close = styled.button`
  position: absolute;
  z-index: 5;
  top: 8px;
  right: 8px;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--amber-dim);
  cursor: pointer;
  font-size: 23px;
  font-weight: 300;
  line-height: 1;
  transition: color 160ms ease, background 160ms ease, transform 160ms ease;

  &:hover {
    color: var(--white);
    background: rgba(255, 255, 255, 0.07);
    transform: rotate(6deg);
  }

  &:focus-visible {
    outline: 1px solid var(--gold-bright);
    outline-offset: 2px;
    color: var(--white);
  }

  @media (prefers-reduced-motion: reduce) { transition: none; }

  @media (max-width: 640px) {
    top: 4px;
    right: 4px;
    width: 44px;
    height: 44px;
  }
`;

export default MissionTransmission;
