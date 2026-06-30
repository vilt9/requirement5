import { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import Card from '../components/Card/Card';
import { useAuth } from '../context/AuthContext';
import { useCards } from '../context/CardContext';
import { api } from '../utils/api';
import { poolCardToCardData } from '../utils/poolCard';
import { Page, Panel, PillButton, Divider, Dim, TagList } from '../components/UI';
import { ensureTags } from '../utils/tags';

// Your collection: cards saved on your account, plus any legacy local saves.
const Collection = () => {
  const { user, config } = useAuth();
  const { savedCards, deleteCard } = useCards();
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tagFilter, setTagFilter] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api('/api/cards/collection/mine');
      setItems(data);
    } catch (error) {
      console.error('Could not load collection:', error);
    }
    setLoaded(true);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const remove = async (cardId) => {
    try {
      await api(`/api/cards/collection/${cardId}`, { method: 'DELETE' });
      setItems(current => current.filter(item => item.card.id !== cardId));
    } catch (error) {
      console.error('Could not remove card:', error);
    }
  };

  const tierOf = (key) => config?.tiers?.find(t => t.key === key);

  const allTags = useMemo(() => {
    const set = new Set();
    items.forEach(({ card }) => ensureTags(card.tags).forEach(t => set.add(t)));
    return [...set].sort();
  }, [items]);

  const visibleItems = tagFilter
    ? items.filter(({ card }) => ensureTags(card.tags).includes(tagFilter))
    : items;

  const toggleTag = (tag) => setTagFilter(prev => (prev === tag ? '' : tag));

  return (
    <Page>
      {!user && (
        <Panel>
          Your account collection lives on the server.{' '}
          <Link to="/account">Log in</Link> to see it.
          {savedCards.length > 0 && ' Local saves from before accounts are shown below.'}
        </Panel>
      )}

      {user && (
        <Panel>
          Collection: {items.length} card{items.length === 1 ? '' : 's'}
          {loaded && items.length === 0 && (
            <> — nothing yet. <Link to="/">Generate</Link> and save cards to build it.</>
          )}
          {allTags.length > 0 && (
            <FilterBar>
              <Dim>Filter by tag:</Dim>
              <TagList tags={allTags} onTagClick={toggleTag} activeTag={tagFilter} />
              {tagFilter && (
                <button type="button" className="clear" onClick={() => setTagFilter('')}>clear</button>
              )}
            </FilterBar>
          )}
        </Panel>
      )}

      {user && items.length > 0 && (
        <Grid>
          {visibleItems.map(({ save, card, stats }) => {
            const cardData = poolCardToCardData(card);
            const tier = tierOf(card.tier);
            return (
              <Item key={save.id}>
                {cardData ? (
                  <CardScale><Card cardData={cardData} /></CardScale>
                ) : (
                  <Missing>card data unavailable</Missing>
                )}
                <Panel>
                  <div>{card.name} <Dim>· {card.creator_id === 'cloud' ? 'synthetic' : `by ${card.creator_id}`}</Dim></div>
                  {tier && <div style={{ color: tier.color }}>{tier.name}</div>}
                  {stats && (
                    <div><Dim>{stats.timesSaved} saved / {stats.timesDrawn} drawn in the pool</Dim></div>
                  )}
                  <div><Dim>Saved {new Date(save.created_at).toISOString().slice(0, 10)}</Dim></div>
                  {ensureTags(card.tags).length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <TagList tags={ensureTags(card.tags)} onTagClick={toggleTag} activeTag={tagFilter} />
                    </div>
                  )}
                  <Divider />
                  <PillButton $secondary onClick={() => remove(card.id)}>
                    Remove (no refund)
                  </PillButton>
                </Panel>
              </Item>
            );
          })}
        </Grid>
      )}

      {savedCards.length > 0 && (
        <>
          <Panel>Local saves <Dim>(stored in this browser, outside the economy)</Dim>:</Panel>
          <Grid>
            {savedCards.map(card => (
              <Item key={card.id}>
                <CardScale><Card cardData={card} /></CardScale>
                <Panel>
                  <div>Rarity: {Number(card.rarity).toFixed(3)}</div>
                  <Divider />
                  <PillButton $secondary onClick={() => deleteCard(card.id)}>Delete</PillButton>
                </Panel>
              </Item>
            ))}
          </Grid>
        </>
      )}
    </Page>
  );
};

const FilterBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;

  .clear {
    background: none;
    border: none;
    color: var(--gold-bright);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 10px;
    text-decoration: underline;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 8px;
`;

const Item = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  & > div:last-child { width: 100%; }
`;

const CardScale = styled.div`
  transform: scale(0.85);
  transform-origin: top center;
  margin-bottom: -60px;
`;

const Missing = styled.div`
  width: 240px;
  height: 336px;
  display: grid;
  place-items: center;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  color: var(--amber-dim);
`;

export default Collection;
