import { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Card from '../components/Card/Card';
import MotionBar from '../components/MotionBar';
import { api } from '../utils/api';
import { poolCardToCardData } from '../utils/poolCard';
import { Page, Panel, Dim } from '../components/UI';
import { ensureTags, normalizeTag, formatTag } from '../utils/tags';

// Every published card carrying one tag, shown as a visual wall — no stats,
// filters or prices, just the cards. Reached by clicking a tag anywhere on a
// card; each card links through to its own page.
const TagPage = () => {
  const { tag: rawTag } = useParams();
  const tag = normalizeTag(rawTag || '');
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    api('/api/cards/community/all')
      .then(all => { if (live) { setCards(Array.isArray(all) ? all : []); setLoaded(true); } })
      .catch(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, []);

  const matches = useMemo(
    () => cards.filter(c => ensureTags(c.tags).includes(tag)),
    [cards, tag]
  );

  return (
    <Page>
      {matches.length > 0 && <PageMotionBar />}
      <Header>
        <h2>{formatTag(tag)}</h2>
        <Dim>{loaded ? `${matches.length} card${matches.length === 1 ? '' : 's'}` : 'loading…'}</Dim>
      </Header>

      {loaded && matches.length === 0 && (
        <Panel><Dim>No cards tagged {formatTag(tag)} yet. <Link to="/">Discover cards</Link>.</Dim></Panel>
      )}

      <Grid>
        {matches.map(card => {
          const cardData = poolCardToCardData(card);
          if (!cardData) return null;
          return (
            <Item key={card.id}>
              <CardScale><Card cardData={cardData} loop onClick={() => navigate(`/card/${card.id}`)} /></CardScale>
              <Name>{card.name}</Name>
            </Item>
          );
        })}
      </Grid>
    </Page>
  );
};

// The same fixed play/pause + scrub rail the collection pages carry, so the
// looping cards on this wall are controllable (and can be un-paused) here too.
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
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
  h2 { margin: 0; }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 8px;
`;

const Item = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const CardScale = styled.div`
  transform: scale(0.85);
  transform-origin: top center;
  margin-bottom: -50px;
`;

const Name = styled.div`
  color: var(--amber-text);
  font-size: 12px;
  text-align: center;
`;

export default TagPage;
