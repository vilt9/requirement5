import React from 'react';
import styled from 'styled-components';

const BlendModeSelector = ({
  label,
  param,
  value,
  onChange,
  tooltipContent,
  description
}) => {
  const desc = description || tooltipContent;
  const handleChange = (e) => {
    onChange(param, e.target.value, false);
  };

  const blendModes = [
    'normal',
    'color-dodge',
    'color-burn',
    'soft-light',
    'hard-light',
    'screen',
    'overlay',
    'multiply',
    'difference',
    'exclusion',
    'hue',
    'saturation',
    'color',
    'luminosity'
  ];

  return (
    <SelectorGroup>
      <SelectorLabel>{label}</SelectorLabel>
      {desc && <Description>{desc}</Description>}
      <SelectDropdown data-param={param} aria-label={label} value={value} onChange={handleChange}>
        {blendModes.map((mode) => (
          <option key={mode} value={mode}>
            {mode.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
          </option>
        ))}
      </SelectDropdown>
    </SelectorGroup>
  );
};

const SelectorGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const SelectorLabel = styled.label`
  font-size: 11px;
  color: var(--amber-text);
`;

const Description = styled.span`
  font-size: 10px;
  line-height: 1.45;
  color: var(--amber-dim);
`;

const SelectDropdown = styled.select`
  background: var(--field-bg);
  border: 1px solid var(--panel-border);
  padding: 10px 8px;
  min-height: 40px;
  border-radius: 4px;
  color: var(--amber-text);
  font-family: var(--font-mono);
  font-size: 12px;
  width: 100%;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--gold);
  }

  option {
    background: #1a1510;
    color: var(--amber-text);
    padding: 4px;
  }
`;

export default BlendModeSelector;
