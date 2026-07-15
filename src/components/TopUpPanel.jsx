import { useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { Panel, PillButton, Divider } from './UI';

// Rough /t26 cost of the two things you actually spend on, measured from the
// live economy (mean save ≈ 9.5, mean create fee ≈ 2.5). Used to translate a
// bundle into "how much play" it buys.
const PER_SAVE = 9.5;
const PER_CREATE = 2.5;

// Three purchase tiers — no names, just the price and what it buys. /t26 climbs
// faster than the dollars (100 → 140 /t26 per $), so bigger bundles are better
// value.
const BUNDLES = [
  { usd: 2.99, t26: 300 },
  { usd: 9.99, t26: 1200 },
  { usd: 49.99, t26: 7000 }
];

// Purchase options for /t26. Frontend-only for now — "Buy" just acknowledges;
// there's no checkout wired yet.
const TopUpPanel = () => {
  const [note, setNote] = useState(null);

  return (
    <Panel>
      Top up your /t26
      <Divider />
      <Copy>
        Purchasing /t26 helps us pay for our Earth server costs and lets us invest
        in Earth marketing to grow the imagination sent over QECBIT_P.
      </Copy>
      <Copy>
        Purchasing /t26 is fully optional. /t26 can be gained by{' '}
        <Link to="/">generating cards</Link>.
      </Copy>

      <Grid>
        {BUNDLES.map((b) => (
          <Tier key={b.usd}>
            <span className="price">${b.usd.toFixed(2)}</span>
            <span className="amount">{b.t26.toLocaleString()} /t26</span>
            <span className="rate">$1 = {Math.round(b.t26 / b.usd)} /t26</span>
            <span className="buys">
              ≈ {Math.round(b.t26 / PER_SAVE).toLocaleString()} saves*<br />
              ≈ {Math.round(b.t26 / PER_CREATE).toLocaleString()} creations*
            </span>
            <PillButton onClick={() => setNote('Checkout is coming soon — thanks for reinforcing the channel.')}>
              Buy
            </PillButton>
          </Tier>
        ))}
      </Grid>

      <Footnote>
        * Estimates based on average prices across the site — actual save and
        create costs vary from card to card.
      </Footnote>

      {note && <Note>{note}</Note>}
    </Panel>
  );
};

const Copy = styled.p`
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--amber-dim);
  a { color: var(--gold-bright); }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 12px;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

const Tier = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  padding: 12px;
  background: var(--field-bg);
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  text-align: left;

  .price {
    font-size: 20px;
    font-weight: 600;
    color: var(--gold-bright);
  }

  .amount {
    font-size: 13px;
    color: var(--amber-text);
  }

  .rate {
    font-size: 11px;
    color: var(--amber-dim);
  }

  .buys {
    font-size: 11px;
    line-height: 1.5;
    color: var(--amber-dim);
  }

  button { margin-top: 6px; }
`;

const Footnote = styled.p`
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--amber-dim);
`;

const Note = styled.div`
  margin-top: 12px;
  font-size: 12px;
  color: var(--gold-bright);
`;

export default TopUpPanel;
