import React from 'react';
import styled from 'styled-components';

const ToggleSwitch = ({ label, param, checked, onChange, tooltipContent, description, className }) => {
  const desc = description || tooltipContent;
  const handleChange = (e) => {
    // Ensure we pass the correct parameter structure back to the handler
    onChange(param, e.target.checked, false); // isNumeric = false
  };

  // The whole row is the <label>, so tapping the text (or anywhere in the row)
  // flips the switch — the visible control alone is too small a target.
  return (
    <ToggleGroup className={className}>
      <TextCol>
        <ToggleLabel className="toggle-name">{label}</ToggleLabel>
        {desc && <Description>{desc}</Description>}
      </TextCol>
      <Switch>
        <input
          type="checkbox"
          data-param={param}
          aria-label={label}
          checked={checked}
          onChange={handleChange}
        />
        <Slider />
      </Switch>
    </ToggleGroup>
  );
};

const ToggleGroup = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 0;
  min-height: 44px;
  cursor: pointer;
`;

const TextCol = styled.span`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const ToggleLabel = styled.span`
  font-size: 11px;
  color: var(--amber-text);
  font-family: var(--font-mono);
`;

const Description = styled.span`
  font-size: 10px;
  line-height: 1.45;
  color: var(--amber-dim);
`;

const Switch = styled.span`
  position: relative;
  display: inline-block;
  flex-shrink: 0;
  width: 46px;
  height: 26px;

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
  transition: .3s;
  border-radius: 26px;
  border: 1px solid #555;

  &:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .3s;
    border-radius: 50%;
  }

  input:checked + & {
    background-color: var(--gold);
    border-color: var(--gold);
  }

  input:checked + &:before {
    transform: translateX(20px);
  }
`;

export default ToggleSwitch;
