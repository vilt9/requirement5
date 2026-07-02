import React from 'react';
import styled from 'styled-components';
import ControlSection from './ControlSection';
import ParameterControl from './ParameterControl';

// Sliders for the base artwork. Uploads live in the Start stage; this is
// tuning only. Ordered by how obviously each control changes the card:
// opacity (image appears/disappears) → contrast/saturation → parallax →
// hover-only opacity last.
const ImageEffectControls = ({
  customCard,
  handleParamChange,
  className
}) => {
  if (!customCard) return null;

  // Nullish coalescing (not ||) so a legitimate 0 isn't replaced by the default.
  const imageOpacity = customCard.imageEffects?.opacity ?? 1;
  const imageOpacityHover = customCard.imageEffects?.opacityHover ?? imageOpacity;
  const imageContrast = customCard.imageEffects?.contrast ?? 1;
  const imageSaturation = customCard.imageEffects?.saturation ?? 1;

  return (
    <ControlSection title="Image Effects" className={className}>
      <ImageControlsGrid>
        <ParameterControl
          label="Image Opacity"
          param="imageEffects.opacity"
          value={imageOpacity}
          min={0}
          max={1}
          step={0.01}
          onChange={handleParamChange}
          description="How solid the artwork is — lower it to let the background show through."
        />

        <ParameterControl
          label="Contrast"
          param="imageEffects.contrast"
          value={imageContrast}
          min={0.5}
          max={2}
          step={0.05}
          onChange={handleParamChange}
          description="Deepens the shadows and brightens the highlights of the artwork."
        />

        <ParameterControl
          label="Color Saturation"
          param="imageEffects.saturation"
          value={imageSaturation}
          min={0}
          max={2}
          step={0.05}
          onChange={handleParamChange}
          description="0 turns the artwork black and white; high makes it vivid."
        />

        <ParameterControl
          label="3D Depth"
          param="effectParams.parallaxDepth"
          value={customCard.effectParams?.parallaxDepth ?? 0}
          min={0}
          max={1}
          step={0.01}
          onChange={handleParamChange}
          description="The artwork shifts against the frame as the card tilts, like a window into the scene. 0 is flat."
        />

        <ParameterControl
          label="Opacity While Touched"
          param="imageEffects.opacityHover"
          value={imageOpacityHover}
          min={0}
          max={1}
          step={0.01}
          onChange={handleParamChange}
          description="The artwork's opacity while the card is being touched — set it lower to let the effects flare."
        />
      </ImageControlsGrid>
    </ControlSection>
  );
};

const ImageControlsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;

  @media (min-width: 500px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export default ImageEffectControls;
