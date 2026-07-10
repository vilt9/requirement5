// The design language (after midjourney.com/medical). JetBrains Mono body in
// warm amber on black, DM Sans for headings, gold for accents and the primary
// action. One panel style, one divider. Palette tokens come from :root in App.jsx.
// If you can see one panel and one button, you know the whole system.
import { useState } from 'react';
import styled from 'styled-components';
import { parseTags, formatTag } from '../utils/tags';

export const Page = styled.div`
  max-width: 880px;
  margin: 20px auto 80px;
  padding: 0 15px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const Panel = styled.div`
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 12px;
`;

export const Row = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  & > * { flex: 1; min-width: 220px; }
`;

export const Divider = styled.hr`
  border: none;
  border-top: 1px solid var(--panel-border);
  margin: 10px 0;
`;

export const PillButton = styled.button`
  background: ${props => (props.$secondary ? 'transparent' : 'var(--gold)')};
  color: ${props => (props.$secondary ? 'var(--gold-bright)' : '#140d03')};
  border: 1px solid ${props => (props.$secondary ? 'var(--panel-border)' : 'var(--gold)')};
  padding: 8px 16px;
  border-radius: 20px;
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    background: ${props => (props.$secondary ? 'var(--panel-hover)' : 'var(--gold-bright)')};
    color: ${props => (props.$secondary ? 'var(--white)' : '#140d03')};
    border-color: ${props => (props.$secondary ? 'var(--gold-bright)' : 'var(--gold-bright)')};
  }
  &:disabled {
    background: transparent;
    color: var(--amber-dim);
    border-color: var(--panel-border);
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

export const TextInput = styled.input`
  background: var(--field-bg);
  color: var(--amber-text);
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  padding: 7px 9px;
  font-family: var(--font-mono);
  font-size: 12px;
  width: 100%;
  &::placeholder { color: var(--amber-dim); }
  &:focus { outline: none; border-color: var(--gold); }
`;

export const Select = styled.select`
  background: var(--field-bg);
  color: var(--amber-text);
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  padding: 7px 9px;
  font-family: var(--font-mono);
  font-size: 12px;
  width: 100%;
  &:focus { outline: none; border-color: var(--gold); }
  option { background: #1a1510; }
`;

export const Dim = styled.span`
  color: var(--amber-dim);
`;

export const ErrorText = styled.div`
  color: #ff6b6b;
`;

// A single statistic line: "Key: value"
export const Kv = ({ k, children }) => (
  <div>{k}: {children}</div>
);

// Rarity band: name, proportional bar, odds — colors appear here and nowhere else.
const BandLine = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 0;
  .name { width: 12ch; flex-shrink: 0; }
  .band { flex: 1; height: 8px; background: #222; border-radius: 4px; overflow: hidden; }
  .band i { display: block; height: 100%; border-radius: 4px; }
  .odds { width: 12ch; text-align: right; flex-shrink: 0; }
`;

// Bars carry weight by width alone — the per-tier colours were dropped because
// the colour→rarity code confused people; one neutral gold reads as "a bar".
export const BandRow = ({ name, width, odds, right }) => (
  <BandLine>
    <span className="name">{name}</span>
    <span className="band"><i style={{ width, background: 'var(--gold)' }} /></span>
    <span className="odds">{right ?? odds}</span>
  </BandLine>
);

// Standard widths so the bands read as relative weight, not raw probability
// (raw probabilities would render every rare tier at < 5px).
export const BAND_WIDTHS = {
  vmax: '2%', ultra: '6%', wowa: '12%', galaxy: '22%', holo: '45%', common: '100%'
};

export const RarityBands = ({ config, counts }) => {
  if (!config?.tiers) return null;
  return (
    <div>
      {config.tiers.map(tier => (
        <BandRow
          key={tier.key}
          name={tier.name}
          width={BAND_WIDTHS[tier.key] || '100%'}
          right={
            counts
              ? `${counts[tier.key] ?? 0} cards`
              : (tier.odds ? `1 : ${tier.odds.toLocaleString()}` : 'remainder')
          }
        />
      ))}
    </div>
  );
};

// Tags. One chip style used everywhere — display, editable (with ×), and clickable
// filter (gold when active). Tag strings are always the normalized form.
const Chip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 12px;
  border: 1px solid ${p => (p.$active ? 'var(--gold)' : 'var(--panel-border)')};
  background: ${p => (p.$active ? 'var(--gold)' : 'var(--field-bg)')};
  color: ${p => (p.$active ? '#140d03' : 'var(--amber-text)')};
  cursor: ${p => (p.$clickable ? 'pointer' : 'default')};
  transition: color 0.15s, background 0.15s, border-color 0.15s;

  &:hover {
    ${p => (p.$clickable && !p.$active ? 'border-color: var(--gold); color: var(--white);' : '')}
  }

  .x {
    font-size: 12px;
    line-height: 1;
    opacity: 0.7;
  }
  .x:hover { opacity: 1; }
`;

export const TagChip = ({ tag, active, onClick, onRemove }) => (
  <Chip
    type="button"
    as={onClick || onRemove ? 'button' : 'span'}
    $active={active}
    $clickable={!!onClick}
    onClick={onClick ? () => onClick(tag) : undefined}
  >
    {formatTag(tag)}
    {onRemove && (
      <span
        className="x"
        onClick={(e) => { e.stopPropagation(); onRemove(tag); }}
        role="button"
        aria-label={`remove ${tag}`}
      >×</span>
    )}
  </Chip>
);

const ChipWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
`;

// Render a list of tags. Pass onTagClick to make them filters, onRemove to make them
// editable. activeTag highlights the current filter.
export const TagList = ({ tags, onTagClick, onRemove, activeTag, empty = null }) => {
  const list = Array.isArray(tags) ? tags : [];
  if (!list.length) return empty;
  return (
    <ChipWrap>
      {list.map(tag => (
        <TagChip
          key={tag}
          tag={tag}
          active={activeTag === tag}
          onClick={onTagClick}
          onRemove={onRemove}
        />
      ))}
    </ChipWrap>
  );
};

// Editable tag field: chips above, a text box below. Commits on Enter or comma.
// `value` is the current tag array; `onChange` receives the new array.
export const TagInput = ({ value = [], onChange, placeholder = 'add tags (press enter)' }) => {
  const [text, setText] = useState('');
  const tags = Array.isArray(value) ? value : [];

  const commit = (raw) => {
    const next = parseTags([...tags, ...parseTags(raw)]);
    onChange(next);
    setText('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (text.trim()) commit(text);
    } else if (e.key === 'Backspace' && !text && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };

  const remove = (tag) => onChange(tags.filter(t => t !== tag));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {tags.length > 0 && <TagList tags={tags} onRemove={remove} />}
      <TextInput
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => { if (text.trim()) commit(text); }}
      />
    </div>
  );
};
