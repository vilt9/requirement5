import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { FiGithub } from 'react-icons/fi';
import { FaDiscord } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { fmtT26 } from '../../utils/economyRandom';

const REPO_URL = 'https://github.com/vilt9/requirement5';
const DISCORD_URL = 'https://discord.gg/ywRCSATau3';

// Account lives on the right (username / log-in), so it's out of the centre
// list. Discovery happens through Discover (draws surface published cards), so
// the Pool listing stays off the nav — the /pool route still answers deep links.
const LINKS = [
  { to: '/', label: 'Discover' },
  { to: '/collection', label: 'Collections' },
  { to: '/create', label: 'Create' },
  { to: '/about', label: 'About' }
];

// The logo reads "R5c" at rest and grows to the full "Requirement5cards" on
// hover, the in-between letters cascading in one at a time. "R5c" is a
// subsequence of the full word (R·…·5·c), so the same letters stay put while
// the rest unfold between them.
const LOGO_FULL = 'Requirement5cards';
const LOGO_BASE = new Set([0, 11, 12]); // R, 5, c — always visible

const Navigation = () => {
  const location = useLocation();
  const { user, config, stash, earnFlash } = useAuth();
  const debtFloor = config?.debtFloor ?? -1000;
  const ratePct = ((config?.debtInterestDaily ?? 0.0147) * 100).toFixed(2);

  // Each letter is its own span; the non-base ones start collapsed and reveal
  // with a stagger so the word unrolls left to right on hover.
  let revealIndex = 0;

  // The logo's unrolled state is driven from here, not from CSS :hover — a touch
  // tap triggers a sticky hover that never clears, so on phones the word would
  // stay expanded forever. Opening arms an auto-collapse timer for touch/pen
  // (which have no reliable "leave"); a real mouse collapses on pointerleave.
  const [logoOpen, setLogoOpen] = useState(false);
  const logoTimer = useRef(null);
  const openLogo = (e) => {
    clearTimeout(logoTimer.current);
    setLogoOpen(true);
    if (!e || e.pointerType !== 'mouse') {
      logoTimer.current = setTimeout(() => setLogoOpen(false), 2600);
    }
  };
  const closeLogo = () => { clearTimeout(logoTimer.current); setLogoOpen(false); };
  useEffect(() => () => clearTimeout(logoTimer.current), []);

  return (
    <Bar>
      <Inner>
        <Brand
          to="/"
          aria-label="Requirement5cards"
          className={logoOpen ? 'open' : ''}
          onPointerEnter={openLogo}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') closeLogo(); }}
          onFocus={() => openLogo()}
          onBlur={closeLogo}
        >
          {LOGO_FULL.split('').map((ch, i) => {
            const base = LOGO_BASE.has(i);
            return (
              <span
                key={i}
                className={base ? 'base' : 'rest'}
                style={base ? undefined : { transitionDelay: `${(revealIndex++) * 24}ms` }}
              >
                {ch}
              </span>
            );
          })}
        </Brand>
        <Links>
          {LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={location.pathname === link.to ? 'active' : ''}
            >
              {link.label}
            </NavLink>
          ))}
        </Links>
        <IconLinks>
          <IconLink
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Join us on Discord"
            aria-label="Join us on Discord"
          >
            <FaDiscord />
          </IconLink>
          <IconLink
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Source on GitHub"
            aria-label="Source on GitHub"
          >
            <FiGithub />
          </IconLink>
        </IconLinks>
        <Balance to="/account" className="nav-balance" aria-label="Your account">
          <span className="body">
            {user
              ? <>
                  <span className="who">{user.username} · </span>
                  <b className={user.balance < 0 ? 'debt' : ''}>{fmtT26(user.balance, 3)} /t26</b>
                  <span className="floor"> / {debtFloor}</span>
                  {user.balance < 0 && <span className="rate"> · {ratePct}%/day</span>}
                </>
              : stash > 0
                ? <><b>{fmtT26(stash, 3)} /t26</b> <span className="who">· log in to claim</span><span className="short">· claim</span></>
                : <span className="dim"><span className="who">Not logged in</span><span className="short">Log in</span></span>}
          </span>
          {/* The earn, made visible — quietly: a small tick under the total
              that fades in and out. Re-keyed per generate. */}
          {earnFlash && (
            <EarnTick key={earnFlash.seq} $negative={earnFlash.amount < 0} aria-hidden>
              {earnFlash.amount < 0 ? '−' : '+'}{fmtT26(Math.abs(earnFlash.amount))}
            </EarnTick>
          )}
        </Balance>
      </Inner>
    </Bar>
  );
};

