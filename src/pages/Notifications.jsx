import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { fmtT26 } from '../utils/economyRandom';
import { Page, Panel, Divider, Dim } from '../components/UI';
import SignalGlyph from '../components/SignalGlyph';
import { SIGNALS } from '../utils/signals';

const noticeTypes = {
  reaction: 'Reaction',
  save: 'Card saved',
  collection_influence: 'Collection relay',
  collection_reaction: 'Card activity',
  creator_activity: 'New card'
};

const dateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'unknown'
    : date.toISOString().slice(0, 16).replace('T', ' ');
};

const Actor = ({ item }) => {
  const actor = item.actor === 'Earth visitor' ? 'Anonymous visitor' : item.actor;
  return item.actorCollection
    ? <Link to={item.actorCollection}>{actor}</Link>
    : <span>{actor || 'Source unrecorded'}</span>;
};

const ReactionCounts = ({ counts = {} }) => (
  <Counts aria-label="Reaction totals">
    {SIGNALS.filter(signal => counts[signal.key]).map(signal => (
      <span key={signal.key} title={signal.label}>
        <SignalGlyph signal={signal.key} aria-hidden />
        {counts[signal.key]}
      </span>
    ))}
  </Counts>
);

const NoticeText = ({ item }) => {
  const card = <Link to={`/card/${item.card.id}`}>{item.card.name}</Link>;
  if (item.type === 'reaction') {
    return <><Actor item={item} /><Dim> reacted to </Dim>{card}</>;
  }
  if (item.type === 'save') {
    return <><Actor item={item} /><Dim> saved </Dim>{card}</>;
  }
  if (item.type === 'collection_influence') {
    const count = item.data?.count || 0;
    return <>{count} downstream save{count === 1 ? '' : 's'}<Dim> through your collection · </Dim>{card}</>;
  }
  if (item.type === 'collection_reaction') {
    return (
      <>
        {card}<Dim> · {item.data?.total || 0} reactions · </Dim>
        <ReactionCounts counts={item.data?.counts} />
      </>
    );
  }
  return <><Actor item={item} /><Dim> published </Dim>{card}</>;
};

const Notifications = () => {
  const { user } = useAuth();
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    api('/api/cards/notifications/mine')
      .then(next => {
        if (!active) return;
        setFeed(next);
        if (next.unread > 0) {
          api('/api/cards/notifications/read', { method: 'POST' }).catch(() => {});
          window.dispatchEvent(new Event('r5c:notifications-read'));
        }
      })
      .catch(() => {
        if (active) setError('Could not load notifications.');
      });
    return () => { active = false; };
  }, [user]);

  if (!user) {
    return <Navigate to="/account" state={{ returnTo: '/notifications' }} replace />;
  }

  return (
    <LeftPage>
      <Panel>
        <Heading>
          <span>Alerts — most recent first:</span>
          {feed && <Dim>{feed.notifications.length} filed</Dim>}
        </Heading>
        <Divider />
        {!feed && !error && <Dim>Loading notifications…</Dim>}
        {error && <Dim>{error}</Dim>}
        {feed?.notifications.length === 0 && <Dim>No notifications yet.</Dim>}
        {feed?.notifications.map(item => {
          const label = noticeTypes[item.type] || noticeTypes.collection_reaction;
          return (
            <NoticeLine key={item.id} $unread={!item.readAt}>
              <span className="when">{dateTime(item.createdAt)}</span>
              <span className="kind">
                {label}
                {item.type === 'reaction' && (
                  <SignalGlyph signal={item.signal} aria-hidden />
                )}
              </span>
              <span className="what"><NoticeText item={item} /></span>
              <span className="amount">
                {item.type === 'save' && item.amount != null
                  ? `+${fmtT26(item.amount)} /t26`
                  : ''}
              </span>
            </NoticeLine>
          );
        })}
      </Panel>
    </LeftPage>
  );
};

const LeftPage = styled(Page)`
  text-align: left;
`;

const Heading = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const NoticeLine = styled.div`
  display: grid;
  grid-template-columns: 16ch 14ch minmax(0, 1fr) 13ch;
  gap: 8px;
  align-items: baseline;
  min-height: 22px;
  padding: 2px 0;
  color: ${p => (p.$unread ? 'var(--amber-text)' : 'var(--amber-dim)')};

  .when { color: var(--amber-dim); white-space: nowrap; }
  .kind {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--amber-text);
    white-space: nowrap;
  }
  .kind svg {
    width: 12px;
    height: 12px;
    color: ${p => (p.$unread ? 'var(--gold-bright)' : 'var(--amber-dim)')};
  }
  .what { min-width: 0; overflow-wrap: anywhere; }
  .amount {
    color: #21e985;
    text-align: right;
    white-space: nowrap;
  }
  a { color: var(--amber-text); }
  a:hover { color: var(--gold-bright); text-decoration: none; }

  @media (max-width: 700px) {
    grid-template-columns: 12ch minmax(0, 1fr);
    gap: 4px 7px;
    padding: 5px 0;
    .when { grid-column: 1 / -1; font-size: 10px; }
    .kind { grid-column: 1; grid-row: 2; }
    .what { grid-column: 2; grid-row: 2; }
    .amount { grid-column: 2; grid-row: 3; text-align: left; }
  }
`;

const Counts = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  gap: 7px;
  color: var(--amber-dim);
  span { display: inline-flex; align-items: center; gap: 2px; }
  svg { width: 11px; height: 11px; color: var(--amber-text); }
`;

export default Notifications;
