import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { LuStar, LuArrowLeft } from 'react-icons/lu';
import Card from '../components/Card/Card';
import MotionBar from '../components/MotionBar';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { poolCardToCardData } from '../utils/poolCard';
import { fmtT26 } from '../utils/economyRandom';
import { Page, Panel, Divider, Dim, TagList } from '../components/UI';
import { ensureTags } from '../utils/tags';
import RarityStrip from '../components/Collection/RarityStrip';

// Someone else's collection, read-only — the page you land on from a "Discover
// collections" roster. Same shelf-of-cards as your own, minus the editing: you
// can browse, open any card, and star the whole collection.
const UserCollection = () => {
  const { username } = useParams();
  const { user, config } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoaded(false);
    setNotFound(false);
    try {
      const result = await api(`/api/cards/collections/${username}`);
      setData(result);
    } catch (error) {
      if (error.status === 404) setNotFound(true);
      else console.error('Could not load collection:', error);
    }
    setLoaded(true);
  }, [username]);

  useEffect(() => { load(); }, [load]);

  const isOwn = user && data && user.username.toLowerCase() === data.username.toLowerCase();

  const toggleStar = async () => {
    if (!user) {
      navigate('/account', { state: { returnTo: `/u/${username}` } });
      return;
    }
    const willStar = !data.starredByMe;
    setData(current => ({ ...current, starredByMe: willStar, stars: current.stars + (willStar ? 1 : -1) }));
    try {
      const res = await api(`/api/cards/collections/${data.username}/star`, { method: willStar ? 'POST' : 'DELETE' });
      setData(current => ({ ...current, ...res }));
    } catch (error) {
      console.error('Could not update star:', error);
      load();
    }
  };

  const tierOf = (key) => config?.tiers?.find(t => t.key === key);

  if (loaded && notFound) {
    return (
      <Page>
        <Panel>
          No collection for <b>{username}</b>. <Link to="/collection">Back to collections</Link>.
        </Panel>
      </Page>
    );
  }

  return (
    <Page>
      {data && data.items.length > 0 && <PageMotionBar className="collection-motion-bar" />}

      <Panel>
        <Header>
          <BackLink to="/collection"><LuArrowLeft /> collections</BackLink>
          <div className="title">
            <h2>{data?.username || username}</h2>
            <Dim>{data ? `${data.count} card${data.count === 1 ? '' : 's'}` : 'loading…'}</Dim>
          </div>
          {data && !isOwn && (
            <StarButton type="button" $on={data.starredByMe} onClick={toggleStar}>
              <LuStar /> {data.starredByMe ? 'Starred' : 'Star'} · {data.stars}
            </StarButton>
          )}
          {isOwn && <Dim className="own">this is your collection · <Link to="/collection">manage it</Link></Dim>}
        </Header>
        {data && data.items.length > 0 && (
          <>
            <Divider />
            <RarityStrip topScores={data.topScores} value={data.value} count={data.count} />
          </>
        )}
      </Panel>

      {loaded && data && data.items.length === 0 && (
        <Panel><Dim>Nothing saved here yet.</Dim></Panel>
      )}

      {data && data.items.length > 0 && (
        <Grid>
          {data.items.map(({ save, card }) => {
            const cardData = poolCardToCardData(card);
            const tier = tierOf(card.tier);
            const cost = save.cost;
            const url = `/${data.username}/card/${card.id}`;
            return (
              <Item key={save.id}>
                {cardData ? (
                  <CardScale>
                    <Card cardData={cardData} loop onClick={() => navigate(url)} />
                  </CardScale>
                ) : (
                  <Missing>card data unavailable</Missing>
                )}
                <Panel>
                  <div>{card.name} <Dim>· {card.creator_id === 'cloud' ? 'synthetic' : `by ${card.creator_id}`}</Dim></div>
                  {tier && <div>{tier.name}</div>}
                  <div><Dim>Saved for {fmtT26(cost)} /t26 · {new Date(save.created_at).toISOString().slice(0, 10)}</Dim></div>
                  {ensureTags(card.tags).length > 0 && (
                    <div style={{ marginTop: 4 }}><TagList tags={ensureTags(card.tags)} /></div>
                  )}
                  <Divider />
                  <Dim><Link to={url}>Their card page</Link></Dim>
                </Panel>
              </Item>
            );
          })}
        </Grid>
      )}
    </Page>
  );
};

const PageMotionBar = styled(MotionBar)`
  position: fixed;
  top: 22vh;
  bottom: 22vh;
  right: 4px;
  width: 40px;
  z-index: 60;
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
  font-family: var(--font-sans);
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

export default UserCollection;
