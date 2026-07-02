import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { FiGithub } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { fmtT26 } from '../../utils/economyRandom';

const REPO_URL = 'https://github.com/vilt9/requirement5';

// Discovery happens through Generate (draws surface published cards), so the
// Pool listing left the nav — the /pool route still answers deep links.
const LINKS = [
  { to: '/', label: 'Generate' },
  { to: '/collection', label: 'Collection' },
  { to: '/customize', label: 'Create' },
  { to: '/about', label: 'About' },
  { to: '/account', label: 'Account' }
];

const Navigation = () => {
  const location = useLocation();
  const { user, stash, earnFlash } = useAuth();

  return (
    <Bar>
      <Inner>
        <Brand to="/">R5c <span>// Requirement5 cards</span></Brand>
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
        <Balance to="/account" className="nav-balance">
          {user
            ? <><span className="who">{user.username} · </span><b>{fmtT26(user.balance, 3)} /t26</b></>
            : stash > 0
              ? <><b>{fmtT26(stash, 3)} /t26</b> <span className="who">· log in to claim</span><span className="short">· claim</span></>
              : <span className="dim"><span className="who">Not logged in</span><span className="short">Log in</span></span>}
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
  letter-spacing: -0.02em;
  white-space: nowrap;
  &:hover { text-decoration: none; color: var(--gold-bright); }
  span { color: var(--amber-dim); font-weight: 400; font-family: var(--font-mono); }

  @media (max-width: 640px) {
    span { display: none; }
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
  color: var(--amber-dim);
  white-space: nowrap;
  &:hover { text-decoration: none; color: var(--white); }
  b { color: var(--gold-bright); }
  .dim { color: var(--amber-dim); }
  .short { display: none; }

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
