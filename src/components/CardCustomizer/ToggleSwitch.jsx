import React from 'react';
import styled from 'styled-components';
import Tooltip from './Tooltip';

const ToggleSwitch = ({ label, param, checked, onChange, tooltipContent }) => {
  const handleChange = (e) => {
    // Ensure we pass the correct parameter structure back to the handler
    onChange(param, e.target.checked, false); // isNumeric = false
  };

  return (
    <ToggleGroup>
      <LabelRow>
        <ToggleLabel>{label}</ToggleLabel>
        {tooltipContent && <Tooltip content={tooltipContent} />}
      </LabelRow>
      <Switch>
        <input type="checkbox" checked={checked} onChange={handleChange} />
        <Slider />
      </Switch>
    </ToggleGroup>
  );
};

const ToggleGroup = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0; /* Add some vertical padding */
`;

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const ToggleLabel = styled.label`
  font-size: 11px;
  color: var(--amber-text);
  font-family: var(--font-mono);
`;

const Switch = styled.label`
  position: relative;
  display: inline-block;
  width: 34px;
  height: 20px;

  input {
    opacity: 0;
    width: 0;
    height: 0;
  }
`;

const Slider = styled.span`
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #333;
  transition: .4s;
  border-radius: 20px;
  border: 1px solid #555;

  &:before {
    position: absolute;
    content: "";
    height: 12px;
    width: 12px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
  }

  input:checked + & {
    background-color: var(--gold);
    border-color: var(--gold);
  }

  input:checked + &:before {
    transform: translateX(14px);
  }
`;

export default ToggleSwitch;
