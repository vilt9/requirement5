import { useRef, useState } from 'react';
import styled from 'styled-components';

// The one image selector used by every holo technique: a small slot that
// uploads on tap, a pop-open view of the shared image library, and a clear
// button. Identical everywhere, so picking an image for the overlay feels
// the same as picking a texture for any of the four systems.
const HoloImageInput = ({
  id,
  label,
  value,            // current image url (or null)
  onSelect,         // (dataUrl | url) — set the image
  onClear,          // () — remove the image
  imageLibrary
}) => {
  const inputRef = useRef(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => onSelect(reader.result);
    reader.readAsDataURL(file);
    e.target.value = ''; // same file can be re-picked later
  };

  return (
    <Wrap className="holo-image-input">
      <TopRow>
        <Slot type="button" onClick={() => inputRef.current?.click()} $filled={!!value}>
          {value
            ? <img src={value} alt={label} />
            : <span className="empty">+</span>}
        </Slot>
        <Meta>
          <span className="label">{label}</span>
          <Buttons>
            {imageLibrary?.length > 0 && (
              <button
                type="button"
                className="library-toggle"
                onClick={() => setLibraryOpen(!libraryOpen)}
              >
                {libraryOpen ? '▾' : '▸'} library ({imageLibrary.length})
              </button>
            )}
            {value && (
              <button type="button" className="clear" onClick={onClear}>
                remove
              </button>
            )}
          </Buttons>
        </Meta>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </TopRow>

      {libraryOpen && imageLibrary?.length > 0 && (
        <LibraryGrid className="image-library">
          {imageLibrary.map((img) => (
            <LibraryItem
              key={img.id}
              type="button"
              className="library-item"
              title={`Use as ${label}`}
              onClick={() => { onSelect(img.dataUrl); setLibraryOpen(false); }}
            >
              <img src={img.dataUrl} alt="library" loading="lazy" />
            </LibraryItem>
          ))}
        </LibraryGrid>
      )}
    </Wrap>
  );
};

const Wrap = styled.div`
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Slot = styled.button`
  width: 44px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 4px;
  border: 1px ${p => (p.$filled ? 'solid var(--panel-border)' : 'dashed var(--amber-dim)')};
  background: var(--field-bg);
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  transition: border-color 0.15s;

  &:hover { border-color: var(--gold); }
  img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .empty { color: var(--amber-dim); font-family: var(--font-mono); font-size: 14px; }
`;

const Meta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;

  .label {
    font-family: var(--font-mono);
    color: var(--amber-text);
  }
`;

const Buttons = styled.div`
  display: flex;
  gap: 10px;

  button {
    font-family: var(--font-mono);
    font-size: 10px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }
  .library-toggle { color: var(--gold-bright); &:hover { color: var(--white); } }
  .clear { color: var(--amber-dim); &:hover { color: #ff8a8a; } }
`;

const LibraryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 5px;
`;

const LibraryItem = styled.button`
  aspect-ratio: 1;
  padding: 0;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--panel-border);
  background: none;
  cursor: pointer;

  img { width: 100%; height: 100%; object-fit: cover; display: block; transition: opacity 0.15s; }
  &:hover { border-color: var(--gold); }
  &:hover img { opacity: 0.7; }
`;

export default HoloImageInput;
