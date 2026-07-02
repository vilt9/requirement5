import { useRef, useState } from 'react';
import styled from 'styled-components';
import { Dim } from '../UI';

// Image slots + the reusable library, at the top of the Design stage's Image
// tab — people tweak images constantly, so they live with the other image
// controls rather than behind a stage switch. The library of historical
// uploads stays collapsed until popped open, so it never crowds the sliders.
const ImagePicker = ({
  mainImagePreview,
  holoImagePreview,
  onMainImageChange,
  onHoloImageChange,
  onUseLibraryImage,   // (dataUrl, slot: 'main' | 'holo')
  imageLibrary,
  onRemoveLibraryImage
}) => {
  const mainInputRef = useRef(null);
  const holoInputRef = useRef(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  return (
    <Wrap className="image-picker">
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
        <SlotNote>
          <Dim>The base image is the card's artwork; the holo image (optional) becomes the holographic overlay.</Dim>
        </SlotNote>
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

      {imageLibrary.length > 0 && (
        <LibraryBlock>
          <LibraryToggle
            type="button"
            className="library-toggle"
            onClick={() => setLibraryOpen(!libraryOpen)}
          >
            {libraryOpen ? '▾' : '▸'} image library ({imageLibrary.length})
          </LibraryToggle>
          {libraryOpen && (
            <>
              <Dim>Everything you upload, reusable across cards — pick an image to use it as base or holo.</Dim>
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
            </>
          )}
        </LibraryBlock>
      )}
    </Wrap>
  );
};

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--panel-border);
  font-size: 11px;
  line-height: 1.5;
`;

const SlotRow = styled.div`
  display: flex;
  gap: 10px;
  align-items: stretch;
`;

const SlotNote = styled.div`
  flex: 1;
  align-self: center;
`;

const Slot = styled.button`
  position: relative;
  width: 86px;
  height: 110px;
  flex-shrink: 0;
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
    font-size: 10px;
    line-height: 1.6;
  }
  .slot-label {
    position: absolute;
    left: 5px;
    bottom: 5px;
    font-family: var(--font-mono);
    font-size: 9px;
    padding: 2px 5px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.65);
    color: var(--amber-text);
  }
`;

const LibraryBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const LibraryToggle = styled.button`
  align-self: flex-start;
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 4px 0;
  border: none;
  background: none;
  color: var(--gold-bright);
  cursor: pointer;
  &:hover { color: var(--white); }
`;

const LibraryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  gap: 6px;
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
    gap: 3px;
    background: rgba(0, 0, 0, 0.72);
    opacity: 0;
    transition: opacity 0.15s;
  }
  &:hover .actions { opacity: 1; }

  /* Touch screens have no hover — keep the actions visible, lighter. */
  @media (hover: none) {
    .actions { opacity: 1; background: rgba(0, 0, 0, 0.45); }
  }

  .actions button {
    font-family: var(--font-mono);
    font-size: 9px;
    padding: 2px 5px;
    border-radius: 8px;
    border: 1px solid var(--panel-border);
    background: var(--field-bg);
    color: var(--amber-text);
    cursor: pointer;
    &:hover { border-color: var(--gold); color: var(--white); }
  }
  .actions .rm {
    position: absolute;
    top: 2px;
    right: 2px;
    padding: 0px 5px;
  }
`;

export default ImagePicker;
