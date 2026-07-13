import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { api } from '../utils/api';

// Site-wide footer: a live top-line banner of the public economy, plus a link
// into the full cohort analytics. Reads the same /api/analytics payload the
// dashboard uses, but only touches the cheap totals. Renders quietly (nothing
// but the link) until the numbers arrive, and never blocks the page.
const Footer = () => {
  const [totals, setTotals] = useState(null);

  useEffect(() => {
    let live = true;
    api('/api/analytics')
      .then(d => { if (live) setTotals(d.totals); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const fmt = (n) => Math.round(n || 0).toLocaleString();

  return (
    <Bar>
      <Banner>
        {totals ? (
          <>
            <Metric><b>{fmt(totals.users)}</b> players</Metric>
            <Sep>·</Sep>
            <Metric><b>{fmt(totals.publicCards)}</b> cards</Metric>
            <Sep>·</Sep>
            <Metric><b>{fmt(totals.circulating)}</b> /t26 in play</Metric>
            <Sep>·</Sep>
            <Metric><b>{fmt(totals.creators)}</b> creators</Metric>
          </>
        ) : (
          <Metric><Dimmed>a living, player-run card economy</Dimmed></Metric>
        )}
      </Banner>
      <AnalyticsLink to="/analytics">Cohort analytics →</AnalyticsLink>
    </Bar>
  );
};

const Bar = styled.footer`
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 12px 18px;
  border-top: 1px solid var(--panel-border);
  background: var(--panel);
  font-size: 11px;
`;

const Banner = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--amber-text);
`;

const Metric = styled.span`
  b { color: var(--gold-bright); font-weight: 700; }
`;

const Sep = styled.span`color: var(--amber-dim);`;
const Dimmed = styled.span`color: var(--amber-dim);`;

const AnalyticsLink = styled(Link)`
  color: var(--gold-bright);
  font-weight: 700;
  white-space: nowrap;
  &:hover { color: var(--white); }
`;

export default Footer;
