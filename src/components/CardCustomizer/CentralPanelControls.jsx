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
        label="Center Panel"
        param="borderEffects.thickBorderEnabled"
        checked={thickBorderEnabled}
        onChange={handleParamChange}
        description="A tinted panel over the middle of the card, framing the artwork."
        className="central-panel-toggle"
      />
      
      {thickBorderEnabled && (
        <ControlsGrid className="central-panel-grid">
          <ColorPicker
            label="Panel Color"
            param="borderEffects.color"
            value={color}
            onChange={handleColorChange}
            description="The panel's tint while the card rests."
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
            description="How strong the tint is while the card rests."
            className="central-panel-opacity"
          />
          <ColorPicker
            label="Panel Color (Touched)"
            param="borderEffects.colorHover"
            value={colorHover}
            onChange={handleColorChange}
            description="The tint the panel shifts to while the card is touched."
            className="central-panel-color-hover"
          />
          <ParameterControl
            label="Panel Opacity (Touched)"
            param="borderEffects.opacityHover"
            value={opacityHover}
            min={0}
            max={1}
            step={0.01}
            onChange={handleParamChange}
            description="How strong the tint is while the card is touched."
            className="central-panel-opacity-hover"
          />
          <ParameterControl
            label="Touch Fade (s)"
            param="borderEffects.transitionDuration"
            value={customCard.borderEffects.transitionDuration || 0.1}
            min={0}
            max={2}
            step={0.1}
            onChange={handleParamChange}
            description="How many seconds the panel takes to shift between its resting and touched looks."
            className="central-panel-transition-duration"
          />
          <ToggleSwitch
            label="Artwork Wash"
            param="borderEffects.borderImageEnabled"
            checked={borderImageEnabled}
            onChange={handleParamChange}
            description="Lays a blurred copy of the artwork over the panel for a frosted look."
            className="central-panel-image-toggle"
          />
          {borderImageEnabled && (
            <ParameterControl
              label="Wash Opacity"
              param="borderEffects.imageOpacity"
              value={imageOpacity}
              min={0}
              max={1}
              step={0.01}
              onChange={handleParamChange}
              description="How visible the blurred artwork wash is."
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
