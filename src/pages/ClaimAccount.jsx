import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Page, Panel, Divider, Dim, PillButton, TextInput, ErrorText } from '../components/UI';
import { fmtT26 } from '../utils/economyRandom';

// The landing page for a pre-created account claim link (/claim/:token). It
// previews the username, balance, and cards before the owner activates it.
const ClaimAccount = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { claim, user } = useAuth();

  const [info, setInfo] = useState(null);      // { username, balance, cards }
  const [loadError, setLoadError] = useState(null);
  const [password, setPassword] = useState('');
  // Claiming is a real person taking over the account, so the same 18+ gate and
  // Terms acceptance as a fresh signup apply here.
  const [dob, setDob] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/api/auth/claim/${token}`)
      .then(setInfo)
      .catch(err => setLoadError(err.message));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (!accepted) {
      setError('Please confirm you are 18+ and accept the Terms and Privacy Policy.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await claim(token, password, dob, accepted);
      navigate('/collection', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <ClaimPage>
        <Panel>
          This claim link is invalid or has already been used.
          <Divider />
          <Dim>If you already claimed your account, just <Link to="/account">log in</Link>.</Dim>
        </Panel>
      </ClaimPage>
    );
  }

  if (!info) {
    return <ClaimPage><Panel><Dim>Loading…</Dim></Panel></ClaimPage>;
  }

  return (
    <ClaimPage>
      <Panel>
        We turned your post into Requirement5cards, and set aside the
        account <b>{info.username}</b> for you.
        <Divider />
        {info.cards.length > 0 ? (
          <>
            {info.cards.length} private card{info.cards.length === 1 ? '' : 's'} waiting for you,
            plus a balance of <b>{fmtT26(info.balance)} /t26</b>:
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {info.cards.map(c => (
                <li key={c.id}>
                  <Link to={`/card/${c.id}`}>{c.name || 'Untitled'}</Link>{' '}
                  <Dim>· {c.is_public ? c.tier : 'ready to edit and publish'}</Dim>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>Your account comes with a balance of <b>{fmtT26(info.balance)} /t26</b>.</>
        )}
      </Panel>

      <Panel as="form" onSubmit={submit}>
        Set a password to claim <b>{info.username}</b> — it&apos;s then yours: the
        cards, the balance, and the choice to edit each card before publishing it
        to the pool.
        <Divider />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TextInput
            type="password"
            placeholder="Choose a password (8+ characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <DobField>
            <span>Date of birth</span>
            <TextInput
              type="date"
              value={dob}
              onChange={e => setDob(e.target.value)}
              autoComplete="bday"
              required
            />
          </DobField>
          <Consent>
            <input
              type="checkbox"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
            />
            <span>
              I am 18 or over and I accept the{' '}
              <Link to="/terms" target="_blank">Terms</Link> and{' '}
              <Link to="/privacy" target="_blank">Privacy Policy</Link>.
            </span>
          </Consent>
          {error && <ErrorText>{error}</ErrorText>}
          <div><PillButton type="submit" disabled={busy}>Claim this account</PillButton></div>
        </div>
        {user && <Dim>Note: claiming will switch you out of your current session.</Dim>}
      </Panel>
    </ClaimPage>
  );
};

const ClaimPage = styled(Page)`
  text-align: left;
`;

const DobField = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--amber-dim);
`;

const Consent = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--amber-text);
  cursor: pointer;
  input { margin-top: 2px; flex-shrink: 0; accent-color: var(--gold); }
  a { text-decoration: underline; }
`;

export default ClaimAccount;
