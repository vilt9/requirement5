import { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/Card/Card';
import MotionBar from '../components/MotionBar';
import { useAuth } from '../context/AuthContext';
import { useCards } from '../context/CardContext';
import { api } from '../utils/api';
import { poolCardToCardData } from '../utils/poolCard';
import { saveCostFor, fmtT26 } from '../utils/economyRandom';
import { Page, Panel, PillButton, Divider, Dim, TagList } from '../components/UI';
import { ensureTags } from '../utils/tags';
import DiscoverCollections from '../components/Collection/DiscoverCollections';

// One page of cards at a time: every card rides the shared motion loop, so a
// bounded page keeps the animation light while the whole shelf stays browsable.
const PAGE_SIZE = 12;

const SORTS = [
  { key: 'newest', label: 'newest first' },
  { key: 'oldest', label: 'oldest first' },
  { key: 'price-high', label: 'price: high → low' },
  { key: 'price-low', label: 'price: low → high' },
  { key: 'name', label: 'name A→Z' },
];

// Your collection: cards you created, cards saved on your account, plus any
// legacy local saves. Every card here rides the same global motion loop —
// the whole shelf turns and shines together; the bar on the right scrubs it.
const Collection = () => {
  const { user, config } = useAuth();
  const { savedCards, deleteCard } = useCards();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [creations, setCreations] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tagFilter, setTagFilter] = useState('');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('newest');
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api('/api/cards/collection/mine');
      setItems(data);
    } catch (error) {
      console.error('Could not load collection:', error);
    }
    try {
      const mine = await api('/api/cards/published/mine');
      setCreations(mine);
    } catch (error) {
      console.error('Could not load creations:', error);
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
  const costOf = ({ save, card }) => save.cost ?? saveCostFor(card.id);

  const allTags = useMemo(() => {
    const set = new Set();
    items.forEach(({ card }) => ensureTags(card.tags).forEach(t => set.add(t)));
    return [...set].sort();
  }, [items]);

  // Filter (tag + text) → sort → page. Each control resets to page one.
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (tagFilter) list = list.filter(({ card }) => ensureTags(card.tags).includes(tagFilter));
    if (q) {
      list = list.filter(({ card }) =>
        (card.name || '').toLowerCase().includes(q) ||
        ensureTags(card.tags).some(t => t.toLowerCase().includes(q)));
    }
    const sorted = [...list];
    if (sortKey === 'newest') sorted.sort((a, b) => (b.save.created_at || '').localeCompare(a.save.created_at || ''));
    if (sortKey === 'oldest') sorted.sort((a, b) => (a.save.created_at || '').localeCompare(b.save.created_at || ''));
    if (sortKey === 'price-high') sorted.sort((a, b) => costOf(b) - costOf(a));
    if (sortKey === 'price-low') sorted.sort((a, b) => costOf(a) - costOf(b));
    if (sortKey === 'name') sorted.sort((a, b) => (a.card.name || '').localeCompare(b.card.name || ''));
    return sorted;
  }, [items, tagFilter, query, sortKey]);

  useEffect(() => { setPage(0); }, [tagFilter, query, sortKey]);

  const pageCount = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = visibleItems.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const toggleTag = (tag) => setTagFilter(prev => (prev === tag ? '' : tag));

  const anyCards = creations.length > 0 || items.length > 0 || savedCards.length > 0;

  return (
    <Page>
      {/* The page-wide motion bar: every card below rides the same loop, so
          dragging this scrubs the whole shelf; ❚❚ pauses motion everywhere. */}
      {anyCards && <PageMotionBar className="collection-motion-bar" />}

      {/* Discover other collectors — a shuffled, starrable roster — sits above
          your own shelf. */}
      <DiscoverCollections />

      {!user && (
        <Panel>
          Your account collection lives on the server.{' '}
          <Link to="/account">Log in</Link> to see it.
          {savedCards.length > 0 && ' Local saves from before accounts are shown below.'}
        </Panel>
      )}

      {/* Cards this account created — the artist's shelf. Publishing from the
          customizer lands here, so a fresh signup can always find their work. */}
      {user && (
        <Panel className="creations-panel">
          Created by you: {creations.length} card{creations.length === 1 ? '' : 's'}
          {loaded && creations.length === 0 && (
            <> — nothing yet. <Link to="/customize">Design and publish a card</Link> and it will live here.</>
          )}
        </Panel>
      )}
      {user && creations.length > 0 && (
        <Grid className="creations-grid">
          {creations.map(({ card, stats }) => {
            const cardData = poolCardToCardData(card);
            const tier = tierOf(card.tier);
            return (
              <Item key={card.id}>
                {cardData ? (
                  <CardScale>
                    <Card cardData={cardData} loop onClick={() => navigate(`/card/${card.id}`)} />
                  </CardScale>
                ) : (
                  <Missing>card data unavailable</Missing>
                )}
                <Panel>
                  <div>{card.name}</div>
                  {tier && <div style={{ color: tier.color }}>{tier.name}</div>}
                  {stats && (
                    <div><Dim>{stats.timesSaved} saved / {stats.timesDrawn} drawn in the pool</Dim></div>
                  )}
                  <div><Dim>Published {new Date(card.created_at).toISOString().slice(0, 10)}</Dim></div>
                  <Divider />
                  <Dim><Link to={`/card/${card.id}`}>View card page</Link></Dim>
                </Panel>
              </Item>
            );
          })}
        </Grid>
      )}

      {user && (
        <Panel>
          Collection: {items.length} card{items.length === 1 ? '' : 's'}
          {loaded && items.length === 0 && (
            <> — nothing yet. <Link to="/">Discover</Link> and save cards to build it.</>
          )}
          {items.length > 0 && (
            <FilterBar>
              <input
                type="search"
                className="search"
                placeholder="search name or tag…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select className="sort" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </FilterBar>
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

      {user && visibleItems.length > 0 && (
        <Grid>
          {pageItems.map(({ save, card, stats }) => {
            const cardData = poolCardToCardData(card);
            const tier = tierOf(card.tier);
            const cost = save.cost ?? saveCostFor(card.id);
            const ownUrl = `/${user.username}/card/${card.id}`;
            return (
              <Item key={save.id}>
                {cardData ? (
                  <CardScale>
                    <Card cardData={cardData} loop onClick={() => navigate(ownUrl)} />
                  </CardScale>
                ) : (
                  <Missing>card data unavailable</Missing>
                )}
                <Panel>
                  <div>{card.name} <Dim>· {card.creator_id === 'cloud' ? 'synthetic' : `by ${card.creator_id}`}</Dim></div>
                  {tier && <div style={{ color: tier.color }}>{tier.name}</div>}
                  {stats && (
                    <div><Dim>{stats.timesSaved} saved / {stats.timesDrawn} drawn in the pool</Dim></div>
                  )}
                  {/* What YOU paid — every save keeps its price, so the shelf
                      remembers your bargains (and your splurges). */}
                  <div><Dim>Saved for {fmtT26(cost)} /t26 · {new Date(save.created_at).toISOString().slice(0, 10)}</Dim></div>
                  {ensureTags(card.tags).length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <TagList tags={ensureTags(card.tags)} onTagClick={toggleTag} activeTag={tagFilter} />
                    </div>
                  )}
                  <Divider />
                  <Dim><Link to={ownUrl}>Your card page</Link></Dim>
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

      {user && pageCount > 1 && (
        <Pager>
          <PillButton $secondary disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            ← Prev
          </PillButton>
          <Dim>page {safePage + 1} / {pageCount}</Dim>
          <PillButton $secondary disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
            Next →
          </PillButton>
        </Pager>
      )}

      {user && loaded && items.length > 0 && visibleItems.length === 0 && (
        <Panel><Dim>No cards match — clear the search or tag filter.</Dim></Panel>
      )}

      {savedCards.length > 0 && (
        <>
          <Panel>Local saves <Dim>(stored in this browser, outside the economy)</Dim>:</Panel>
          <Grid>
            {savedCards.map(card => (
              <Item key={card.id}>
                <CardScale><Card cardData={card} loop /></CardScale>
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

// The collection's copy of the motion bar: fixed to the right edge of the
// viewport, driving the same global clock every card on the page reads.
const PageMotionBar = styled(MotionBar)`
  position: fixed;
  top: 22vh;
  bottom: 22vh;
  right: 4px;
  width: 40px;
  z-index: 60;
`;

const FilterBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;

  .search, .sort {
    background: var(--field-bg);
    border: 1px solid var(--panel-border);
    color: var(--amber-text);
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 6px 8px;
    border-radius: 4px;

    &:focus { outline: none; border-color: var(--gold); }
  }
  .search { flex: 1; min-width: 140px; }
  .sort option { background: #1a1510; }

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

const Pager = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
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
