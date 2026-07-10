import styled from 'styled-components';
import { fmtT26 } from '../../utils/economyRandom';
import { Dim } from '../UI';

// A colourless read of a collection: the rarity scores of its rarest few cards
// (each card carries an auto-generated 0..1 score), plus the total spent
// building it. No colours — the tier colour code confused people.
const RarityStrip = ({ topScores = [], value, count }) => (
  <Wrap>
    {topScores.length > 0 && (
      <div className="scores">
        <Dim>Top rarity</Dim>
        {topScores.map((s, i) => <b key={i}>{s.toFixed(3)}</b>)}
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

  .scores { display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px 8px; }
  .scores b { color: var(--gold-bright); font-weight: 600; font-variant-numeric: tabular-nums; }
  .meta { font-size: 11px; }
`;

export default RarityStrip;
