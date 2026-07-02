import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Panel, PillButton, TextInput, Select, Divider, Dim, ErrorText, TagList } from './UI';

// Publish the card being customized into the pool. Costs the publish stake;
// the chosen tier sets how often it appears and what each save pays you.
const PublishPanel = ({ customCard }) => {
  const { user, config, setBalance } = useAuth();
  const [name, setName] = useState('');
  const [tierKey, setTierKey] = useState('common');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [published, setPublished] = useState(null); // the created card record
  const [error, setError] = useState(null);

  const tier = config?.tiers?.find(t => t.key === tierKey);

  const publish = async () => {
    if (!customCard) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api('/api/cards/publish', {
        method: 'POST',
        body: {
          name: name || 'Untitled card',
          tier: tierKey,
          tags: customCard.tags || [],
          stateData: {
            customCard,
            timestamp: new Date().toISOString(),
            version: '1.0'
          }
        }
      });
      setBalance(result.balance);
      setPublished(result.card);
      setMessage(`Published to the pool. −${result.stake} /t26 stake. ` +
        `Your card now appears at ${tier?.odds ? `1 : ${tier.odds.toLocaleString()}` : 'common'} odds.`);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  if (!user) {
    return (
      <Panel>
        Publish to the pool
        <Divider />
        <Dim>Publishing a card needs an account. <Link to="/account">Sign up or log in</Link> to
        publish — your design is saved right here and will be waiting when you're back.</Dim>
      </Panel>
    );
  }

  return (
    <Panel>
      Publish to the pool
      <Divider />
      <Stack>
        <TextInput
          placeholder="Card name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <Select value={tierKey} onChange={e => setTierKey(e.target.value)}>
          {config?.tiers?.map(t => (
            <option key={t.key} value={t.key}>
              {t.name}{t.odds ? ` — 1 : ${t.odds.toLocaleString()}` : ''}
            </option>
          ))}
        </Select>
        {tier && (
          <div>
            <Dim>Appears at {tier.odds ? `1 : ${tier.odds.toLocaleString()}` : 'common'} odds.
            Every card rolls its own save price
            ({config?.pricing?.saveCost ? `${config.pricing.saveCost.min}–${config.pricing.saveCost.max}` : '1.5–48'} /t26);
            you earn {Math.round((config?.pricing?.dividendRate ?? 0.2) * 100)}% of it per save.</Dim>
          </div>
        )}
        {customCard?.tags?.length > 0 && (
          <div>
            <Dim>Tags:</Dim>
            <div style={{ marginTop: 4 }}><TagList tags={customCard.tags} /></div>
          </div>
        )}
        <div>
          <Dim>Stake: {config?.pricing?.publishStake
            ? `${config.pricing.publishStake.min}–${config.pricing.publishStake.max}`
            : '1–4'} /t26 (rolled at publish), absorbed by the cloud. Pick the tier
          that fits the card — rarer tiers circulate less.</Dim>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
        {message && <div className="publish-success">{message}</div>}
        {published && (
          <Dim className="publish-links">
            <Link to={`/card/${published.id}`}>View your card</Link>
            {' · '}
            <Link to="/collection">all your creations</Link>
          </Dim>
        )}
        <div>
          <PillButton onClick={publish} disabled={busy || !customCard}>
            {busy ? 'Publishing…' : `Publish (−${config?.pricing?.publishStake
              ? `${config.pricing.publishStake.min}–${config.pricing.publishStake.max}`
              : '1–4'} /t26)`}
          </PillButton>
        </div>
      </Stack>
    </Panel>
  );
};

const Stack = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
);

export default PublishPanel;
