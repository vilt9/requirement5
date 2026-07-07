import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Page, Panel, Divider, Dim, PillButton, TextInput, ErrorText } from '../components/UI';
import { fmtT26 } from '../utils/economyRandom';

// The landing page for a "gift" account claim link (/claim/:token). We made an
// account from someone's Midjourney posts and published cards under it; this is
// where they take it over by setting a password.
const ClaimAccount = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { claim, user } = useAuth();

  const [info, setInfo] = useState(null);      // { username, balance, cards }
  const [loadError, setLoadError] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/api/auth/claim/${token}`)
      .then(setInfo)
      .catch(err => setLoadError(err.message));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await claim(token, password);
      navigate('/collection', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <Page>
        <Panel>
          This claim link is invalid or has already been used.
          <Divider />
          <Dim>If you already claimed your account, just <Link to="/account">log in</Link>.</Dim>
        </Panel>
      </Page>
    );
  }

  if (!info) {
    return <Page><Panel><Dim>Loading…</Dim></Panel></Page>;
  }

  return (
    <Page>
      <Panel>
        We turned your Midjourney art into Requirement5 cards, and set aside the
        account <b>{info.username}</b> for you.
        <Divider />
        {info.cards.length > 0 ? (
          <>
            {info.cards.length} card{info.cards.length === 1 ? '' : 's'} waiting for you,
            plus a balance of <b>{fmtT26(info.balance)} /t26</b>:
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {info.cards.map(c => (
                <li key={c.id}>
                  <Link to={`/card/${c.id}`}>{c.name || 'Untitled'}</Link> <Dim>· {c.tier}</Dim>
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
        cards, the balance, and the ability to publish more.
        <Divider />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TextInput
            type="password"
            placeholder="Choose a password (8+ characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {error && <ErrorText>{error}</ErrorText>}
          <div><PillButton type="submit" disabled={busy}>Claim this account</PillButton></div>
        </div>
        {user && <Dim>Note: claiming will switch you out of your current session.</Dim>}
      </Panel>
    </Page>
  );
};

export default ClaimAccount;
