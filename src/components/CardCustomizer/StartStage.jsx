import styled from 'styled-components';
import { Select, PillButton, Dim } from '../UI';

// Stage 1 of the customizer: pick the base design to build on — a saved set
// (your reusable design defaults) or a freshly rolled design. Images are part
// of designing and live in the Design stage.
const StartStage = ({
  presets,
  selectedPresetId,
  onLoadPreset,
  onDeletePreset,
  onRandomizeDesign,
  onNext
}) => (
  <Wrap className="start-stage">
    <Block>
      <BlockTitle>Base design</BlockTitle>
      <Dim>
        Every card builds on a base design — the colours, background, effects and
        default tags. Load one of your saved sets, or roll a fresh design to react to.
        You can save the design you end up with as a new set at the publish step.
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
        <PillButton $secondary type="button" onClick={onRandomizeDesign}>
          Random design
        </PillButton>
      </StartFromRow>
      {presets.length === 0 && (
        <Dim style={{ fontStyle: 'italic' }}>
          No sets yet — they appear here once you save a design at the publish step.
        </Dim>
      )}
    </Block>

    <NextRow>
      <PillButton type="button" className="stage-next" onClick={onNext}>
        Next: design →
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
`;

export default StartStage;
