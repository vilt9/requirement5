import React from 'react';
import ControlSection from './ControlSection';
import ColorPicker from './ColorPicker';

// Edge highlight colors. Driven by the customizer's local card state (the same
// state the preview renders) — previously this wrote to the global context card,
// so changes never showed in the preview.
const EdgeHighlightControls = ({ customCard, handleParamChange }) => {
  if (!customCard || !customCard.borderEffects) return null;

  return (
    <ControlSection title="Edge Highlight">
      <ColorPicker
        label="Edge Color 1"
        param="borderEffects.edgeColor1"
        value={customCard.borderEffects.edgeColor1 || 'rgba(255, 255, 255, 0.5)'}
        onChange={handleParamChange}
        tooltipContent="The first color of the edge highlight gradient."
      />
      <ColorPicker
        label="Edge Color 2"
        param="borderEffects.edgeColor2"
        value={customCard.borderEffects.edgeColor2 || 'rgba(0, 0, 0, 0)'}
        onChange={handleParamChange}
        tooltipContent="The second color of the edge highlight gradient."
      />
    </ControlSection>
  );
};

export default EdgeHighlightControls;
