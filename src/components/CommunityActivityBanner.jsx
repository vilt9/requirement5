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

const DEFAULT_REFRESH_MS = 30_000;
const MIN_REFRESH_MS = 30_000;
const PREFETCH_LEAD_MS = 2_200;
const QUIET_REFRESH_CHANCE = 0.28;
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
  if (activity.type === 'set_rarest') {
    return { special: true, icon: 'rare', ...signalByKey.rare };
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
  const [pulse, setPulse] = useState({
    status: 'checking',
    remainingMs: 0,
    durationMs: DEFAULT_REFRESH_MS
  });

  useEffect(() => {
    if (captureRoute) return undefined;

    let stopped = false;
    let inFlight = false;
    let timer = null;
    let prefetchTimer = null;
    let tick = null;
    let pulseHold = null;
    let pulseHoldUntil = 0;
    let nextRefreshAt = 0;
    let refreshDuration = DEFAULT_REFRESH_MS;
    let lastSignature = '';
    let pendingData = null;
    let pendingPromise = null;

    const signatureFor = (items = []) => items.map(item => item.id).join('|');

    const setCountdown = (status, remainingMs = refreshDuration, durationMs = refreshDuration) => {
      setPulse({ status, remainingMs: Math.max(0, remainingMs), durationMs });
    };

    const requestNext = () => {
      if (pendingPromise) return pendingPromise;
      pendingPromise = api('/api/cards/community/activity')
        .then(data => {
          pendingData = data;
          return data;
        })
        .catch(error => {
          pendingData = { error };
          return pendingData;
        })
        .finally(() => {
          pendingPromise = null;
        });
      return pendingPromise;
    };

    const applyDataAtPulse = async (fallbackData = null) => {
      const data = fallbackData || pendingData || await requestNext();
      pendingData = null;
      let refreshAfter = DEFAULT_REFRESH_MS;
      if (data?.error) {
        if (!stopped) setCountdown('quiet', 0, refreshDuration);
        return refreshAfter;
      }
      if (!stopped) {
        const nextActivities = Array.isArray(data?.activities) ? data.activities : [];
        const nextSignature = signatureFor(nextActivities);
        const firstLoad = !lastSignature;
        const quiet = !firstLoad && (
          nextSignature === lastSignature || Math.random() < QUIET_REFRESH_CHANCE
        );
        if (!quiet) {
          setActivities(nextActivities);
          lastSignature = nextSignature;
        }
        setCountdown(quiet ? 'quiet' : 'new', 0, refreshDuration);
        refreshAfter = Number(data?.refreshAfterMs) || DEFAULT_REFRESH_MS;
      }
      return refreshAfter;
    };

    const schedule = (delay = DEFAULT_REFRESH_MS, holdPulse = false) => {
      if (stopped) return;
      clearTimeout(timer);
      clearTimeout(prefetchTimer);
      clearTimeout(pulseHold);
      const wait = Math.max(MIN_REFRESH_MS, delay);
      refreshDuration = wait;
      nextRefreshAt = Date.now() + wait;
      if (holdPulse) {
        pulseHoldUntil = Date.now() + 1100;
        pulseHold = setTimeout(() => {
          pulseHoldUntil = 0;
          if (!stopped) setCountdown('waiting', nextRefreshAt - Date.now(), wait);
        }, 1100);
      } else {
        pulseHoldUntil = 0;
        setCountdown('waiting', wait, wait);
      }
      const prefetchWait = Math.max(0, wait - PREFETCH_LEAD_MS);
      prefetchTimer = setTimeout(() => {
        if (!stopped && document.visibilityState !== 'hidden') requestNext();
      }, prefetchWait);
      timer = setTimeout(settlePulse, wait);
    };

    const settlePulse = async () => {
      if (stopped || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      setCountdown('checking', 0, refreshDuration);
      try {
        const refreshAfter = await applyDataAtPulse();
        schedule(refreshAfter, true);
      } finally {
        inFlight = false;
      }
    };

    const loadNow = async () => {
      if (stopped || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      clearTimeout(timer);
      clearTimeout(prefetchTimer);
      setCountdown('checking', 0, refreshDuration);
      try {
        const data = await requestNext();
        const refreshAfter = await applyDataAtPulse(data);
        schedule(refreshAfter, true);
      } finally {
        inFlight = false;
      }
    };

    const visibilityChanged = () => {
      clearTimeout(timer);
      clearTimeout(prefetchTimer);
      if (document.visibilityState === 'visible') loadNow();
    };

    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('r5c:community-activity-changed', loadNow);
    tick = setInterval(() => {
      if (stopped || document.visibilityState === 'hidden' || !nextRefreshAt) return;
      if (Date.now() < pulseHoldUntil) return;
      setCountdown('waiting', nextRefreshAt - Date.now(), refreshDuration);
    }, 250);
    loadNow();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(prefetchTimer);
      clearTimeout(pulseHold);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('r5c:community-activity-changed', loadNow);
    };
  }, [captureRoute, user?.id]);

  if (captureRoute || activities.length === 0) return null;

  return (
    <Banner aria-label="Recent community activity">
      <Pulse
        aria-label={`Society feed ${pulse.status}`}
        title={pulse.status === 'quiet'
          ? 'No new society movement this time'
          : pulse.status === 'new'
            ? 'Society stream refreshed'
            : pulse.status === 'checking'
              ? 'Checking the society stream'
              : 'Next society check'}
        $status={pulse.status}
        $progress={pulse.durationMs > 0 ? pulse.remainingMs / pulse.durationMs : 0}
      >
        <PulseOrb aria-hidden="true" />
      </Pulse>
      <Rail role="list">
        {activities.map(activity => {
          const signal = signalByKey[activity.signal];
          const presentation = presentationFor(activity);
          const artwork = cardArtworkUrl(activity.card?.preview) || '/r5c_card_back.png';
          const rareSave = activity.type === 'save' && activity.card?.rarity?.special;
          const rarestSetSave = activity.type === 'set_rarest';
          const action = activity.type === 'signup'
            ? 'joined'
            : activity.type === 'set_complete'
            ? 'completed a set'
            : rarestSetSave
            ? 'collected the rarest set card'
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
            ? `set complete: ${activity.set?.label || 'card set'}`
            : rarestSetSave
            ? `rarest in set: ${activity.card.name}`
            : rareSave
              ? `collected ${activity.card.rarity.name}: ${activity.card.name}`
              : activity.saveOrdinal
                ? `made the ${activity.saveOrdinal} save on ${activity.card.name}`
              : activity.type === 'reaction'
                ? `reacted to ${activity.card.name}`
                : `collected ${activity.card.name}`;
          const tickerMark = activity.type === 'set_complete'
            ? '✓'
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
              : rarestSetSave
                ? 'rare'
                : activity.type === 'reaction'
                  ? 'reaction'
                  : rareSave
                    ? 'rare'
                    : activity.saveOrdinal
                      ? 'save-milestone'
                      : activity.synthetic
                        ? 'ambient'
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
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  text-align: left;
  animation: ${arrive} 220ms ease-out both;

  @media (max-width: 640px) {
    width: 100%;
    margin: -4px 0 -12px;
  }

  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const Pulse = styled.div`
  --pulse-progress: ${props => Math.max(0, Math.min(1, props.$progress || 0))};
  position: sticky;
  left: 0;
  z-index: 3;
  flex: 0 0 42px;
  width: 42px;
  height: 38px;
  display: grid;
  place-items: center;
  margin-left: max(10px, env(safe-area-inset-left));
  border-radius: 999px;
  background: linear-gradient(90deg, #000 0%, rgba(0, 0, 0, 0.72) 72%, rgba(0, 0, 0, 0));
  color: ${props => props.$status === 'quiet'
    ? 'rgba(156, 138, 104, 0.78)'
    : props.$status === 'new'
      ? '#83f0b4'
      : 'var(--gold-bright)'};
`;

const PulseOrb = styled.span`
  position: relative;
  z-index: 1;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(248, 212, 136, 0.85);
  border: 2px solid rgba(0, 0, 0, 0.4);
  box-shadow:
    0 0 10px rgba(232, 180, 85, 0.45),
    inset 0 0 0 6px rgba(0, 0, 0, 0.13),
    inset 0 0 0 9px rgba(255, 255, 255, 0.08);

  &::before {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    background: conic-gradient(
      currentColor calc(var(--pulse-progress) * 1turn),
      rgba(255, 255, 255, 0.14) 0deg
    );
    opacity: 1;
    pointer-events: none;
    -webkit-mask: radial-gradient(farthest-side, transparent 62%, #000 64%);
    mask: radial-gradient(farthest-side, transparent 62%, #000 64%);
  }

  &::after {
    content: '';
    position: absolute;
    inset: 12px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.22);
    box-shadow: 0 0 5px rgba(255, 255, 255, 0.1);
  }
`;

const Rail = styled.div`
  display: flex;
  flex: 1 1 auto;
  gap: 5px;
  overflow-x: auto;
  padding: 2px max(12px, env(safe-area-inset-right)) 2px 0;
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
