import styled from 'styled-components';
import { LuCircleArrowRight } from 'react-icons/lu';
import { Select, PillButton, Dim } from '../UI';
import { fmtT26 } from '../../utils/economyRandom';

// Stage 1 of the customizer: the roll. Every card starts as a rolled base —
// a random background + the fixed signature image + default holo + a rolled
// rarity. Regenerate rerolls the background and the rarity (the signature and
// holo stay). Start commits to the card (costs /t26) and moves into design; you
// can also start from a saved set — that swaps the design in without touching
// the rolled rarity.
const StartStage = ({
  rarity,
  tierName,
  rolls,
  regenCost,
  createCost,
  onRegenerate,
  presets,
  selectedPresetId,
  onLoadPreset,
  onDeletePreset,
  onNext
}) => (
  <Wrap className="start-stage">
    <Block>
      <BlockTitle>Randomly generated Rarity Value:</BlockTitle>
      <Roll>
        <span className="label"><Dim>Rarity Value:</Dim></span>
        <span className="score">{(rarity ?? 0).toFixed(3)}</span>
        {tierName && <span className="tier"><Dim>{tierName}</Dim></span>}
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
    </Block>

    <Block>
      <BlockTitle>Start from a saved set</BlockTitle>
      <Dim>
        Load one of your base sets to build on — this swaps the design in, but
        never changes your rolled rarity.
      </Dim>
      <StartFromRow>
        <Select
          className="preset-select"
          value={selectedPresetId}
          onChange={(e) => onLoadPreset(e.target.value)}
        >
          <option value="">Load a set…</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        {selectedPresetId && (
          <PillButton
            $secondary
            type="button"
            className="preset-delete"
            onClick={onDeletePreset}
            title="Delete this set"
          >✕</PillButton>
        )}
      </StartFromRow>
      {presets.length === 0 && (
        <Dim style={{ fontStyle: 'italic' }}>
          No sets yet — they appear here once you save a design at the publish step.
        </Dim>
      )}
    </Block>

    <NextRow>
      <PillButton type="button" className="stage-next" onClick={onNext}>
        Start <span className="cost">−{fmtT26(createCost)} /t26</span> <LuCircleArrowRight />
      </PillButton>
    </NextRow>
  </Wrap>
);

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

// The rolled rarity, front and centre — the number the gamble is about.
const Roll = styled.div`
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 2px 0 2px;
  .score {
    font-family: var(--font-mono);
    font-size: 24px;
    font-weight: 700;
    color: var(--gold-bright);
    font-variant-numeric: tabular-nums;
  }
  .tier { font-size: 12px; }
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

const StartFromRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 4px;
  align-items: center;

  .preset-select { flex: 1; }
  button { white-space: nowrap; }
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
