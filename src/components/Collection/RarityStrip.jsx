import styled from 'styled-components';
import { fmtT26 } from '../../utils/economyRandom';
import { Dim } from '../UI';

// A colourless read of a collection: its rarest few tiers as plain percents,
// plus the total spent building it. Rarity used to be shown as coloured dots /
// bars, but the colour→rarity code confused people, so it's words and numbers
// now. `tierName` maps a tier key to its display name (from the economy config).
const RarityStrip = ({ rarity = [], value, count, tierName }) => (
  <Wrap>
    {rarity.length > 0 && (
      <div className="pcts">
        {rarity.slice(0, 3).map(r => (
          <span key={r.key}>{tierName(r.key)} <b>{r.pct}%</b></span>
        ))}
      </div>
    )}
    <Dim className="meta">
      {count} card{count === 1 ? '' : 's'}
      {value != null && <> · {fmtT26(value)} /t26 spent</>}
    </Dim>
  </Wrap>
);

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;

  .pcts { display: flex; flex-wrap: wrap; gap: 3px 10px; color: var(--amber-text); }
  .pcts span { white-space: nowrap; }
  .pcts b { color: var(--gold-bright); font-weight: 600; }
  .meta { font-size: 11px; }
`;

export default RarityStrip;
