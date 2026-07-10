import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { LuStar, LuUsers, LuShuffle } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { Panel, Divider, Dim, PillButton } from '../UI';
import RarityStrip from './RarityStrip';

// "Discover collections": a shuffled roster of other people's collections
// (anyone holding more than five cards), each starrable and peekable. Public —
// it loads logged out too; starring is the one thing that needs an account.
//
// Shape of the data: /discover hands back light roster entries (name, counts,
// rarity tiers for the dots). Peeking one lazy-loads that owner's full cards.
const DiscoverCollections = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [starred, setStarred] = useState([]);     // collections you've starred
  const [discover, setDiscover] = useState([]);   // the shuffled roster
  const [remaining, setRemaining] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // First page (and a reshuffle whenever the viewer changes — self is excluded
  // server-side, and starred state is viewer-specific).
  const loadInitial = useCallback(async () => {
    try {
      const data = await api('/api/cards/collections/discover?limit=6');
      setDiscover(data.collections);
      setRemaining(data.remaining);
    } catch (error) {
      console.error('Could not load collections to discover:', error);
    }
    if (user) {
      try {
        const mine = await api('/api/cards/collections/starred/mine');
        setStarred(mine.collections);
      } catch (error) {
        console.error('Could not load starred collections:', error);
      }
    } else {
      setStarred([]);
    }
    setLoaded(true);
  }, [user]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // "Show more" pulls a fresh batch, excluding everyone already on screen so
  // the roster grows rather than repeats.
  const showMore = async () => {
    setLoadingMore(true);
    try {
      const exclude = discover.map(c => c.username).join(',');
      const data = await api(`/api/cards/collections/discover?limit=6&exclude=${encodeURIComponent(exclude)}`);
      setDiscover(current => [...current, ...data.collections]);
      setRemaining(data.remaining);
    } catch (error) {
      console.error('Could not load more collections:', error);
    }
    setLoadingMore(false);
  };

  // Toggle a star. Logged out → send them to log in first. Optimistic: the
  // star count and fill flip immediately, and the starred strip stays in sync.
  const toggleStar = async (entry) => {
    if (!user) {
      navigate('/account', { state: { returnTo: '/collection' } });
      return;
    }
    const willStar = !entry.starredByMe;
    const apply = (c) => c.username === entry.username
      ? { ...c, starredByMe: willStar, stars: c.stars + (willStar ? 1 : -1) }
      : c;
    setDiscover(current => current.map(apply));
    setStarred(current => {
      if (willStar) {
        const next = apply({ ...entry });
        return current.some(c => c.username === entry.username) ? current.map(apply) : [next, ...current];
      }
      return current.filter(c => c.username !== entry.username);
    });
    try {
      await api(`/api/cards/collections/${entry.username}/star`, { method: willStar ? 'POST' : 'DELETE' });
    } catch (error) {
      console.error('Could not update star:', error);
      loadInitial(); // reconcile with the server on failure
    }
  };

  if (loaded && discover.length === 0 && starred.length === 0) {
    // Nothing to discover yet (small world) — stay quiet rather than show an
    // empty shell above someone's own collection.
    return null;
  }

  const renderRoster = (list) => (
    <Roster>
      {list.map(entry => (
        <RosterCard key={entry.username}>
          <div className="top">
            <button type="button" className="name" onClick={() => navigate(`/u/${entry.username}`)}>
              {entry.username}
            </button>
            <StarButton
              type="button"
              $on={entry.starredByMe}
              onClick={() => toggleStar(entry)}
              title={entry.starredByMe ? 'Unstar this collection' : 'Star this collection'}
            >
              <LuStar /> {entry.stars}
            </StarButton>
          </div>
          <RarityStrip
            topScores={entry.topScores}
            value={entry.value}
            count={entry.count}
          />
        </RosterCard>
      ))}
    </Roster>
  );

  return (
    <Wrap>
      {starred.length > 0 && (
        <Panel>
          <Head><LuStar /> Starred collections</Head>
          <Divider />
          {renderRoster(starred)}
        </Panel>
      )}

      {discover.length > 0 && (
        <Panel>
          <Head><LuUsers /> Discover collections <Dim>· other collectors worth a look</Dim></Head>
          <Divider />
          {renderRoster(discover)}
          <Divider />
          <MoreRow>
            <PillButton
              $secondary
              disabled={loadingMore || remaining === 0}
              onClick={showMore}
            >
              <LuShuffle /> {remaining === 0 ? 'No more to show' : loadingMore ? 'Shuffling…' : 'Show more collectors'}
            </PillButton>
          </MoreRow>
        </Panel>
      )}
    </Wrap>
  );
};

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--amber-text);
  svg { color: var(--gold-bright); }
`;

const Roster = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
`;

const RosterCard = styled.div`
  background: var(--field-bg);
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .name {
    background: none;
    border: none;
    padding: 0;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--gold-bright);
    cursor: pointer;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    &:hover { text-decoration: underline; }
  }
  .count { font-size: 11px; }
`;

const StarButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 3px 7px;
  border-radius: 12px;
  border: 1px solid ${p => (p.$on ? 'var(--gold)' : 'var(--panel-border)')};
  background: ${p => (p.$on ? 'var(--gold)' : 'transparent')};
  color: ${p => (p.$on ? '#140d03' : 'var(--amber-dim)')};
  cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
  svg { fill: ${p => (p.$on ? '#140d03' : 'none')}; }
  &:hover {
    border-color: var(--gold);
    ${p => (p.$on ? '' : 'color: var(--white);')}
  }
`;

const MoreRow = styled.div`
  display: flex;
  justify-content: center;
  button { display: inline-flex; align-items: center; gap: 6px; }
`;

export default DiscoverCollections;
