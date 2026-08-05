import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { fmtT26 } from '../utils/economyRandom';
import { cardArtworkUrl } from '../utils/poolCard';
import { signalByKey } from '../utils/signals';
import {
  communityActivityPath,
  relativeActivityTime
} from '../utils/communityActivity';
import SignalGlyph from './SignalGlyph';

const DEFAULT_REFRESH_MS = 60_000;
const MIN_REFRESH_MS = 30_000;
const RARITY_SIGNAL = {
  wowa: 'rare',
  ultra: 'crown',
  vmax: 'sparkle'
};

const presentationFor = (activity) => {
  if (activity.type === 'signup') {
    return { special: true, icon: 'human', ...signalByKey.human };
  }
  if (activity.type === 'set_complete') {
    return { special: true, icon: 'trophy', ...signalByKey.trophy };
  }
  if (activity.type === 'reaction') {
    const signal = signalByKey[activity.signal];
    return signal
      ? { special: true, icon: activity.signal, ...signal }
      : { special: false, icon: null };
  }
  if (activity.type === 'save' && activity.card?.rarity?.special) {
    const icon = RARITY_SIGNAL[activity.card.rarity.key] || 'rare';
    const signal = signalByKey[icon] || signalByKey.rare;
    return {
      special: true,
      icon,
      ...signal,
      color: activity.card.rarity.color || signal.color
    };
  }
  return { special: false, icon: null };
};

