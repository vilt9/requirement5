import React from 'react';
import styled from 'styled-components';
import ControlSection from './ControlSection';
import ParameterControl from './ParameterControl';
import { Dim } from '../UI';

// Card-wide sheen: the few holo-adjacent knobs that sit ABOVE the five
// techniques and apply to the whole card no matter which are on — the
// rarity-driven base shimmer, the shine sweep over the artwork, and the
// chromatic aberration. Anything technique-specific lives with its technique.
const HoloEffectControls = ({
  customCard,
  handleParamChange,
  className
}) => {
  if (!customCard) return null;

  // Nullish coalescing so a legitimate 0 isn't swallowed by the default.
  const effectParams = customCard.effectParams || {};
  const shineIntensity = effectParams.shineIntensity ?? 0.8;
  const aberrationIntensity = effectParams.aberrationIntensity ?? 0.5;
  const holoAngle = effectParams.holoAngle ?? 45;

  return (
    <ControlSection title="Card Sheen" className={className}>
      <Dim style={{ fontSize: 11, lineHeight: 1.5, display: 'block', marginBottom: 12 }}>
        These apply to the whole card, on top of whichever holographic
        systems are on.
      </Dim>
      <SheenGrid>
        <ParameterControl
          label="Rarity (Base Shimmer)"
          param="rarity"
          value={customCard.rarity ?? 0.5}
          min={0}
          max={1}
          step={0.01}
          onChange={handleParamChange}
          tooltipContent="The card's base shimmer. Higher values (0.8+) make every holographic layer more pronounced; when no system is toggled, this alone picks a subtle default shine."
        />

        <ParameterControl
          label="Shine Intensity"
          param="effectParams.shineIntensity"
          value={shineIntensity}
          min={0}
          max={1}
          step={0.01}
          onChange={handleParamChange}
          tooltipContent="How bright the light sweep over the artwork is as the card moves."
        />

        <ParameterControl
          label="Aberration Intensity"
          param="effectParams.aberrationIntensity"
          value={aberrationIntensity}
          min={0}
          max={1}
          step={0.01}
          onChange={handleParamChange}
          tooltipContent="Chromatic aberration — rainbow-like color separation around edges. Higher is more dramatic."
        />

        <ParameterControl
          label="Sheen Angle (°)"
          param="effectParams.holoAngle"
          value={holoAngle}
          min={0}
          max={360}
          step={1}
          onChange={handleParamChange}
          tooltipContent="The direction light reflects across the card as it tilts."
        />
      </SheenGrid>
    </ControlSection>
  );
};

const SheenGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;

  @media (min-width: 500px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export default HoloEffectControls;
