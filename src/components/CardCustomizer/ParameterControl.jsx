import React from 'react';
import styled from 'styled-components';
import Tooltip from './Tooltip';

const ParameterControl = ({
  label,
  param,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  tooltipContent,
  className
}) => {
  // Keep the inputs controlled at all times: an undefined value (a param field
  // not yet initialised) would flip them to uncontrolled and warn in React.
  const safeValue = Number.isFinite(Number(value)) && value !== '' && value != null ? value : min;

  const handleSliderChange = (e) => {
    onChange(param, e.target.value);
  };

  const handleInputChange = (e) => {
    onChange(param, e.target.value);
  };

  return (
    <ControlGroup className={className}>
      <LabelRow>
        <ControlLabel>{label}</ControlLabel>
        {tooltipContent && <Tooltip content={tooltipContent} />}
      </LabelRow>
      <SliderContainer>
        <Slider
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeValue}
          onChange={handleSliderChange}
        />
        <SliderValue
          type="number"
          min={min}
          max={max}
          step={step}
          value={safeValue}
          onChange={handleInputChange}
        />
      </SliderContainer>
    </ControlGroup>
  );
};

const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const ControlLabel = styled.label`
  font-size: 11px;
  color: var(--amber-text);
  margin-bottom: 4px;
`;

const SliderContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Slider = styled.input`
  flex: 1;
  -webkit-appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.2);
  outline: none;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--gold);
    cursor: pointer;
  }
  
  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--gold);
    cursor: pointer;
    border: none;
  }
`;

const SliderValue = styled.input`
  width: 50px;
  background: var(--field-bg);
  border: 1px solid var(--panel-border);
  padding: 3px 5px;
  border-radius: 3px;
  color: var(--amber-text);
  font-family: var(--font-mono);
  font-size: 10px;
  text-align: center;

  &:focus {
    outline: none;
    border-color: var(--gold);
  }
  
  /* Hide spinner controls */
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  /* Firefox */
  &[type=number] {
    -moz-appearance: textfield;
  }
`;

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 4px;
`;

export default ParameterControl;