const CommunityActivityBanner = () => {
  const { user } = useAuth();
  const location = useLocation();
  const captureRoute = location.pathname.startsWith('/capture/');
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    if (captureRoute) return undefined;

    let stopped = false;
    let inFlight = false;
    let timer = null;

    const schedule = (delay = DEFAULT_REFRESH_MS) => {
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(load, Math.max(MIN_REFRESH_MS, delay));
    };

    const load = async () => {
      if (stopped || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      let refreshAfter = DEFAULT_REFRESH_MS;
      try {
        const data = await api('/api/cards/community/activity');
        if (!stopped) {
          setActivities(Array.isArray(data?.activities) ? data.activities : []);
          refreshAfter = Number(data?.refreshAfterMs) || DEFAULT_REFRESH_MS;
        }
      } catch {
        // Ambient UI: a feed outage must never block or alarm the primary page.
      } finally {
        inFlight = false;
        schedule(refreshAfter);
      }
    };

    const visibilityChanged = () => {
      clearTimeout(timer);
      if (document.visibilityState === 'visible') load();
    };

    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('r5c:community-activity-changed', load);
    load();
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('r5c:community-activity-changed', load);
    };
  }, [captureRoute, user?.id]);

  if (captureRoute || activities.length === 0) return null;

  return (
    <Banner aria-label="Recent community activity">
      <Rail role="list">
        {activities.map(activity => {
          const signal = signalByKey[activity.signal];
          const presentation = presentationFor(activity);
          const artwork = cardArtworkUrl(activity.card?.preview) || '/r5c_card_back.png';
          const rareSave = activity.type === 'save' && activity.card?.rarity?.special;
          const action = activity.type === 'signup'
            ? 'joined'
            : activity.type === 'set_complete'
            ? 'completed'
            : rareSave
              ? `saved a ${activity.card.rarity.name} card`
              : activity.type === 'save'
                ? 'saved'
                : `sent ${signal?.label || 'a reaction'} to`;
          const subject = activity.type === 'signup'
            ? 'Requirement5'
            : activity.type === 'set_complete'
            ? `${activity.set?.label || 'card'} set`
            : activity.card.name;
          const tickerSubject = activity.type === 'signup'
            ? 'joined the society'
            : activity.type === 'set_complete'
            ? activity.set?.label || 'card set'
            : rareSave
              ? `${activity.card.rarity.name} · ${activity.card.name}`
              : activity.saveOrdinal
                ? `${activity.saveOrdinal} save · ${activity.card.name}`
              : activity.card.name;
          const tickerMark = activity.type === 'set_complete'
            ? '✓'
            : activity.type === 'save'
              ? (activity.saveOrdinal || '+')
              : activity.type === 'signup'
                ? '+'
              : null;
          const relevance = activity.relevance === 'created'
            ? 'your card'
            : activity.relevance === 'collected'
              ? 'also in your collection'
              : activity.relevance === 'you'
                ? 'you'
              : null;
          const presentationKind = activity.type === 'signup'
            ? 'signup'
            : activity.type === 'set_complete'
              ? 'milestone'
              : activity.type === 'reaction'
                ? 'reaction'
                : rareSave
                  ? 'rare'
                  : activity.saveOrdinal
                    ? 'save-milestone'
                    : 'standard';

          return (
            <ActivityItem key={activity.id} role="listitem">
              <ActivityLink
                to={communityActivityPath(activity)}
                aria-label={`${activity.actor.username} ${action} ${subject}`}
                data-presentation={presentationKind}
                $special={presentation.special}
                $colour={presentation.color}
                $accent={presentation.accent}
              >
                <Preview
                  $background={activity.card?.preview?.backgroundColor}
                  $special={presentation.special}
                  $colour={presentation.color}
                >
                  <img
                    src={artwork}
                    alt=""
                    width="25"
                    height="34"
                    loading="lazy"
                    onError={event => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = '/r5c_card_back.png';
                    }}
                  />
                </Preview>
                <ActivityText>
                  <Copy data-activity-copy>
                    <Actor $special={presentation.special}>@{activity.actor.username}</Actor>{' '}
                    {presentation.icon && (
                      <MomentGlyph $colour={presentation.color} aria-hidden="true">
                        <SignalGlyph signal={presentation.icon} />
                      </MomentGlyph>
                    )}
                    {tickerMark && <TickerMark aria-hidden="true">{tickerMark}</TickerMark>}
                    <CardName $special={presentation.special}>{tickerSubject}</CardName>
                    {activity.reward?.amount > 0 && (
                      <RewardPill aria-label={`reward ${fmtT26(activity.reward.amount)} t26`}>
                        +{fmtT26(activity.reward.amount)} /t26
                      </RewardPill>
                    )}
                  </Copy>
                  <Meta>
                    <time dateTime={activity.createdAt}>
                      {relativeActivityTime(activity.createdAt)}
                    </time>
                    {relevance && <Relevance>{relevance}</Relevance>}
                  </Meta>
                </ActivityText>
              </ActivityLink>
            </ActivityItem>
          );
        })}
      </Rail>
    </Banner>
  );
};

const arrive = keyframes`
  from { opacity: 0; transform: translateY(-3px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Banner = styled.section`
  width: 100vw;
  margin: -32px calc(50% - 50vw) -12px;
  padding: 0;
  background: transparent;
  text-align: left;
  animation: ${arrive} 220ms ease-out both;

  @media (max-width: 640px) {
    width: 100%;
    margin: -4px 0 -12px;
  }

  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const Rail = styled.div`
  display: flex;
  gap: 5px;
  overflow-x: auto;
  padding: 2px max(12px, env(safe-area-inset-left)) 2px max(12px, env(safe-area-inset-right));
  scrollbar-width: none;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar { display: none; }
`;

const ActivityItem = styled.div`
  flex: 0 0 auto;
  min-width: 0;
  max-width: min(340px, calc(100vw - 24px));
`;

