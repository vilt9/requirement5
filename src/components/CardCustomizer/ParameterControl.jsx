import React from 'react';
import styled from 'styled-components';

const ParameterControl = ({
  label,
  param,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  tooltipContent,
  description,
  className
}) => {
  // Keep the inputs controlled at all times: an undefined value (a param field
  // not yet initialised) would flip them to uncontrolled and warn in React.
  const safeValue = Number.isFinite(Number(value)) && value !== '' && value != null ? value : min;
  const desc = description || tooltipContent;

  const handleSliderChange = (e) => {
    onChange(param, e.target.value);
  };

  const handleInputChange = (e) => {
    onChange(param, e.target.value);
  };

  return (
    <ControlGroup className={className}>
      <ControlLabel>{label}</ControlLabel>
      {desc && <Description>{desc}</Description>}
      <SliderContainer>
        <Slider
          type="range"
          data-param={param}
          aria-label={`${label} slider`}
          min={min}
          max={max}
          step={step}
          value={safeValue}
          onChange={handleSliderChange}
        />
        <SliderValue
          type="number"
          data-param={param}
          aria-label={`${label} value`}
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
  gap: 3px;
`;

const ControlLabel = styled.label`
  font-size: 11px;
  color: var(--amber-text);
`;

/* Descriptions are always visible (hover tooltips don't exist on touch). */
const Description = styled.span`
  font-size: 10px;
  line-height: 1.45;
  color: var(--amber-dim);
`;

const SliderContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

/* Chunky by design: an 8px track and a 24px thumb are draggable with a thumb,
   not just a mouse. The transparent vertical padding widens the hit area to
   ~32px without changing the visual weight. */
const Slider = styled.input`
  flex: 1;
  -webkit-appearance: none;
  width: 100%;
  height: 32px;
  background: transparent;
  outline: none;
  touch-action: pan-y;

  &::-webkit-slider-runnable-track {
    height: 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.18);
  }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    margin-top: -8px;
    border-radius: 50%;
    background: var(--gold);
    border: 2px solid rgba(0, 0, 0, 0.35);
    cursor: pointer;
  }

  &::-moz-range-track {
    height: 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.18);
  }

  &::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--gold);
    cursor: pointer;
    border: 2px solid rgba(0, 0, 0, 0.35);
  }
`;

const SliderValue = styled.input`
  width: 54px;
  background: var(--field-bg);
  border: 1px solid var(--panel-border);
  padding: 7px 5px;
  border-radius: 4px;
  color: var(--amber-text);
  font-family: var(--font-mono);
  font-size: 11px;
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

export default ParameterControl;
