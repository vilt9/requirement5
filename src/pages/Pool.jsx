import { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Page, Panel, Row, Divider, Dim, RarityBands, TagList } from '../components/UI';
import { ensureTags } from '../utils/tags';

// The pool, with open books: tier composition, the cloud's accounts,
// and every published card with its circulation numbers.
const Pool = () => {
  const { config } = useAuth();
  const [cloud, setCloud] = useState(null);
  const [cards, setCards] = useState([]);
  const [tagFilter, setTagFilter] = useState('');

  useEffect(() => {
    api('/api/economy/cloud').then(setCloud).catch(console.error);
    api('/api/cards/community/all').then(setCards).catch(console.error);
  }, []);

  const tierOf = (key) => config?.tiers?.find(t => t.key === key);

  // Every tag present in the pool, for the filter bar.
  const allTags = useMemo(() => {
    const set = new Set();
    cards.forEach(c => ensureTags(c.tags).forEach(t => set.add(t)));
    return [...set].sort();
  }, [cards]);

  const visibleCards = tagFilter
    ? cards.filter(c => ensureTags(c.tags).includes(tagFilter))
    : cards;

  const toggleTag = (tag) => setTagFilter(prev => (prev === tag ? '' : tag));

  return (
    <Page>
      <Panel>
        The pool is the shared deck every generate draws from. Publishing adds a card to it
        (stake: {config?.publishStake ?? 10} /t26); every save of your card pays you a dividend.
        All books are open.
      </Panel>

      <Row>
        <Panel>
          Draw odds per tier:
          <Divider />
          <RarityBands config={config} />
        </Panel>
        <Panel>
          Pool composition — published cards per tier:
          <Divider />
          <RarityBands config={config} counts={cloud?.tierCounts} />
        </Panel>
      </Row>

      <Panel>
        The cloud's books:
        <Divider />
        {cloud ? (
          <>
            <div>Total /t26 issued: {cloud.totalIssued}</div>
            <div>Total /t26 absorbed: {cloud.totalAbsorbed}</div>
            <div>In circulation: <b>{cloud.inCirculation} /t26</b></div>
            <div>Published cards: {cloud.publishedCards}</div>
            <div><Dim>Image storage: {cloud.storage?.driver}{cloud.storage?.bucket ? ` (${cloud.storage.bucket})` : ''}</Dim></div>
          </>
        ) : <Dim>Loading…</Dim>}
      </Panel>

      <Panel>
        Published cards — circulation record:
        <Divider />
        {allTags.length > 0 && (
          <FilterBar>
            <Dim>Filter by tag:</Dim>
            <TagList tags={allTags} onTagClick={toggleTag} activeTag={tagFilter} />
            {tagFilter && (
              <button type="button" className="clear" onClick={() => setTagFilter('')}>
                clear
              </button>
            )}
          </FilterBar>
        )}
        {cards.length === 0 && (
          <Dim>The pool is empty. Publish the first card from the create page.</Dim>
        )}
        {cards.length > 0 && visibleCards.length === 0 && (
          <Dim>No cards tagged {tagFilter ? `#${tagFilter}` : ''}.</Dim>
        )}
        {visibleCards.map(card => {
          const tier = tierOf(card.tier);
          const tags = ensureTags(card.tags);
          return (
            <CardRow key={card.id}>
              <CardLine>
                <span className="name">{card.name}</span>
                <span className="tier" style={{ color: tier?.color || 'var(--amber-dim)' }}>
                  {tier?.name || 'untiered'}
                </span>
                <span className="creator"><Dim>by {card.creator_id}</Dim></span>
                <span className="counts">
                  {card.times_saved || 0} saved / {card.times_drawn || 0} drawn
                </span>
              </CardLine>
              {tags.length > 0 && (
                <div className="tags">
                  <TagList tags={tags} onTagClick={toggleTag} activeTag={tagFilter} />
                </div>
              )}
            </CardRow>
          );
        })}
      </Panel>
    </Page>
  );
};

const FilterBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;

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

const CardRow = styled.div`
  padding: 4px 0;
  & + & { border-top: 1px solid rgba(156, 138, 104, 0.12); }
  .tags { margin-top: 4px; }
`;

const CardLine = styled.div`
  display: flex;
  gap: 10px;
  .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tier { width: 12ch; flex-shrink: 0; }
  .creator { width: 16ch; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; }
  .counts { width: 18ch; text-align: right; flex-shrink: 0; }

  /* Narrow screens: the fixed columns don't fit on one line — wrap instead. */
  @media (max-width: 640px) {
    flex-wrap: wrap;
    row-gap: 2px;
    .name { flex-basis: 100%; }
    .tier, .creator, .counts { width: auto; text-align: left; }
  }
`;

export default Pool;
