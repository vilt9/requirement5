import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { api } from '../utils/api';
import { Panel, PillButton, Divider } from './UI';

// Rough /t26 cost of the two things you actually spend on, measured from the
// live economy (mean save ≈ 9.5, mean create fee ≈ 2.5). Used to translate a
// bundle into "how much play" it buys.
const PER_SAVE = 9.5;
const PER_CREATE = 2.5;

// Fallback catalogue for the brief moment before the server's bundles load (and
// if that call fails). The server is authoritative — the id sent at checkout is
// priced there — so these figures only ever drive the initial paint.
const FALLBACK_BUNDLES = [
  { id: 't26_300', usd: 2.99, t26: 300 },
  { id: 't26_1200', usd: 9.99, t26: 1200 },
  { id: 't26_7000', usd: 49.99, t26: 7000 }
];

// Purchase options for /t26. "Buy" opens Stripe Checkout; the purchase is
// credited by the server webhook when payment completes.
const TopUpPanel = () => {
  const [bundles, setBundles] = useState(FALLBACK_BUNDLES);
  const [enabled, setEnabled] = useState(true);
  const [note, setNote] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    api('/api/payments/bundles')
      .then(data => {
        if (Array.isArray(data?.bundles) && data.bundles.length) setBundles(data.bundles);
        setEnabled(!!data?.enabled);
      })
      .catch(() => { /* keep the fallback catalogue */ });
  }, []);

  const buy = async (bundle) => {
    setNote(null);
    setBusyId(bundle.id);
    try {
      const { url } = await api('/api/payments/checkout', {
        method: 'POST',
        body: { bundle: bundle.id }
      });
      if (url) {
        window.location.assign(url); // hand off to Stripe's hosted checkout
        return;
      }
      setNote('Could not start checkout — please try again.');
    } catch (err) {
      setNote(err.status === 503
        ? 'Top-ups aren’t available just yet — check back soon.'
        : err.message || 'Could not start checkout — please try again.');
    }
    setBusyId(null);
  };

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
        {bundles.map((b) => (
          <Tier key={b.id}>
            <span className="price">${b.usd.toFixed(2)}</span>
            <span className="amount">{b.t26.toLocaleString()} /t26</span>
            <span className="rate">$1 = {Math.round(b.t26 / b.usd)} /t26</span>
            <span className="buys">
              ≈ {Math.round(b.t26 / PER_SAVE).toLocaleString()} saves*<br />
              ≈ {Math.round(b.t26 / PER_CREATE).toLocaleString()} creations*
            </span>
            <PillButton onClick={() => buy(b)} disabled={busyId !== null}>
              {busyId === b.id ? 'Starting…' : 'Buy'}
            </PillButton>
          </Tier>
        ))}
      </Grid>

      <Footnote>
        * Estimates based on average prices across the site — actual save and
        create costs vary from card to card.
      </Footnote>

      {!enabled && (
        <Footnote>
          Top-ups are being set up — the Buy buttons aren’t live on this server yet.
        </Footnote>
      )}

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
