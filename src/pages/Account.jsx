import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Page, Panel, Row, PillButton, TextInput, Divider, Dim, ErrorText } from '../components/UI';
import { fmtT26 } from '../utils/economyRandom';
import TopUpPanel from '../components/TopUpPanel';

// The app root is centered (leftover starter CSS); this page reads better
// left-aligned like a ledger.
const LeftPage = styled(Page)`
  text-align: left;
`;

const TXN_LABELS = {
  grant: 'Signup grant',
  draw_yield: 'Draw yield',
  claimed_yield: 'Claimed logged-out stash',
  save: 'Card saved',
  dividend: 'Creator dividend',
  publish_stake: 'Publish stake',
  reroll: 'Card regeneration',
  create_stake: 'Card create fee',
  interest: 'Debt interest',
  topup: 'Top-up purchase'
};

const AuthForm = ({ title, submitLabel, mode, onSubmit }) => {
  const isSignup = mode === 'signup';
  // On login this field holds a username OR an email (the identifier); on signup
  // it's strictly the username, with email captured separately below.
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Signup only: a real date of birth (the 18+ gate is enforced server-side)
  // and explicit acceptance of the Terms + Privacy Policy.
  const [dob, setDob] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (isSignup && !accepted) {
      setError('Please confirm you are 18+ and accept the Terms and Privacy Policy.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isSignup) await onSubmit(username, email, password, dob, accepted);
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
        {isSignup && (
          <>
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
          </>
        )}
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
  const { user, config, login, signup, logout, refreshBalance } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [topupNote, setTopupNote] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  const loadTransactions = useCallback(() => {
    api('/api/economy/transactions')
      .then(setTransactions)
      .catch(error => console.error('Could not load transactions:', error));
  }, []);

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
    loadTransactions();
  }, [user, refreshBalance, loadTransactions]);

  // Back from Stripe Checkout (?topup=success|cancel). The purchase is credited
  // asynchronously by the webhook, which races this redirect — so we poll the
  // balance/ledger a few times to catch the credit as it lands, then drop the
  // query param so a refresh doesn't replay the notice.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const outcome = params.get('topup');
    if (!outcome) return;
    if (outcome === 'success') {
      setTopupNote('Thanks — your top-up is being credited. Your balance updates below in a moment.');
      let tries = 0;
      const tick = () => { refreshBalance(); loadTransactions(); };
      tick();
      const timer = setInterval(() => {
        tick();
        if (++tries >= 5) clearInterval(timer);
      }, 2000);
      navigate('/account', { replace: true });
      return () => clearInterval(timer);
    }
    if (outcome === 'cancel') {
      setTopupNote('Checkout cancelled — no charge was made.');
      navigate('/account', { replace: true });
    }
  }, [location.search, navigate, refreshBalance, loadTransactions]);

  if (!user) {
    return (
      <LeftPage>
        <Panel>
          Accounts hold your /t26 balance, your collection, and your published cards.
          New accounts receive a grant of {config?.startingGrant ?? 50} /t26 from the cloud.
          <br /><Dim>You must be 18 or over to use Requirement5.</Dim>
        </Panel>
        <Row>
          <AuthForm title="Log in" submitLabel="Log in" mode="login" onSubmit={login} />
          <AuthForm title="Create account" submitLabel="Sign up" mode="signup" onSubmit={signup} />
        </Row>
      </LeftPage>
    );
  }

  return (
    <LeftPage>
      <Panel>
        Account: {user.username}<br />
        Balance: <b style={user.balance < 0 ? { color: '#ff8a8a' } : undefined}>{fmtT26(user.balance, 6)} /t26</b><br />
        Erosion: suppressed on this platform
        {user.balance < 0 && (
          <>
            <Divider />
            <DebtNote>
              You have a negative balance. The negative balance limit is{' '}
              {fmtT26(config?.debtFloor ?? -1000, 0)} /t26.
              <br /><br />
              Interest accrues at {((config?.debtInterestDaily ?? 0.0147) * 100).toFixed(2)}% per day,
              compounding, while your balance is negative.
            </DebtNote>
          </>
        )}
        <Divider />
        Your cards: <Link to="/collection">creations &amp; collection</Link>
        {' · '}<Link to="/create">design a new one</Link>
        <Divider />
        <PillButton $secondary onClick={logout}>Log out</PillButton>
      </Panel>

      {topupNote && <Panel><TopupNote>{topupNote}</TopupNote></Panel>}

      <TopUpPanel />

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
    </LeftPage>
  );
};

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

const DebtNote = styled.div`
  color: #ff8a8a;
  line-height: 1.6;
`;

const TopupNote = styled.div`
  color: var(--gold-bright);
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
