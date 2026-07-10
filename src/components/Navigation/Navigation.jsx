import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { FiGithub } from 'react-icons/fi';
import { LuUserRound } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { fmtT26 } from '../../utils/economyRandom';

const REPO_URL = 'https://github.com/vilt9/requirement5';

// Account lives on the right (username / log-in), so it's out of the centre
// list. Discovery happens through Discover (draws surface published cards), so
// the Pool listing stays off the nav — the /pool route still answers deep links.
const LINKS = [
  { to: '/', label: 'Discover' },
  { to: '/collection', label: 'Collections' },
  { to: '/customize', label: 'Create' },
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
  const { user, stash, earnFlash } = useAuth();

  // Each letter is its own span; the non-base ones start collapsed and reveal
  // with a stagger so the word unrolls left to right on hover.
  let revealIndex = 0;

  return (
    <Bar>
      <Inner>
        <Brand to="/" aria-label="Requirement5 cards">
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
        <GitHubLink
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Source on GitHub"
          aria-label="Source on GitHub"
        >
          <FiGithub />
        </GitHubLink>
        <Balance to="/account" className="nav-balance" aria-label="Your account">
          <LuUserRound className="usericon" aria-hidden />
          <span className="body">
            {user
              ? <><span className="who">{user.username} · </span><b>{fmtT26(user.balance, 3)} /t26</b></>
              : stash > 0
                ? <><b>{fmtT26(stash, 3)} /t26</b> <span className="who">· log in to claim</span><span className="short">· claim</span></>
                : <span className="dim"><span className="who">Not logged in</span><span className="short">Log in</span></span>}
          </span>
          {/* The earn, made visible — quietly: a small tick under the total
              that fades in and out. Re-keyed per generate. */}
          {earnFlash && (
            <EarnTick key={earnFlash.seq} aria-hidden>+{fmtT26(earnFlash.amount)}</EarnTick>
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
  max-width: 880px;
  margin: 0 auto;
  padding: 0 15px;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 16px;

  @media (max-width: 640px) {
    gap: 10px;
    padding: 0 10px;
    font-size: 12px;
  }
`;

const Brand = styled(Link)`
  color: var(--white);
  font-family: var(--font-sans);
  font-weight: 700;
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
  &:hover span.rest {
    /* Generous cap so wide glyphs (m, w) never clip — the box still settles at
       each letter's real width; the extra headroom just finishes off-screen. */
    max-width: 2ch;
    opacity: 1;
    transform: translateY(0);
  }
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

  @media (max-width: 640px) {
    gap: 10px;
  }
`;

const NavLink = styled(Link)`
  color: var(--amber-dim);
  white-space: nowrap;
  &:hover { color: var(--white); text-decoration: none; }
  &.active { color: var(--gold-bright); font-weight: 700; }
`;

const GitHubLink = styled.a`
  display: flex;
  align-items: center;
  color: var(--amber-dim);
  font-size: 16px;
  &:hover { color: var(--white); text-decoration: none; }

  @media (max-width: 640px) {
    display: none;
  }
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
  .dim { color: var(--amber-dim); }
  .short { display: none; }
  /* The account glyph — always present, so on phones (where the text trims to
     a bare balance) there's still a clear tap target for the account. */
  .usericon { font-size: 15px; flex-shrink: 0; }

  /* Phones: keep the balance, drop the username / long label. */
  @media (max-width: 640px) {
    .who { display: none; }
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
  color: var(--gold-bright);
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
