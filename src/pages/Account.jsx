import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Page, Panel, Row, PillButton, TextInput, Divider, Dim, ErrorText } from '../components/UI';
import { fmtT26 } from '../utils/economyRandom';

const TXN_LABELS = {
  grant: 'Signup grant',
  draw_yield: 'Draw yield',
  claimed_yield: 'Claimed logged-out stash',
  save: 'Card saved',
  dividend: 'Creator dividend',
  publish_stake: 'Publish stake',
  reroll: 'Card regeneration',
  create_stake: 'Card create fee',
  interest: 'Debt interest'
};

const AuthForm = ({ title, submitLabel, mode, onSubmit }) => {
  const isSignup = mode === 'signup';
  // On login this field holds a username OR an email (the identifier); on signup
  // it's strictly the username, with email captured separately below.
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isSignup) await onSubmit(username, email, password);
      else await onSubmit(username, password);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <Panel as="form" onSubmit={submit}>
      {title}
      <Divider />
      <Stack>
        <TextInput
          placeholder={isSignup ? 'Username' : 'Username or Earth email'}
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
        />
        {isSignup && (
          <TextInput
            type="email"
            placeholder="Earth email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        )}
        <TextInput
          type="password"
          placeholder="Password (8+ characters)"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
        />
        {error && <ErrorText>{error}</ErrorText>}
        <div><PillButton type="submit" disabled={busy}>{submitLabel}</PillButton></div>
      </Stack>
    </Panel>
  );
};

const Stack = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
);

const Account = () => {
  const { user, config, yieldRemaining, login, signup, logout, refreshBalance } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();

  // Arrived here mid-action (e.g. saving a card while logged out)? Once the
  // login/signup lands, send them straight back to finish what they started.
  useEffect(() => {
    if (user && location.state?.returnTo) {
      navigate(location.state.returnTo, { replace: true });
    }
  }, [user, location.state, navigate]);

  useEffect(() => {
    if (!user) return;
    refreshBalance();
    api('/api/economy/transactions')
      .then(setTransactions)
      .catch(error => console.error('Could not load transactions:', error));
  }, [user, refreshBalance]);

  if (!user) {
    return (
      <Page>
        <Panel>
          Accounts hold your /t26 balance, your collection, and your published cards.
          New accounts receive a grant of {config?.startingGrant ?? 50} /t26 from the cloud.
        </Panel>
        <Row>
          <AuthForm title="Log in" submitLabel="Log in" mode="login" onSubmit={login} />
          <AuthForm title="Create account" submitLabel="Sign up" mode="signup" onSubmit={signup} />
        </Row>
      </Page>
    );
  }

  return (
    <Page>
      <Panel>
        Account: {user.username}<br />
        Balance: <b style={user.balance < 0 ? { color: '#ff8a8a' } : undefined}>{fmtT26(user.balance)} /t26</b><br />
        Yield remaining today: {yieldRemaining != null ? fmtT26(yieldRemaining) : '—'} /t26 <Dim>(cap {config?.dailyYieldCap} /t26 per day)</Dim><br />
        Erosion: suppressed on this platform
        {user.balance < 0 && (
          <>
            <Divider />
            <DebtNote>
              In debt. Interest accrues at {((config?.debtInterestDaily ?? 0.0147) * 100).toFixed(2)}% per day,
              compounding, until you’re back in the black. Spending stops at the{' '}
              {fmtT26(config?.debtFloor ?? -1000)} /t26 floor — generate to earn your way out.
            </DebtNote>
          </>
        )}
        <Divider />
        Your cards: <Link to="/collection">creations &amp; collection</Link>
        {' · '}<Link to="/create">design a new one</Link>
        <Divider />
        <PillButton $secondary onClick={logout}>Log out</PillButton>
      </Panel>

      <Panel>
        Ledger — most recent first:
        <Divider />
        {transactions.length === 0 && <Dim>No transactions yet.</Dim>}
        {transactions.map(txn => (
          <LedgerLine key={txn.id}>
            <span className="when">{new Date(txn.created_at).toISOString().slice(0, 16).replace('T', ' ')}</span>
            <span className="what">
              {TXN_LABELS[txn.type] || txn.type}
              {txn.card_id ? <Dim> · {txn.card_id}</Dim> : null}
              {txn.capped ? <Dim> · daily cap reached</Dim> : null}
            </span>
            <span className="amount" style={{ color: txn.amount > 0 ? '#21e985' : txn.amount < 0 ? '#ff6b6b' : '#888' }}>
              {txn.amount > 0 ? '+' : ''}{fmtT26(txn.amount)}
            </span>
            <span className="after"><Dim>{fmtT26(txn.balance_after)}</Dim></span>
          </LedgerLine>
        ))}
      </Panel>
    </Page>
  );
};

const DebtNote = styled.div`
  color: #ff8a8a;
  line-height: 1.6;
`;

const LedgerLine = styled.div`
  display: flex;
  gap: 10px;
  padding: 2px 0;
  .when { color: var(--amber-dim); flex-shrink: 0; }
  .what { flex: 1; }
  .amount { width: 11ch; text-align: right; flex-shrink: 0; }
  .after { width: 8ch; text-align: right; flex-shrink: 0; }
`;

export default Account;
