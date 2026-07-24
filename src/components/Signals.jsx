import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { LuChevronLeft, LuChevronRight, LuScanEye } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { SIGNALS } from '../utils/signals';

const VISITOR_KEY = 'r5c_signal_visitor';
const PAGE_SIZE = 12;

const visitorId = () => {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
};

const emptyCounts = () => Object.fromEntries(SIGNALS.map(signal => [signal.key, 0]));

const Signals = ({ cardId, creatorId, bloom = false }) => {
  const { user } = useAuth();
  const guestId = useRef(visitorId());
  const [data, setData] = useState({ counts: emptyCounts(), total: 0, mine: [] });
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [momentBloom, setMomentBloom] = useState(false);
  const closeTimer = useRef(null);
  const bloomFrame = useRef(null);
  const ownCard = !!user && user.id === creatorId;
  const activeBloom = bloom || momentBloom;

  const replayBloom = useCallback(() => {
    cancelAnimationFrame(bloomFrame.current);
    setMomentBloom(true);
    bloomFrame.current = requestAnimationFrame(() => {
      bloomFrame.current = requestAnimationFrame(() => setMomentBloom(false));
    });
  }, []);

  useEffect(() => {
    let active = true;
    api(`/api/cards/${cardId}/signals?guestId=${encodeURIComponent(guestId.current)}`)
      .then(next => {
        if (active) {
          setData(next);
          replayBloom();
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      cancelAnimationFrame(bloomFrame.current);
    };
  }, [cardId, user?.id, replayBloom]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const holdOpen = () => {
    clearTimeout(closeTimer.current);
    if (!ownCard) setOpen(true);
  };

  const release = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  const choose = useCallback(async (key) => {
    if (ownCard || busy) return;
    setBusy(true);
    setError(null);
    try {
      const selected = data.mine?.includes(key);
      const next = selected
        ? await api(`/api/cards/${cardId}/signals`, {
            method: 'DELETE',
            body: { signal: key, guestId: guestId.current }
          })
        : await api(`/api/cards/${cardId}/signals`, {
            method: 'PUT',
            body: { signal: key, guestId: guestId.current }
          });
      setData(next);
      if (!selected) replayBloom();
    } catch (err) {
      setError(err?.message || 'Reaction lost. Try again.');
    } finally {
      setBusy(false);
    }
  }, [ownCard, busy, data.mine, cardId, replayBloom]);

  const active = SIGNALS.filter(signal => data.counts?.[signal.key] > 0);
  const pageCount = Math.ceil(SIGNALS.length / PAGE_SIZE);
  const pageSignals = SIGNALS.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <SignalRail aria-label="Card reactions" $active={activeBloom}>
      <SignalSummary>
        <ReactLabel>React</ReactLabel>
        {active.map(signal => (
          <CountButton
            key={signal.key}
            type="button"
            title={`${signal.label}: ${data.counts[signal.key]}`}
            aria-label={`${signal.label}: ${data.counts[signal.key]} reaction${data.counts[signal.key] === 1 ? '' : 's'}`}
            $color={signal.color}
            $accent={signal.accent}
            $mine={data.mine?.includes(signal.key)}
            $active={activeBloom}
            onClick={() => choose(signal.key)}
            disabled={busy || ownCard}
          >
            <signal.Icon aria-hidden />
            <span>{data.counts[signal.key]}</span>
          </CountButton>
        ))}
        {!active.length && <Quiet>No reactions yet</Quiet>}
      </SignalSummary>

      <PickerWrap
        onPointerEnter={event => { if (event.pointerType === 'mouse') holdOpen(); }}
        onPointerLeave={event => { if (event.pointerType === 'mouse') release(); }}
      >
        <OpenButton
          type="button"
          aria-label={ownCard ? 'Reactions on your card' : 'React to this card'}
          title={ownCard ? 'Reactions on your card' : 'React to this card'}
          aria-expanded={open}
          $active={activeBloom}
          disabled={ownCard}
          onFocus={holdOpen}
          onBlur={release}
          onClick={holdOpen}
        >
          <LuScanEye aria-hidden />
        </OpenButton>
        {open && (
          <Picker
            onFocus={holdOpen}
            onBlur={release}
          >
            <SignalGrid role="grid" aria-label="Choose reactions">
              {pageSignals.map(signal => (
                <SignalButton
                  key={signal.key}
                  type="button"
                  role="gridcell"
                  title={signal.label}
                  aria-label={signal.label}
                  aria-pressed={data.mine?.includes(signal.key)}
                  $color={signal.color}
                  $accent={signal.accent}
                  $selected={data.mine?.includes(signal.key)}
                  onClick={() => choose(signal.key)}
                  disabled={busy}
                >
                  <signal.Icon aria-hidden />
                </SignalButton>
              ))}
            </SignalGrid>
            <Pager aria-label="Reaction pages">
              <PageButton
                type="button"
                aria-label="Previous reactions"
                onClick={() => setPage(current => (current - 1 + pageCount) % pageCount)}
              >
                <LuChevronLeft aria-hidden />
              </PageButton>
              <PageStatus aria-live="polite">{page + 1} / {pageCount}</PageStatus>
              <PageButton
                type="button"
                aria-label="Next reactions"
                onClick={() => setPage(current => (current + 1) % pageCount)}
              >
                <LuChevronRight aria-hidden />
              </PageButton>
            </Pager>
          </Picker>
        )}
      </PickerWrap>
      {error && <SignalError>{error}</SignalError>}
    </SignalRail>
  );
};

const SignalRail = styled.div`
  position: relative;
  z-index: 90;
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 6px 5px 9px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: transparent;
  overflow: visible;
  isolation: isolate;

  &::before {
    content: '';
    position: absolute;
    z-index: -1;
    inset: 5px 36px 5px 24px;
    border-radius: 6px;
    background: linear-gradient(
      90deg,
      rgba(67, 204, 255, 0.32),
      rgba(222, 86, 230, 0.28),
      rgba(255, 187, 70, 0.3),
      rgba(74, 216, 132, 0.28)
    );
    filter: blur(13px);
    opacity: ${p => (p.$active ? 0.55 : 0)};
    transition: opacity ${p => (p.$active ? '0s' : '3s')} ease;
    pointer-events: none;
  }
`;

const SignalSummary = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
`;

const ReactLabel = styled.span`
  margin: 0 5px 0 1px;
  color: var(--gold-bright);
  font-size: 10px;
  font-weight: 700;
`;

const Quiet = styled.span`
  color: var(--amber-dim);
  font-size: 10px;
`;

const CountButton = styled.button`
  position: relative;
  isolation: isolate;
  overflow: hidden;
  height: 27px;
  min-width: 34px;
  padding: 0 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  color: var(--gold-bright);
  background: rgba(0, 0, 0, 0.08);
  box-shadow: ${p => (p.$active && p.$mine ? '0 0 12px rgba(248, 212, 136, 0.28)' : 'none')};
  cursor: pointer;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  transition: box-shadow ${p => (p.$active ? '0s' : '3s')} ease;

  &::before {
    content: '';
    position: absolute;
    z-index: -1;
    inset: -5px;
    background: linear-gradient(
      135deg,
      ${p => `color-mix(in srgb, ${p.$color} ${p.$mine ? '54%' : '36%'}, transparent)`},
      ${p => `color-mix(in srgb, ${p.$accent} ${p.$mine ? '44%' : '28%'}, rgba(0, 0, 0, 0.12))`}
    );
    filter: blur(6px);
    opacity: ${p => (p.$active ? 1 : 0)};
    transition: opacity ${p => (p.$active ? '0s' : '3s')} ease;
    pointer-events: none;
  }

  svg, span { position: relative; z-index: 1; }
  svg { width: 14px; height: 14px; }
  &:hover:not(:disabled) {
    color: var(--gold-bright);
    box-shadow: 0 0 14px rgba(248, 212, 136, 0.44);
  }
  &:hover:not(:disabled)::before,
  &:focus-visible::before {
    opacity: 1;
    transition-duration: 180ms;
  }
  &:disabled { cursor: default; opacity: 0.72; }
`;

const PickerWrap = styled.div`
  position: relative;
  flex: 0 0 auto;
`;

const OpenButton = styled.button`
  position: relative;
  isolation: isolate;
  overflow: hidden;
  width: 27px;
  height: 27px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  color: var(--gold-bright);
  background: rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: color 140ms ease, box-shadow 140ms ease;

  &::before {
    content: '';
    position: absolute;
    z-index: -1;
    inset: -6px;
    background: linear-gradient(
      135deg,
      rgba(76, 201, 255, 0.48),
      rgba(231, 92, 183, 0.44),
      rgba(255, 190, 72, 0.46)
    );
    filter: blur(6px);
    opacity: ${p => (p.$active ? 1 : 0)};
    transition: opacity ${p => (p.$active ? '0s' : '3s')} ease;
    pointer-events: none;
  }

  svg { position: relative; z-index: 1; width: 15px; height: 15px; }
  &:hover:not(:disabled), &:focus-visible {
    color: var(--gold-bright);
    box-shadow: 0 0 13px rgba(248, 212, 136, 0.38);
  }
  &:hover:not(:disabled)::before,
  &:focus-visible::before {
    opacity: 1;
    transition-duration: 180ms;
  }
  &:disabled { color: var(--amber-dim); cursor: default; opacity: 0.6; }
`;

const Picker = styled.div`
  position: absolute;
  z-index: 70;
  right: -6px;
  bottom: calc(100% + 8px);
  width: 202px;
  padding: 11px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background:
    linear-gradient(135deg,
      rgba(71, 202, 255, 0.34) 0%,
      rgba(174, 99, 223, 0.29) 29%,
      rgba(250, 184, 65, 0.28) 62%,
      rgba(76, 211, 133, 0.3) 100%),
    rgba(4, 4, 4, 0.94);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(14px);
  animation: signalPickerIn 130ms ease-out;
  @keyframes signalPickerIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const SignalGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 38px);
  grid-auto-rows: 38px;
  gap: 8px;
`;

const SignalButton = styled.button`
  width: 38px;
  height: 38px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  color: var(--gold-bright);
  background:
    linear-gradient(
      135deg,
      ${p => `color-mix(in srgb, ${p.$color} ${p.$selected ? '54%' : '26%'}, transparent)`},
      ${p => `color-mix(in srgb, ${p.$accent} ${p.$selected ? '42%' : '22%'}, rgba(0, 0, 0, 0.25))`}
    ),
    rgba(0, 0, 0, 0.48);
  box-shadow: ${p => (p.$selected
    ? 'inset 0 0 16px rgba(248, 212, 136, 0.1), 0 0 11px rgba(248, 212, 136, 0.36)'
    : 'inset 0 0 12px rgba(255, 255, 255, 0.025)')};
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: color 130ms ease, background 130ms ease, box-shadow 130ms ease;
  svg { width: 19px; height: 19px; stroke-width: 1.7; }
  &:hover:not(:disabled), &:focus-visible {
    color: var(--gold-bright);
    box-shadow: 0 0 14px rgba(248, 212, 136, 0.44);
    outline: none;
  }
  &:disabled { cursor: wait; }
`;

const Pager = styled.div`
  margin-top: 10px;
  padding-top: 9px;
  display: grid;
  grid-template-columns: 28px 1fr 28px;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--panel-border);
`;

const PageButton = styled.button`
  width: 28px;
  height: 24px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 1px solid var(--panel-border);
  border-radius: 5px;
  color: var(--gold-bright);
  background: rgba(0, 0, 0, 0.22);
  cursor: pointer;
  transition: color 130ms ease, background 130ms ease;

  svg { width: 14px; height: 14px; }
  &:hover, &:focus-visible {
    color: #fff1bd;
    background: rgba(248, 212, 136, 0.09);
    outline: none;
  }
`;

const PageStatus = styled.span`
  color: var(--amber-dim);
  font-size: 9px;
  text-align: center;
  font-variant-numeric: tabular-nums;
`;

const SignalError = styled.span`
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  color: #ff8a8a;
  font-size: 10px;
`;

export default Signals;
