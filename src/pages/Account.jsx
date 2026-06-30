import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Page, Panel, Row, PillButton, TextInput, Divider, Dim, ErrorText } from '../components/UI';

const TXN_LABELS = {
  grant: 'Signup grant',
  draw_yield: 'Draw yield',
  save: 'Card saved',
  dividend: 'Creator dividend',
  publish_stake: 'Publish stake'
};

const AuthForm = ({ title, submitLabel, onSubmit }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(username, password);
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
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
        />
        <TextInput
          type="password"
          placeholder="Password (8+ characters)"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={submitLabel === 'Sign up' ? 'new-password' : 'current-password'}
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
          <AuthForm title="Log in" submitLabel="Log in" onSubmit={login} />
          <AuthForm title="Create account" submitLabel="Sign up" onSubmit={signup} />
        </Row>
      </Page>
    );
  }

  return (
    <Page>
      <Panel>
        Account: {user.username}<br />
        Balance: <b>{user.balance} /t26</b><br />
        Yield remaining today: {yieldRemaining ?? '—'} /t26 <Dim>(cap {config?.dailyYieldCap} /t26 per day)</Dim><br />
        Erosion: suppressed on this platform
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
              {txn.amount > 0 ? '+' : ''}{txn.amount}
            </span>
            <span className="after"><Dim>{txn.balance_after}</Dim></span>
          </LedgerLine>
        ))}
      </Panel>
    </Page>
  );
};

const LedgerLine = styled.div`
  display: flex;
  gap: 10px;
  padding: 2px 0;
  .when { color: var(--amber-dim); flex-shrink: 0; }
  .what { flex: 1; }
  .amount { width: 7ch; text-align: right; flex-shrink: 0; }
  .after { width: 8ch; text-align: right; flex-shrink: 0; }
`;

export default Account;
