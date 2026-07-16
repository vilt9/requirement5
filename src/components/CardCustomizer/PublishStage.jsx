import styled from 'styled-components';
import PublishPanel from '../PublishPanel';
import { TagInput, TextInput, PillButton, Dim } from '../UI';

// Stage 3 of the customizer: the finishing moves. Tag the card, publish it to
// the pool, and optionally keep the design as a reusable set.
const PublishStage = ({
  customCard,
  draftId,
  onPublished,
  onTagsChange,
  presetName,
  onPresetNameChange,
  includeImages,
  onIncludeImagesChange,
  onSavePreset,
  feedback
}) => (
  <Wrap className="publish-stage">
    <Block className="tag-section">
      <BlockTitle>Tags</BlockTitle>
      <Dim>Saved with the card; shown across the pool and your collection.</Dim>
      <TagInput value={customCard?.tags || []} onChange={onTagsChange} />
    </Block>

    <PublishPanel customCard={customCard} draftId={draftId} onPublished={onPublished} />

    <Block>
      <BlockTitle>Keep this design as a base template</BlockTitle>
      <Dim>A base template stores the design — colours, effects, background, tags — as a starting point for future cards. It lives on this device, and is separate from the set you publish a card into.</Dim>
      <TemplateRow>
        <TextInput
          className="preset-name"
          placeholder="name this template"
          value={presetName}
          onChange={(e) => onPresetNameChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSavePreset(); }}
        />
        <ImgToggle title="Also store the base & holo images in this template">
          <input
            type="checkbox"
            checked={includeImages}
            onChange={(e) => onIncludeImagesChange(e.target.checked)}
          />
          include images
        </ImgToggle>
        <PillButton $secondary type="button" className="preset-save" onClick={onSavePreset}>
          Save set
        </PillButton>
      </TemplateRow>
      {feedback && <Dim className="customizer-feedback">{feedback}</Dim>}
    </Block>
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

const TemplateRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;

  .preset-name { flex: 1; min-width: 140px; }
  .preset-save { white-space: nowrap; }
`;

const ImgToggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  font-size: 11px;
  color: var(--amber-text);
  cursor: pointer;

  input { accent-color: var(--gold); cursor: pointer; }
`;

export default PublishStage;
