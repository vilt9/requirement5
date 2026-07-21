import { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import { LuStar, LuArrowLeft, LuPencil } from 'react-icons/lu';
import Card from '../components/Card/Card';
import MotionBar from '../components/MotionBar';
import { useAuth } from '../context/AuthContext';
import { useCards } from '../context/CardContext';
import { api } from '../utils/api';
import { poolCardToCardData } from '../utils/poolCard';
import { saveCostFor, fmtT26 } from '../utils/economyRandom';
import { Page, Panel, PillButton, Divider, Dim, TagList } from '../components/UI';
import { ensureTags } from '../utils/tags';
import RarityStrip from '../components/Collection/RarityStrip';
import DiscoverCollections from '../components/Collection/DiscoverCollections';

const PAGE_SIZE = 12;

const SORTS = [
  { key: 'newest', label: 'newest first' },
  { key: 'oldest', label: 'oldest first' },
  { key: 'price-high', label: 'price: high → low' },
  { key: 'price-low', label: 'price: low → high' },
  { key: 'name', label: 'name A→Z' }
];

// A user's collection, shareable at /<username>/collection. Visitors see the
// public shelf (the cards this user has saved) read-only, and can star it. The
// owner additionally sees their created cards, their in-progress DRAFTS (with an
// Edit link back into the customizer), and management controls (remove, filter).
const CollectionPage = () => {
  const { username } = useParams();
  const { user, loading } = useAuth();

  // /collection with no username: send a logged-in user to their own page;
  // a logged-out visitor gets the discover-collections landing.
  if (!username) {
    if (loading) return null;
    if (user) return <Navigate to={`/${user.username}/collection`} replace />;
    return <LoggedOutLanding />;
  }
  return <UserCollectionView username={username} />;
};

const LoggedOutLanding = () => {
  const { savedCards, deleteCard } = useCards();
  return (
    <Page>
      <DiscoverCollections />
      <Panel>
        Your account collection lives on the server.{' '}
        <Link to="/account">Log in</Link> to see it.
        {savedCards.length > 0 && ' Local saves from before accounts are shown below.'}
      </Panel>
      {savedCards.length > 0 && <LocalSaves cards={savedCards} onDelete={deleteCard} />}
    </Page>
  );
};

const LocalSaves = ({ cards, onDelete }) => (
  <>
    <Panel>Local saves <Dim>(stored in this browser, outside the economy)</Dim>:</Panel>
    <Grid>
      {cards.map(card => (
        <Item key={card.id}>
          <CardScale><Card cardData={card} loop /></CardScale>
          <Panel>
            <div>Rarity Value: {Number(card.rarity).toFixed(3)}</div>
            <Divider />
            <PillButton $secondary onClick={() => onDelete(card.id)}>Delete</PillButton>
          </Panel>
        </Item>
      ))}
    </Grid>
  </>
);

const UserCollectionView = ({ username }) => {
  const { user, config } = useAuth();
  const { savedCards, deleteCard } = useCards();
  const navigate = useNavigate();

  const [data, setData] = useState(null);          // public shelf (saves) + meta
  const [creations, setCreations] = useState([]);  // owner only: all my cards
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [tagFilter, setTagFilter] = useState('');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('newest');
  const [page, setPage] = useState(0);

  const isOwn = !!user && user.username.toLowerCase() === username.toLowerCase();

  const load = useCallback(async () => {
    setLoaded(false); setNotFound(false);
    try {
      const result = await api(`/api/cards/collections/${username}`);
      setData(result);
    } catch (error) {
      if (error.status === 404) setNotFound(true);
      else console.error('Could not load collection:', error);
    }
    if (isOwn) {
      try { setCreations(await api('/api/cards/published/mine')); }
      catch (error) { console.error('Could not load creations:', error); }
    } else {
      setCreations([]);
    }
    setLoaded(true);
  }, [username, isOwn]);

  useEffect(() => { load(); }, [load]);

  const tierOf = (key) => config?.tiers?.find(t => t.key === key);
  const published = useMemo(() => creations.filter(c => c.card.is_public), [creations]);
  const drafts = useMemo(() => creations.filter(c => !c.card.is_public), [creations]);

  const removeSave = async (cardId) => {
    try {
      await api(`/api/cards/collection/${cardId}`, { method: 'DELETE' });
      setData(cur => (cur ? { ...cur, items: cur.items.filter(it => it.card.id !== cardId), count: cur.count - 1 } : cur));
    } catch (error) { console.error('Could not remove card:', error); }
  };

  const toggleStar = async () => {
    if (!user) { navigate('/account', { state: { returnTo: `/${username}/collection` } }); return; }
    const willStar = !data.starredByMe;
    setData(cur => ({ ...cur, starredByMe: willStar, stars: cur.stars + (willStar ? 1 : -1) }));
    try {
      const res = await api(`/api/cards/collections/${data.username}/star`, { method: willStar ? 'POST' : 'DELETE' });
      setData(cur => ({ ...cur, ...res }));
    } catch (error) { console.error('Could not update star:', error); load(); }
  };

  const items = data?.items || [];
  const costOf = ({ save, card }) => save.cost ?? saveCostFor(card.id, card.rarity_score);

  const allTags = useMemo(() => {
    const set = new Set();
    items.forEach(({ card }) => ensureTags(card.tags).forEach(t => set.add(t)));
    return [...set].sort();
  }, [items]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (tagFilter) list = list.filter(({ card }) => ensureTags(card.tags).includes(tagFilter));
    if (q) list = list.filter(({ card }) =>
      (card.name || '').toLowerCase().includes(q) || ensureTags(card.tags).some(t => t.toLowerCase().includes(q)));
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

  if (loaded && notFound) {
    return (
      <Page>
        <Panel>No collection for <b>{username}</b>. <Link to="/collection">Back to collections</Link>.</Panel>
      </Page>
    );
  }

  const anyShelf = items.length > 0 || published.length > 0 || drafts.length > 0;

  return (
    <Page>
      {anyShelf && <PageMotionBar className="collection-motion-bar" />}

      {isOwn && <DiscoverCollections />}

      <Panel>
        <Header>
          <BackLink to="/collection"><LuArrowLeft /> collections</BackLink>
          <div className="title">
            <h2>{data?.username || username}</h2>
            <Dim>{data ? `${data.count} saved` : 'loading…'}</Dim>
          </div>
          {data && !isOwn && (
            <StarButton type="button" $on={data.starredByMe} onClick={toggleStar}>
              <LuStar /> {data.starredByMe ? 'Starred' : 'Star'} · {data.stars}
            </StarButton>
          )}
          {isOwn && <Dim className="own">your collection</Dim>}
        </Header>
        {data && data.items.length > 0 && (
          <>
            <Divider />
            <RarityStrip topScores={data.topScores} value={data.value} count={data.count} />
          </>
        )}
      </Panel>

      {/* DRAFTS — owner only. Cards mid-creation, not yet published; nobody
          else can see them. Edit re-opens the draft in the customizer. */}
      {isOwn && drafts.length > 0 && (
        <>
          <Panel className="drafts-panel">
            Drafts: {drafts.length} <Dim>· in progress, only you can see these</Dim>
          </Panel>
          <Grid>
            {drafts.map(({ card }) => {
              const cardData = poolCardToCardData(card);
              return (
                <Item key={card.id}>
                  {cardData ? (
                    <CardScale><Card cardData={cardData} loop /></CardScale>
                  ) : <Missing>card data unavailable</Missing>}
                  <Panel>
                    <div>{card.name || 'Untitled draft'} <Dim>· draft</Dim></div>
                    <div><Dim>Started {new Date(card.created_at).toISOString().slice(0, 10)}</Dim></div>
                    <Divider />
                    <PillButton onClick={() => navigate(`/create?draft=${card.id}`)}>
                      <LuPencil /> Edit draft
                    </PillButton>
                  </Panel>
                </Item>
              );
            })}
          </Grid>
        </>
      )}

      {/* CREATED — owner only: the published cards this account made. */}
      {isOwn && published.length > 0 && (
        <>
          <Panel className="creations-panel">Created by you: {published.length} card{published.length === 1 ? '' : 's'}</Panel>
          <Grid>
            {published.map(({ card, stats }) => {
              const cardData = poolCardToCardData(card);
              const tier = tierOf(card.tier);
              return (
                <Item key={card.id}>
                  {cardData ? (
                    <CardScale><Card cardData={cardData} loop onClick={() => navigate(`/card/${card.id}`)} /></CardScale>
                  ) : <Missing>card data unavailable</Missing>}
                  <Panel>
                    <div>{card.name}</div>
                    {tier && <div>{tier.name}</div>}
                    {stats && <div><Dim>{stats.timesSaved} saved / {stats.timesDrawn} drawn</Dim></div>}
                    <Divider />
                    <Dim><Link to={`/card/${card.id}`}>View card page</Link></Dim>
                  </Panel>
                </Item>
              );
            })}
          </Grid>
        </>
      )}

      {/* SAVED shelf — shown to everyone; the owner can filter and remove. */}
      <Panel>
        {isOwn ? 'Saved' : 'Saved by ' + (data?.username || username)}: {items.length} card{items.length === 1 ? '' : 's'}
        {loaded && items.length === 0 && (
          isOwn
            ? <> — nothing yet. <Link to="/">Discover</Link> and save cards to build it.</>
            : <> — nothing saved here yet.</>
        )}
        {items.length > 0 && (
          <FilterBar>
            <input type="search" className="search" placeholder="search name or tag…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="sort" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
              {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </FilterBar>
        )}
        {allTags.length > 0 && (
          <FilterBar>
            <Dim>Filter by tag:</Dim>
            <TagList tags={allTags} onTagClick={toggleTag} activeTag={tagFilter} />
            {tagFilter && <button type="button" className="clear" onClick={() => setTagFilter('')}>clear</button>}
          </FilterBar>
        )}
      </Panel>

      {visibleItems.length > 0 && (
        <Grid>
          {pageItems.map(({ save, card, stats }) => {
            const cardData = poolCardToCardData(card);
            const tier = tierOf(card.tier);
            const cost = save.cost ?? saveCostFor(card.id, card.rarity_score);
            const url = `/${data.username}/card/${card.id}`;
            return (
              <Item key={save.id}>
                {cardData ? (
                  <CardScale><Card cardData={cardData} loop onClick={() => navigate(url)} /></CardScale>
                ) : <Missing>card data unavailable</Missing>}
                <Panel>
                  <div>{card.name} <Dim>· {card.creator_id === 'cloud' ? 'synthetic' : `by ${card.creator_id}`}</Dim></div>
                  {tier && <div>{tier.name}</div>}
                  {stats && <div><Dim>{stats.timesSaved} saved / {stats.timesDrawn} drawn</Dim></div>}
                  <div><Dim>Saved for {fmtT26(cost)} /t26 · {new Date(save.created_at).toISOString().slice(0, 10)}</Dim></div>
                  {ensureTags(card.tags).length > 0 && (
                    <div style={{ marginTop: 4 }}><TagList tags={ensureTags(card.tags)} onTagClick={(t) => navigate(`/tag/${encodeURIComponent(t)}`)} /></div>
                  )}
                  <Divider />
                  <Dim><Link to={url}>{isOwn ? 'Your card page' : 'Their card page'}</Link></Dim>
                  {isOwn && (
                    <>
                      <Divider />
                      <PillButton $secondary onClick={() => removeSave(card.id)}>Remove (no refund)</PillButton>
                    </>
                  )}
                </Panel>
              </Item>
            );
          })}
        </Grid>
      )}

      {pageCount > 1 && (
        <Pager>
          <PillButton $secondary disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>← Prev</PillButton>
          <Dim>page {safePage + 1} / {pageCount}</Dim>
          <PillButton $secondary disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>Next →</PillButton>
        </Pager>
      )}

      {loaded && items.length > 0 && visibleItems.length === 0 && (
        <Panel><Dim>No cards match — clear the search or tag filter.</Dim></Panel>
      )}

      {isOwn && savedCards.length > 0 && <LocalSaves cards={savedCards} onDelete={deleteCard} />}

      {/* Visitor / shared view: the person's own collection comes first; the
          "discover other collections" browse area sits at the very bottom so it
          never pushes the shared collection down the page. (On your own
          collection it lives up top instead.) */}
      {!isOwn && <DiscoverCollections />}
    </Page>
  );
};

const PageMotionBar = styled(MotionBar)`
  position: fixed;
  top: 22vh;
  bottom: 22vh;
  right: 20px;
  width: 40px;
  z-index: 60;
  /* Narrow viewports hug the bar to the edge — a 20px inset reads as crowding
     into the page at phone width. Wider viewports keep the roomier gap. */
  @media (max-width: 640px) {
    right: 4px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  .title { display: flex; align-items: baseline; gap: 8px; }
  .title h2 { margin: 0; }
  .own { margin-left: auto; }
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--amber-dim);
  &:hover { color: var(--white); text-decoration: none; }
`;

const StarButton = styled.button`
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 12px;
  padding: 7px 14px;
  border-radius: 20px;
  border: 1px solid ${p => (p.$on ? 'var(--gold)' : 'var(--panel-border)')};
  background: ${p => (p.$on ? 'var(--gold)' : 'transparent')};
  color: ${p => (p.$on ? '#140d03' : 'var(--gold-bright)')};
  cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
  svg { fill: ${p => (p.$on ? '#140d03' : 'none')}; }
  &:hover { border-color: var(--gold-bright); ${p => (p.$on ? '' : 'background: var(--panel-hover);')} }
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
    background: none; border: none; color: var(--gold-bright);
    cursor: pointer; font-family: var(--font-mono); font-size: 10px; text-decoration: underline;
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
  button { display: inline-flex; align-items: center; gap: 5px; }
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

// Old /u/:username → the shareable /<username>/collection URL.
export const LegacyUserCollectionRedirect = () => {
  const { username } = useParams();
  return <Navigate to={`/${username}/collection`} replace />;
};

export default CollectionPage;
