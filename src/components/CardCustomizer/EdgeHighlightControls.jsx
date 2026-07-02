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
        label="Edge Glow Color"
        param="borderEffects.edgeColor1"
        value={customCard.borderEffects.edgeColor1 || 'rgba(255, 255, 255, 0.5)'}
        onChange={handleParamChange}
        description="The glowing line that sweeps around the card's edge as it tilts."
      />
      <ColorPicker
        label="Edge Fade Color"
        param="borderEffects.edgeColor2"
        value={customCard.borderEffects.edgeColor2 || 'rgba(0, 0, 0, 0)'}
        onChange={handleParamChange}
        description="What the glow fades into — keep it transparent for a clean fade."
      />
    </ControlSection>
  );
};

export default EdgeHighlightControls;
