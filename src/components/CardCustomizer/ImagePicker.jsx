import { useRef, useState } from 'react';
import styled from 'styled-components';
import { Dim } from '../UI';

// One upload slot + the reusable library, scoped to a single image role so
// it's always clear which image you're working on: the Image tab hosts the
// base artwork, the Holographic tab hosts the holo overlay. The library of
// historical uploads stays collapsed until popped open, and applies images
// to this tab's slot with one tap.
const ImagePicker = ({
  slot,                // 'main' | 'holo'
  label,               // 'base image' | 'holo image'
  note,
  preview,
  onFileChange,
  onUseLibraryImage,   // (dataUrl)
  imageLibrary,
  onRemoveLibraryImage
}) => {
  const inputRef = useRef(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  return (
    <Wrap className={`image-picker image-picker-${slot}`}>
      <SlotRow>
        <Slot
          type="button"
          className={`upload-slot-${slot}`}
          onClick={() => inputRef.current?.click()}
          $filled={!!preview}
        >
          {preview
            ? <img src={preview} alt={label} />
            : <span className="empty">+<br />{label}</span>}
          <span className="slot-label">{slot === 'holo' ? 'holo' : 'base'}</span>
        </Slot>
        <SlotNote>
          <Dim>{note}</Dim>
        </SlotNote>
        <input
          ref={inputRef}
          id={`${slot}-image-upload`}
          type="file"
          accept="image/*"
          onChange={onFileChange}
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
              <Dim>Everything you upload, reusable across cards — tap one to use it as the {label}.</Dim>
              <LibraryGrid className="image-library">
                {imageLibrary.map((img) => (
                  <LibraryItem key={img.id} className="library-item">
                    <button
                      type="button"
                      className="use"
                      title={`Use as ${label}`}
                      onClick={() => onUseLibraryImage(img.dataUrl)}
                    >
                      <img src={img.dataUrl} alt="library" loading="lazy" />
                    </button>
                    <button
                      type="button"
                      className="rm"
                      title="Remove from library"
                      onClick={() => onRemoveLibraryImage(img.id)}
                    >×</button>
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

  .use {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }
  .use img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: opacity 0.15s;
  }
  .use:hover img { opacity: 0.7; }

  .rm {
    position: absolute;
    top: 2px;
    right: 2px;
    padding: 0 5px;
    font-family: var(--font-mono);
    font-size: 10px;
    border-radius: 8px;
    border: 1px solid var(--panel-border);
    background: rgba(0, 0, 0, 0.65);
    color: var(--amber-text);
    cursor: pointer;
    &:hover { border-color: var(--gold); color: var(--white); }
  }
`;

export default ImagePicker;