const Bar = styled.nav`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.85);
  border-bottom: 1px solid var(--panel-border);
  backdrop-filter: blur(6px);
  z-index: 1000;

  /* Phones: vertical space is scarce — let the nav scroll away with the page. */
  @media (max-width: 640px) {
    position: static;
  }
`;

const Inner = styled.div`
  /* Full-bleed on desktop: logo hard left, balance hard right — no centred
     880px lane. Page content below still centres; only the bar spans edge to
     edge. */
  width: 100%;
  padding: 0 22px;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 16px;

  /* Phones: two tiers. Row 1 is logo + balance; the nav links wrap to a full-
     width row 2 (see Links) instead of being squashed into one line. */
  @media (max-width: 640px) {
    flex-wrap: wrap;
    height: auto;
    gap: 10px;
    row-gap: 0;
    padding: 7px 12px;
    font-size: 13px;
  }
`;

const Brand = styled(Link)`
  color: var(--white);
  font-family: var(--font-mono);
  font-weight: 400;
  letter-spacing: -0.01em;
  white-space: nowrap;
  display: inline-flex;
  align-items: baseline;
  &:hover { text-decoration: none; color: var(--gold-bright); }

  span { display: inline-block; }
  /* The letters that fill out "Requirement…cards": collapsed at rest, unrolled
     on hover. max-width animates the reveal; each carries its own delay for the
     one-at-a-time cascade. */
  span.rest {
    max-width: 0;
    opacity: 0;
    overflow: hidden;
    transform: translateY(-1px);
    transition: max-width 0.2s ease, opacity 0.2s ease, transform 0.2s ease;
  }
  /* Reveal is driven by the .open class (set from React), not :hover — see the
     component for why. Generous cap so wide glyphs (m, w) never clip. */
  &.open span.rest {
    max-width: 2ch;
    opacity: 1;
    transform: translateY(0);
  }

  @media (max-width: 640px) { order: 1; }
`;

const Links = styled.div`
  display: flex;
  gap: 14px;
  flex: 1;
  /* min-width: 0 lets this flex item shrink below its content width — without
     it the links push the balance clean off narrow screens. */
  min-width: 0;
  overflow-x: auto;
  /* Horizontal swipe on phones without a scrollbar stealing height. */
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  /* Row 2 on phones: full-width tier below logo/balance, links spread edge to
     edge with room to breathe (no more single-line squash). */
  @media (max-width: 640px) {
    order: 3;
    flex: 0 0 100%;
    width: 100%;
    gap: 10px;
    justify-content: space-between;
    overflow-x: visible;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--panel-border);
  }
`;

const NavLink = styled(Link)`
  color: var(--amber-dim);
  white-space: nowrap;
  &:hover { color: var(--white); text-decoration: none; }
  &.active { color: var(--gold-bright); font-weight: 700; }

  @media (max-width: 640px) { padding: 2px 0; }
`;

const IconLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  @media (max-width: 640px) {
    display: none;
  }
`;

const IconLink = styled.a`
  display: flex;
  align-items: center;
  color: var(--amber-dim);
  font-size: 16px;
  &:hover { color: var(--white); text-decoration: none; }
`;

const Balance = styled(Link)`
  position: relative; /* the earn tick hangs off the total */
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--amber-dim);
  white-space: nowrap;
  &:hover { text-decoration: none; color: var(--white); }
  b { color: var(--gold-bright); }
  b.debt { color: #ff8a8a; }
  .dim { color: var(--amber-dim); }
  .short { display: none; }
  /* The debt floor sits quietly after the total; the interest rate shows in
     red, only while in the red. Both are desktop-only detail. */
  .floor { color: var(--amber-dim); }
  .rate { color: #ff8a8a; }

  /* Phones: sit at the right end of row 1; drop the username / floor / rate. */
  @media (max-width: 640px) {
    order: 2;
    margin-left: auto;
    .who, .floor, .rate { display: none; }
    .short { display: inline; }
  }
`;

// A generate's earn, ticking in just below the running total — small and
// quiet, gone in a couple of seconds. Absolute, so the nav never shifts.
const EarnTick = styled.span`
  position: absolute;
  top: calc(100% + 1px);
  right: 0;
  font-size: 10px;
  font-family: var(--font-mono);
  color: ${p => (p.$negative ? '#ff8a8a' : 'var(--gold-bright)')};
  pointer-events: none;
  opacity: 0;
  animation: earnTick 2.4s ease-out forwards;

  @keyframes earnTick {
    0%   { opacity: 0; transform: translateY(-2px); }
    18%  { opacity: 0.9; transform: translateY(0); }
    70%  { opacity: 0.9; }
    100% { opacity: 0; }
  }
`;

export default Navigation;
