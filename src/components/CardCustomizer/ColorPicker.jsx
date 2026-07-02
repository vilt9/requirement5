import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';
import { SketchPicker } from 'react-color';

const ColorPicker = ({
  label,
  param,
  value,
  onChange,
  tooltipContent,
  description
}) => {
  const desc = description || tooltipContent;
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const swatchRef = useRef(null);

  const handleColorChange = (color) => {
    // Support for rgba values from the picker
    const newColor = `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.rgb.a})`;
    onChange(param, newColor);
  };

  const handleSwatchClick = () => {
    if (swatchRef.current) {
      const rect = swatchRef.current.getBoundingClientRect();
      setPickerPosition({
        top: rect.bottom + window.scrollY + 5, // 5px below the swatch
        left: rect.left + window.scrollX,
      });
    }
    setIsPickerOpen(!isPickerOpen);
  };

  const handleClosePicker = () => {
    setIsPickerOpen(false);
  };

  const picker = (
    <>
      <PickerOverlay onClick={handleClosePicker} />
      <PickerContainer style={{ top: `${pickerPosition.top}px`, left: `${pickerPosition.left}px` }}>
        <SketchPicker
          color={value}
          onChangeComplete={handleColorChange}
        />
      </PickerContainer>
    </>
  );

  return (
    <ColorPickerGroup>
      <ColorPickerLabel>{label}</ColorPickerLabel>
      {desc && <Description>{desc}</Description>}
      <ColorPickerControls>
        <ColorSwatch
          ref={swatchRef}
          style={{ backgroundColor: value }}
          onClick={handleSwatchClick}
        />
        <ColorInput
          type="text"
          value={value}
          onChange={(e) => onChange(param, e.target.value)}
        />
      </ColorPickerControls>

      {isPickerOpen && ReactDOM.createPortal(picker, document.body)}
    </ColorPickerGroup>
  );
};

const ColorPickerGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  position: relative;
`;

const ColorPickerLabel = styled.label`
  font-size: 11px;
  color: var(--amber-text);
`;

const Description = styled.span`
  font-size: 10px;
  line-height: 1.45;
  color: var(--amber-dim);
`;

const ColorPickerControls = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const ColorSwatch = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  cursor: pointer;
  flex-shrink: 0;
`;

const ColorInput = styled.input`
  width: 130px; /* Wider to accommodate rgba values */
  background: var(--field-bg);
  border: 1px solid var(--panel-border);
  padding: 9px 6px;
  border-radius: 4px;
  color: var(--amber-text);
  font-family: var(--font-mono);
  font-size: 11px;

  &:focus {
    outline: none;
    border-color: var(--gold);
  }
`;

const PickerContainer = styled.div`
  position: absolute;
  z-index: 100;
`;

const PickerOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
`;

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 4px;
`;

export default ColorPicker;