const ActivityLink = styled(Link)`
  position: relative;
  isolation: isolate;
  overflow: hidden;
  width: max-content;
  min-width: 170px;
  max-width: 100%;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 7px 0 0;
  border: 1px solid ${props => props.$special
    ? `color-mix(in srgb, ${props.$colour || 'var(--gold)'} 42%, var(--panel-border))`
    : 'rgba(156, 138, 104, 0.22)'};
  border-radius: 5px;
  background: ${props => props.$special ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.018)'};
  color: var(--amber-text);
  transition: border-color 150ms ease, background 150ms ease;

  &[data-presentation='rare'] {
    border-color: color-mix(in srgb, ${props => props.$colour || '#58d4ff'} 72%, #ffffff);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, ${props => props.$colour || '#58d4ff'} 34%, transparent);
  }

  &[data-presentation='milestone'] {
    border-color: rgba(255, 255, 255, 0.64);
    border-style: dashed;
    background: rgba(20, 14, 9, 0.86);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  }

  &[data-presentation='save-milestone'] {
    border-color: rgba(232, 180, 85, 0.44);
    background: rgba(232, 180, 85, 0.055);
  }

  &[data-presentation='signup'] {
    border-color: rgba(237, 170, 101, 0.5);
    background: rgba(237, 170, 101, 0.06);
  }

  &::before {
    content: '';
    position: absolute;
    z-index: -1;
    inset: -6px;
    background: ${props => props.$special
      ? `linear-gradient(
          135deg,
          color-mix(in srgb, ${props.$colour || '#58d4ff'} 36%, transparent),
          color-mix(in srgb, ${props.$accent || '#9b73ff'} 28%, rgba(0, 0, 0, 0.12))
        )`
      : 'none'};
    filter: blur(8px);
    opacity: ${props => props.$special ? 0.72 : 0};
    pointer-events: none;
  }

  > * { position: relative; z-index: 1; }

  &:hover {
    color: var(--amber-text);
    text-decoration: none;
    border-color: rgba(232, 180, 85, 0.48);
    background: rgba(232, 180, 85, 0.075);
  }

  &:focus-visible {
    outline: 1px solid var(--gold-bright);
    outline-offset: 1px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const Preview = styled.span`
  position: relative;
  align-self: stretch;
  flex: 0 0 25px;
  width: 25px;
  height: 100%;
  overflow: hidden;
  border: 0;
  border-right: 1px solid ${props => props.$special
    ? `color-mix(in srgb, ${props.$colour || 'var(--gold)'} 62%, transparent)`
    : 'rgba(156, 138, 104, 0.2)'};
  border-radius: 4px 0 0 4px;
  background: ${props => props.$background || '#17130d'};

  img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
`;

const ActivityText = styled.span`
  min-width: 0;
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 6px;
`;

const Copy = styled.span`
  display: block;
  overflow: hidden;
  max-width: 250px;
  color: var(--amber-text);
  font-size: 9px;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Actor = styled.strong`
  color: ${props => props.$special ? 'var(--gold-bright)' : 'var(--amber-text)'};
  font-weight: 700;
`;

const CardName = styled.span`
  color: ${props => props.$special ? 'var(--white)' : 'var(--amber-text)'};
`;

const RewardPill = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  padding: 1px 4px;
  border: 1px solid rgba(33, 233, 133, 0.34);
  border-radius: 999px;
  background: rgba(33, 233, 133, 0.08);
  color: #83f0b4;
  font-size: 8px;
  letter-spacing: 0.02em;
  white-space: nowrap;
`;

const MomentGlyph = styled.span`
  display: inline-flex;
  margin-right: 2px;
  color: ${props => props.$colour || 'var(--gold-bright)'};
  vertical-align: -0.18em;
  svg { width: 10px; height: 10px; }
`;

const TickerMark = styled.span`
  margin-right: 3px;
  color: var(--amber-dim);
  font-weight: 700;
`;

const Meta = styled.span`
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 4px;
  color: var(--amber-dim);
  font-size: 7px;
  line-height: 1;
`;

const Relevance = styled.span`
  overflow: hidden;
  max-width: 50px;
  padding-left: 4px;
  border-left: 1px solid rgba(232, 180, 85, 0.24);
  color: var(--gold);
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export default CommunityActivityBanner;
