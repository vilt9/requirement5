import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { FiGithub } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

const REPO_URL = 'https://github.com/vilt9/requirement5';

const LINKS = [
  { to: '/', label: 'Generate' },
  { to: '/pool', label: 'Pool' },
  { to: '/collection', label: 'Collection' },
  { to: '/customize', label: 'Create' },
  { to: '/about', label: 'About' },
  { to: '/account', label: 'Account' }
];

const Navigation = () => {
  const location = useLocation();
  const { user } = useAuth();

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
        <Balance to="/account">
          {user
            ? <>{user.username} · <b>{user.balance} /t26</b></>
            : <span className="dim">Not logged in</span>}
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
`;

const Inner = styled.div`
  max-width: 880px;
  margin: 0 auto;
  padding: 0 15px;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 16px;
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
  overflow-x: auto;
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
`;

const Balance = styled(Link)`
  color: var(--amber-dim);
  white-space: nowrap;
  &:hover { text-decoration: none; color: var(--white); }
  b { color: var(--gold-bright); }
  .dim { color: var(--amber-dim); }
`;

export default Navigation;
