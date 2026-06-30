import React from 'react';
import styled from 'styled-components';
import ControlSection from './ControlSection';
import ParameterControl from './ParameterControl';
import ColorPicker from './ColorPicker';
import ToggleSwitch from './ToggleSwitch';

const CentralPanelControls = ({ customCard, handleParamChange }) => {
  if (!customCard || !customCard.borderEffects) return null;

  const {
    thickBorderEnabled = false,
    borderImageEnabled = true,
    color = 'rgb(255, 215, 0)',
    opacity = 0.2,
    colorHover = color, // Default to base color
    opacityHover = opacity, // Default to base opacity
    imageOpacity = 0.7,
  } = customCard.borderEffects;

  const handleColorChange = (param, rgbaColor) => {
    // Strip the alpha channel to make opacity slider the single source of truth
    const rgbColor = rgbaColor.replace(/rgba/g, 'rgb').replace(/,\s*\d(\.\d+)?\)/g, ')');
    handleParamChange(param, rgbColor, false);
  };

  return (
    <ControlSection title="Central Panel" className="central-panel-controls">
      <ToggleSwitch
        label="Enable Panel"
        param="borderEffects.thickBorderEnabled"
        checked={thickBorderEnabled}
        onChange={handleParamChange}
        tooltipContent="Toggles the visibility of the central panel."
        className="central-panel-toggle"
      />
      
      {thickBorderEnabled && (
        <ControlsGrid className="central-panel-grid">
          <ColorPicker
            label="Panel Color"
            param="borderEffects.color"
            value={color}
            onChange={handleColorChange}
            tooltipContent="Sets the color of the central panel."
            className="central-panel-color"
          />
          <ParameterControl
            label="Panel Opacity"
            param="borderEffects.opacity"
            value={opacity}
            min={0}
            max={1}
            step={0.01}
            onChange={handleParamChange}
            tooltipContent="Controls the transparency of the central panel."
            className="central-panel-opacity"
          />
          <ColorPicker
            label="Panel Color (Hover)"
            param="borderEffects.colorHover"
            value={colorHover}
            onChange={handleColorChange}
            tooltipContent="Sets the color of the panel when you hover over the card."
            className="central-panel-color-hover"
          />
          <ParameterControl
            label="Panel Opacity (Hover)"
            param="borderEffects.opacityHover"
            value={opacityHover}
            min={0}
            max={1}
            step={0.01}
            onChange={handleParamChange}
            tooltipContent="Controls the panel's transparency on hover."
            className="central-panel-opacity-hover"
          />
          <ParameterControl
            label="Transition Duration (s)"
            param="borderEffects.transitionDuration"
            value={customCard.borderEffects.transitionDuration || 0.1}
            min={0}
            max={2}
            step={0.1}
            onChange={handleParamChange}
            tooltipContent="Controls how quickly the hover effects transition."
            className="central-panel-transition-duration"
          />
          <ToggleSwitch
            label="Enable Panel Image"
            param="borderEffects.borderImageEnabled"
            checked={borderImageEnabled}
            onChange={handleParamChange}
            tooltipContent="Toggles the blurred image overlay on top of the panel."
            className="central-panel-image-toggle"
          />
          {borderImageEnabled && (
            <ParameterControl
              label="Panel Image Opacity"
              param="borderEffects.imageOpacity"
              value={imageOpacity}
              min={0}
              max={1}
              step={0.01}
              onChange={handleParamChange}
              tooltipContent="Controls the transparency of the blurred image overlay."
              className="central-panel-image-opacity"
            />
          )}
        </ControlsGrid>
      )}
    </ControlSection>
  );
};

const ControlsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;
  margin-top: 15px;
  
  @media (min-width: 500px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export default CentralPanelControls;
