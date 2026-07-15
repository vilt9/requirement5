import styled from 'styled-components';
import { LuCircleArrowRight } from 'react-icons/lu';
import { PillButton, Dim } from '../UI';
import { fmtT26 } from '../../utils/economyRandom';

// Average save price per tier, from the economy's calibrated price centres
// (see server/services/economy.js). Actual prices vary per card — these are
// pool averages, shown so a creator can see how rarity drives earnings.
const TIER_EARNINGS = [
  { name: 'Common', avg: 6.5 },
  { name: 'Uncommon', avg: 10 },
  { name: 'Scarce', avg: 13 },
  { name: 'Rare', avg: 17.4 },
  { name: 'Fine', avg: 22.5 },
  { name: 'Singular', avg: 29.8 }
];

// Stage 1 of the customizer: the roll. Every card starts as a rolled base —
// a random background + default holo + a rolled rarity, with no main image yet.
// Regenerate rerolls the background and the rarity (the holo stays). Start
// commits to the card (costs /t26) and moves into design.
const StartStage = ({
  rarity,
  tierName,
  tierColor,
  dividendRate = 0.7,
  rolls,
  regenCost,
  createCost,
  loggedIn,
  paidCreate,
  onRegenerate,
  onNext
}) => {
  const pct = Math.round(dividendRate * 100);
  return (
    <Wrap className="start-stage">
      <Block>
        <BlockTitle>Randomly generated Rarity Value:</BlockTitle>
        <Roll style={{ '--tier': tierColor || 'var(--gold-bright)' }}>
          <span className="label"><Dim>RV:</Dim></span>
          <span className="score">{(rarity ?? 0).toFixed(3)}</span>
          {tierName && <span className="tier">{tierName}</span>}
        </Roll>
        <Dim>
          Hit “Regenerate” to get a new randomly generated Rarity Value. Regeneration
          costs you /t26.
        </Dim>
        <RollRow>
          <PillButton $secondary type="button" className="regenerate" onClick={onRegenerate}>
            Regenerate <span className="cost">−{fmtT26(regenCost)} /t26</span>
          </PillButton>
        </RollRow>
        {rolls > 0 && <Dim className="rolls">{rolls} regeneration{rolls === 1 ? '' : 's'}</Dim>}
        {!loggedIn && (
          <Dim className="anon-note">
            Logged out, regenerating is free — but logging in starts you on a fresh
            roll, so bank a card you like by logging in before you fish for more.
          </Dim>
        )}
      </Block>

      <EarnBox>
        <summary>How you earn from your cards</summary>
        <div className="body">
          <p>
            When another player saves your card to their collection, you receive{' '}
            <b>{pct}%</b> of the price they pay — credited straight to your /t26
            balance.
          </p>
          <p>
            Rarer cards command higher average prices, so they earn more per save.
            Every card rolls its own price around a centre set by its rarity:
          </p>
          <EarnTable>
            <thead>
              <tr><th>Tier</th><th>Avg. save price</th><th>Your {pct}%</th></tr>
            </thead>
            <tbody>
              {TIER_EARNINGS.map(t => (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td>≈ {t.avg} /t26</td>
                  <td>≈ {(t.avg * dividendRate).toFixed(1)} /t26</td>
                </tr>
              ))}
            </tbody>
          </EarnTable>
          <p className="fine">
            Prices vary card to card; these are pool averages.
          </p>
        </div>
      </EarnBox>

      <NextRow>
        <PillButton type="button" className="stage-next" onClick={onNext}>
          {paidCreate
            ? <>Continue <LuCircleArrowRight /></>
            : <>Start <span className="cost">−{fmtT26(createCost)} /t26</span> <LuCircleArrowRight /></>}
        </PillButton>
      </NextRow>
    </Wrap>
  );
};

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  font-size: 12px;
  line-height: 1.5;
`;

const Block = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const BlockTitle = styled.div`
  font-size: 13px;
  color: var(--gold-bright);
`;

// The rolled rarity, front and centre — the number the gamble is about. The
// score + tier name take the tier's colour (the same --tier ramp the card show
// page uses), so the rarity reads the same in both places.
const Roll = styled.div`
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 2px 0 2px;
  .score {
    font-family: var(--font-mono);
    font-size: 24px;
    font-weight: 700;
    color: var(--tier, var(--gold-bright));
    font-variant-numeric: tabular-nums;
  }
  .tier { font-size: 12px; color: var(--tier, var(--amber-dim)); }
`;

const RollRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 4px;
  align-items: center;
  flex-wrap: wrap;

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .cost { font-size: 11px; font-weight: 600; opacity: 0.8; }
`;

// "Learn more" disclosure — same shape as the About box on the card show page.
const EarnBox = styled.details`
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel);

  summary {
    cursor: pointer;
    padding: 10px 12px;
    color: var(--gold-bright);
    font-size: 13px;
    list-style: none;
  }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: '▸ '; color: var(--amber-dim); }
  &[open] summary::before { content: '▾ '; }

  .body {
    padding: 0 12px 12px;
    color: var(--amber-text);
    p { margin: 0 0 8px; }
    b { color: var(--gold-bright); }
    .fine { color: var(--amber-dim); font-size: 11px; }
  }
`;

const EarnTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin: 4px 0 10px;
  font-variant-numeric: tabular-nums;

  th, td {
    text-align: left;
    padding: 4px 8px 4px 0;
    border-bottom: 1px solid var(--panel-border);
  }
  th { color: var(--amber-dim); font-weight: 400; font-size: 11px; }
  td:last-child { color: var(--gold-bright); }
`;

const NextRow = styled.div`
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;

  .stage-next {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .stage-next .cost { font-size: 11px; font-weight: 600; opacity: 0.85; }
  .stage-next svg { font-size: 15px; }
`;

export default StartStage;
