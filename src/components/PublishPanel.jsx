import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, tierForScore } from '../context/AuthContext';
import { api } from '../utils/api';
import { Panel, PillButton, TextInput, Divider, Dim, ErrorText, TagList } from './UI';

// Publish the card being customized into the pool. The rarity (and so the tier
// and odds) is NOT chosen here — it's the rolled value from the Start stage.
const PublishPanel = ({ customCard, onPublished }) => {
  const { user, config, setBalance } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [published, setPublished] = useState(null); // the created card record
  const [error, setError] = useState(null);

  const rarity = customCard?.rarity;
  const tier = tierForScore(config, rarity);

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
      setMessage(`Published to the pool — rarity ${Number(result.rarityScore).toFixed(3)} (${result.card.tier}).` +
        (result.createStake ? ` −${result.createStake} /t26 create fee.` : ''));
      if (onPublished) onPublished(result);
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
        {rarity != null && (
          <div>
            <Dim>Rolled rarity <b style={{ color: 'var(--gold-bright)' }}>{Number(rarity).toFixed(3)}</b>
            {tier && <> — {tier.name}{tier.odds ? `, appears at 1 : ${tier.odds.toLocaleString()}` : ''}</>}.
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
          <Dim>The create fee was paid at Start — publishing is free and just
          releases the card into the pool at its rolled rarity.</Dim>
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
            {busy ? 'Publishing…' : 'Publish'}
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
