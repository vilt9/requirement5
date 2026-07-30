import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { MiniSlot } from '../components/Collection/CardPosition';

const PAGE_SIZE = 200;

const useNearViewport = (onNear, enabled, rootMargin = '700px 0px') => {
  const targetRef = useRef(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!enabled || !target) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      onNear();
      return undefined;
    }

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) onNear();
    }, { rootMargin });
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, onNear, rootMargin]);

  return targetRef;
};

const sourceUrl = (source, cursor) => {
  const query = new URLSearchParams({
    sourceType: source.type,
    sourceId: source.id,
    cursor: String(cursor),
    limit: String(PAGE_SIZE)
  });
  return `/api/cards/grid?${query}`;
};

const SourceGrid = ({ source }) => {
  const [cards, setCards] = useState([]);
  const [nextCursor, setNextCursor] = useState(0);
  const [started, setStarted] = useState(false);
  const loadingRef = useRef(false);
  const cursorRef = useRef(0);

  const loadNext = useCallback(async () => {
    if (loadingRef.current || cursorRef.current == null) return;
    loadingRef.current = true;
    const cursor = cursorRef.current;
    try {
      const result = await api(sourceUrl(source, cursor));
      setCards(current => [...current, ...result.cards]);
      cursorRef.current = result.nextCursor;
      setNextCursor(result.nextCursor);
    } catch {
      cursorRef.current = null;
      setNextCursor(null);
    } finally {
      setStarted(true);
      loadingRef.current = false;
    }
  }, [source]);

  const sectionRef = useNearViewport(loadNext, !started);
  const moreRef = useNearViewport(loadNext, started && nextCursor != null);

  return (
    <SourceSection ref={sectionRef}>
      <SourceHeading>
        <strong>{source.collected}/{source.total}</strong>
        {' '}collected from <span>{source.label}</span>
      </SourceHeading>
      {cards.length > 0 && (
        <CardMatrix aria-label={`Cards from ${source.label}`}>
          {cards.map(slot => (
            <MiniSlot
              key={`${source.type}-${source.id}-${slot.position}`}
              slot={slot}
              linkOwned
            />
          ))}
        </CardMatrix>
      )}
      {started && nextCursor != null && <LoadMarker ref={moreRef} aria-hidden />}
    </SourceSection>
  );
};

const Grid = () => {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const loadingMoreRef = useRef(false);
  const viewerRef = useRef(user?.id || null);
  viewerRef.current = user?.id || null;

  useEffect(() => {
    if (authLoading) return undefined;
    let active = true;
    setError(false);
    // Do not leave the previous account's revealed faces on screen while the
    // logged-out (or newly switched account) grid is being fetched.
    setData(null);

    api(`/api/cards/grid?limit=${PAGE_SIZE}`)
      .then(result => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => { active = false; };
  }, [authLoading, user?.id]);

  const loadMoreGlobal = useCallback(async () => {
    const cursor = data?.global?.nextCursor;
    if (cursor == null || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    const viewer = viewerRef.current;
    try {
      const result = await api(`/api/cards/grid?cursor=${cursor}&limit=${PAGE_SIZE}`);
      if (viewerRef.current !== viewer) return;
      setData(current => {
        if (!current) return result;
        return {
          ...current,
          global: {
            ...current.global,
            cards: [...current.global.cards, ...result.global.cards],
            nextCursor: result.global.nextCursor
          }
        };
      });
    } catch {
      // Keep the page usable at the last successfully loaded rank.
    } finally {
      loadingMoreRef.current = false;
    }
  }, [data?.global?.nextCursor]);

  const moreGlobalRef = useNearViewport(
    loadMoreGlobal,
    data?.global?.nextCursor != null
  );

  if (error) {
    return <GridPage><Quiet>Grid unavailable.</Quiet></GridPage>;
  }

  if (!data?.global) {
    return <GridPage aria-busy="true"><Quiet>loading grid…</Quiet></GridPage>;
  }

  return (
    <GridPage>
      <GlobalSection>
        <PageHeading>
          <h1>rarity grid</h1>
          <span>
            <strong>{data.global.collected}/{data.global.total}</strong> collected
          </span>
        </PageHeading>
        <CardMatrix aria-label="All cards in rarity order">
          {data.global.cards.map(slot => (
            <MiniSlot key={`global-${slot.position}`} slot={slot} linkOwned />
          ))}
        </CardMatrix>
        {data.global.nextCursor != null && <LoadMarker ref={moreGlobalRef} aria-hidden />}
      </GlobalSection>

      {data.creators.map(creator => (
        <CreatorSection key={creator.id}>
          <CreatorHeading>
            <span>{creator.label}</span>
            <small>{creator.collected}/{creator.total}</small>
          </CreatorHeading>

          {creator.sources.map(source => (
            <SourceGrid key={`${source.type}-${source.id}`} source={source} />
          ))}
        </CreatorSection>
      ))}
    </GridPage>
  );
};

// The grid keeps the black field of the saved-card view and lets normal page
// scrolling do the work. A wider lane gives the tiny cards enough horizontal
// context without making the individual faces feel like a second card gallery.
const GridPage = styled.main`
  width: min(1120px, 100%);
  min-height: 70vh;
  margin: 0 auto 100px;
  padding: 28px 22px 0;
  color: var(--amber-dim);
  text-align: left;

  @media (max-width: 640px) {
    padding: 22px 12px 0;
  }
`;

const GlobalSection = styled.section``;

const PageHeading = styled.header`
  display: flex;
  align-items: baseline;
  justify-content: flex-start;
  gap: 10px;
  margin: 0 0 22px;
  color: var(--amber-dim);
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 0.01em;
  text-align: left;

  h1 {
    margin: 0;
    color: inherit;
    font-size: inherit;
    font-weight: 400;
    line-height: inherit;
    letter-spacing: inherit;
  }

  span {
    color: inherit;
    font-size: inherit;
    white-space: nowrap;
  }

  strong {
    color: inherit;
    font-weight: 400;
  }
`;

const CardMatrix = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, 34px);
  column-gap: 9px;
  row-gap: 14px;
  align-items: end;
  justify-content: start;
`;

const CreatorSection = styled.section`
  margin-top: 44px;
  padding-top: 16px;
  border-top: 1px solid var(--panel-border);
  content-visibility: auto;
  contain-intrinsic-size: auto 240px;
`;

const CreatorHeading = styled.h2`
  display: flex;
  align-items: baseline;
  gap: 9px;
  margin: 0 0 22px;
  color: var(--amber-dim);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: 0.01em;
  text-align: left;

  small {
    color: inherit;
    font-size: inherit;
    font-weight: 400;
    letter-spacing: inherit;
  }
`;

const SourceSection = styled.section`
  content-visibility: auto;
  contain-intrinsic-size: auto 140px;

  & + & {
    margin-top: 30px;
  }
`;

const LoadMarker = styled.div`
  width: 100%;
  height: 1px;
`;

const SourceHeading = styled.h3`
  margin: 0 0 12px;
  color: var(--amber-dim);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: 0.01em;
  text-align: left;

  strong {
    color: inherit;
    font-weight: 400;
  }

  span {
    color: inherit;
  }
`;

const Quiet = styled.div`
  color: var(--amber-dim);
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
`;

export default Grid;
