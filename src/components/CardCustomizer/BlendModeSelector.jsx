import React from 'react';
import styled from 'styled-components';
import Tooltip from './Tooltip';

const BlendModeSelector = ({
  label,
  param,
  value,
  onChange,
  tooltipContent
}) => {
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
      <LabelRow>
        <SelectorLabel>{label}</SelectorLabel>
        {tooltipContent && <Tooltip content={tooltipContent} />}
      </LabelRow>
      <SelectDropdown value={value} onChange={handleChange}>
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
  margin-bottom: 4px;
`;

const SelectDropdown = styled.select`
  background: var(--field-bg);
  border: 1px solid var(--panel-border);
  padding: 6px 8px;
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

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 4px;
`;

export default BlendModeSelector;
