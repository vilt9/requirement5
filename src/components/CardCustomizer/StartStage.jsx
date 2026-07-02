import { useRef } from 'react';
import styled from 'styled-components';
import { Select, PillButton, Dim } from '../UI';

// Stage 1 of the customizer: where a card starts. Images first (that's how
// cards begin), then the reusable image library, then design starting points
// (saved sets / a fresh random design).
const StartStage = ({
  mainImagePreview,
  holoImagePreview,
  onMainImageChange,
  onHoloImageChange,
  onUseLibraryImage,   // (dataUrl, slot: 'main' | 'holo')
  imageLibrary,
  onRemoveLibraryImage,
  presets,
  selectedPresetId,
  onLoadPreset,
  onDeletePreset,
  onRandomizeDesign,
  onNext
}) => {
  const mainInputRef = useRef(null);
  const holoInputRef = useRef(null);

  return (
    <Wrap className="start-stage">
      <Block>
        <BlockTitle>Images</BlockTitle>
        <Dim>A card starts with its artwork. The holo image is optional — it becomes the holographic overlay.</Dim>
        <SlotRow>
          <Slot
            type="button"
            className="upload-slot-main"
            onClick={() => mainInputRef.current?.click()}
            $filled={!!mainImagePreview}
          >
            {mainImagePreview
              ? <img src={mainImagePreview} alt="base" />
              : <span className="empty">+<br />base image</span>}
            <span className="slot-label">base</span>
          </Slot>
          <Slot
            type="button"
            className="upload-slot-holo"
            onClick={() => holoInputRef.current?.click()}
            $filled={!!holoImagePreview}
          >
            {holoImagePreview
              ? <img src={holoImagePreview} alt="holo" />
              : <span className="empty">+<br />holo image</span>}
            <span className="slot-label">holo</span>
          </Slot>
          <input
            ref={mainInputRef}
            id="main-image-upload"
            type="file"
            accept="image/*"
            onChange={onMainImageChange}
            style={{ display: 'none' }}
          />
          <input
            ref={holoInputRef}
            id="holo-image-upload"
            type="file"
            accept="image/*"
            onChange={onHoloImageChange}
            style={{ display: 'none' }}
          />
        </SlotRow>
      </Block>

      <Block>
        <BlockTitle>Your image library</BlockTitle>
        <Dim>Everything you upload is kept here to reuse — e.g. one holo texture across a whole set of cards.</Dim>
        {imageLibrary.length === 0 ? (
          <Dim style={{ fontStyle: 'italic' }}>Nothing yet — images appear here after your first upload.</Dim>
        ) : (
          <LibraryGrid className="image-library">
            {imageLibrary.map((img) => (
              <LibraryItem key={img.id} className="library-item">
                <img src={img.dataUrl} alt="library" loading="lazy" />
                <div className="actions">
                  <button type="button" title="Use as base image" onClick={() => onUseLibraryImage(img.dataUrl, 'main')}>base</button>
                  <button type="button" title="Use as holo image" onClick={() => onUseLibraryImage(img.dataUrl, 'holo')}>holo</button>
                  <button type="button" className="rm" title="Remove from library" onClick={() => onRemoveLibraryImage(img.id)}>×</button>
                </div>
              </LibraryItem>
            ))}
          </LibraryGrid>
        )}
      </Block>

      <Block>
        <BlockTitle>Design starting point</BlockTitle>
        <Dim>Load a saved set (your reusable design defaults), or roll a fresh design. Either keeps your images.</Dim>
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
      </Block>

      <NextRow>
        <PillButton type="button" className="stage-next" onClick={onNext}>
          Next: design →
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

const SlotRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 4px;
`;

const Slot = styled.button`
  position: relative;
  width: 110px;
  height: 140px;
  border-radius: 6px;
  border: 1px ${p => (p.$filled ? 'solid var(--panel-border)' : 'dashed var(--amber-dim)')};
  background: var(--field-bg);
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  transition: border-color 0.15s;

  &:hover { border-color: var(--gold); }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .empty {
    color: var(--amber-dim);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.6;
  }
  .slot-label {
    position: absolute;
    left: 6px;
    bottom: 6px;
    font-family: var(--font-mono);
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.65);
    color: var(--amber-text);
  }
`;

const LibraryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 8px;
  margin-top: 4px;
`;

const LibraryItem = styled.div`
  position: relative;
  aspect-ratio: 1;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--panel-border);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .actions {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: rgba(0, 0, 0, 0.72);
    opacity: 0;
    transition: opacity 0.15s;
  }
  &:hover .actions { opacity: 1; }

  .actions button {
    font-family: var(--font-mono);
    font-size: 10px;
    padding: 3px 7px;
    border-radius: 10px;
    border: 1px solid var(--panel-border);
    background: var(--field-bg);
    color: var(--amber-text);
    cursor: pointer;
    &:hover { border-color: var(--gold); color: var(--white); }
  }
  .actions .rm {
    position: absolute;
    top: 3px;
    right: 3px;
    padding: 1px 6px;
    border-radius: 8px;
  }
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
