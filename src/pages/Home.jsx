import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import Card from '../components/Card/Card';
import { useCards } from '../context/CardContext';
import { useAuth, tierForScore } from '../context/AuthContext';
import { api } from '../utils/api';
import { poolCardToCardData, asOdds } from '../utils/poolCard';
import { generateCardAttributes } from '../utils/cardGenerator';
import { Panel, PillButton, Divider, Dim, RarityBands, TagList } from '../components/UI';
import { ensureTags } from '../utils/tags';

// The generate screen. Logged in: draws go through the server — tier roll,
// pool card or synthetic, yield credited. Logged out: local preview only.
const Home = () => {
  const { user, config, setBalance, yieldRemaining, refreshBalance } = useAuth();
  const { currentCard, generateNewCard, updateCustomCard } = useCards();

  const [draw, setDraw] = useState(null);        // server draw result (null when logged out)
  const [savedCardIds, setSavedCardIds] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);

  const say = (line) => setLog(current => [line, ...current].slice(0, 4));

  const handleGenerate = useCallback(async () => {
    setBusy(true);
    try {
      if (user) {
        const result = await api('/api/draw', { method: 'POST' });
        setDraw(result);
        setBalance(result.balance);
        if (result.source === 'pool') {
          updateCustomCard(poolCardToCardData(result.card));
        } else {
          updateCustomCard(generateCardAttributes({ rarityRange: result.tier.scoreRange }));
        }
        if (result.yield.capped && result.yield.credited === 0) {
          say(`Card generated. Daily yield cap reached — no /t26 credited.`);
        } else {
          say(`Card generated. Yield +${result.yield.credited} /t26.`);
        }
      } else {
        setDraw(null);
        generateNewCard();
        say('Card generated locally. Log in to draw from the pool and earn /t26.');
      }
    } catch (error) {
      say(`Error: ${error.message}`);
    }
    setBusy(false);
  }, [user, setBalance, updateCustomCard, generateNewCard]);

  // First card on mount
  useEffect(() => {
    if (!currentCard) handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tier = draw
    ? config?.tiers?.find(t => t.key === draw.tier.key)
    : tierForScore(config, currentCard?.rarity);

  const isPoolCard = draw?.source === 'pool' && draw.card;
  const alreadySaved = isPoolCard && savedCardIds.has(draw.card.id);

  const handleSave = async () => {
    if (!user || !tier || !currentCard) return;
    setBusy(true);
    try {
      if (isPoolCard) {
        const result = await api(`/api/cards/${draw.card.id}/save`, { method: 'POST' });
        setBalance(result.balance);
        setSavedCardIds(current => new Set(current).add(draw.card.id));
        say(`Saved to collection. −${result.cost} /t26. Dividend ${result.dividend} /t26 → creator.`);
      } else {
        const result = await api('/api/cards/save-synthetic', {
          method: 'POST',
          body: {
            name: 'Synthetic draw',
            tier: tier.key,
            stateData: { customCard: currentCard }
          }
        });
        setBalance(result.balance);
        say(`Saved to collection. −${result.cost} /t26.`);
      }
      refreshBalance();
    } catch (error) {
      say(`Error: ${error.message}`);
    }
    setBusy(false);
  };

  const stats = draw?.stats;

  return (
    <Wrap>
      {currentCard && (
        <Scene>
          <Card cardData={currentCard} />
        </Scene>
      )}

      <Buttons>
        <PillButton onClick={handleGenerate} disabled={busy}>
          {busy ? 'Working...' : 'Generate new card'}
        </PillButton>
        <PillButton
          $secondary
          onClick={handleSave}
          disabled={busy || !user || !tier || alreadySaved}
        >
          {alreadySaved
            ? 'In your collection'
            : `Save card${tier ? ` (−${tier.saveCost} /t26)` : ''}`}
        </PillButton>
      </Buttons>

      {log.length > 0 && (
        <NarrowPanel as="div">
          {log.map((line, i) => (
            <div key={i} style={{ color: i === 0 ? 'var(--gold-bright)' : 'var(--amber-dim)' }}>&gt; {line}</div>
          ))}
        </NarrowPanel>
      )}

      <NarrowPanel>
        {tier && (
          <div style={{ color: tier.color }}>Tier: {tier.name}</div>
        )}
        {currentCard && (
          <>
            <div>Rarity: {Number(currentCard.rarity).toFixed(3)}</div>
            {tier?.odds && <div>Tier odds: 1 : {tier.odds.toLocaleString()}</div>}
            {stats?.drawWeight != null && (
              <div>Draw weight: {stats.drawWeight.toExponential(2)} ({asOdds(stats.drawWeight)})</div>
            )}
            {stats?.poolShare != null && (
              <div>Pool share: {(stats.poolShare * 100).toFixed(2)}%</div>
            )}
            {stats && (
              <div>Circulation: {stats.timesSaved} saved / {stats.timesDrawn} drawn</div>
            )}
            <div>
              Source: {isPoolCard
                ? <>pool card <Dim>· creator {draw.card.creator_id}</Dim></>
                : 'synthetic (no pool card in this tier yet)'}
            </div>
            {tier && (
              <div>Creator dividend: {tier.creatorDividend} /t26 per save</div>
            )}
            <div>Pattern: {currentCard.patternInfo?.type || 'standard'}</div>
            {ensureTags(draw?.card?.tags).length > 0 && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>Tags:</span>
                <TagList tags={ensureTags(draw?.card?.tags)} />
              </div>
            )}
            {user ? (
              <div>Yield remaining today: {yieldRemaining ?? '—'} /t26</div>
            ) : (
              <div><Dim>Log in on the <Link to="/account">account page</Link> to draw from the pool and earn /t26.</Dim></div>
            )}
          </>
        )}
        <Divider />
        <Center>
          <a
            href="https://requirement5cards.substack.com/p/subscribe-to-this-mailing-list-to?triedRedirect=true"
            target="_blank" rel="noopener noreferrer"
          >
            Join mailing list →
          </a>
        </Center>
      </NarrowPanel>

      <NarrowPanel>
        Rarity bands — draw weight per tier:
        <Divider />
        <RarityBands config={config} />
      </NarrowPanel>
    </Wrap>
  );
};

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 15px 60px;
`;

const Scene = styled.div`
  margin: 6px 0;
`;

const Buttons = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin: 4px 0;
`;

const NarrowPanel = styled(Panel)`
  width: 90%;
  max-width: 440px;
`;

const Center = styled.div`
  text-align: center;
`;

export default Home;
