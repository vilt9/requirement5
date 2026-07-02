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
          tooltipContent="Adjusts how visible the main card image is."
        />

        <ParameterControl
          label="Image Contrast"
          param="imageEffects.contrast"
          value={imageContrast}
          min={0.5}
          max={2}
          step={0.05}
          onChange={handleParamChange}
          tooltipContent="Enhances or reduces the difference between light and dark areas."
        />

        <ParameterControl
          label="Image Saturation"
          param="imageEffects.saturation"
          value={imageSaturation}
          min={0}
          max={2}
          step={0.05}
          onChange={handleParamChange}
          tooltipContent="Controls the intensity of colors in your image."
        />

        <ParameterControl
          label="Parallax Depth"
          param="effectParams.parallaxDepth"
          value={customCard.effectParams?.parallaxDepth ?? 0}
          min={0}
          max={1}
          step={0.01}
          onChange={handleParamChange}
          tooltipContent="Gives the card a sense of 3D depth: as you tilt it, the image shifts against the frame like a window into the scene. 0 is flat."
        />

        <ParameterControl
          label="Image Opacity (Hover)"
          param="imageEffects.opacityHover"
          value={imageOpacityHover}
          min={0}
          max={1}
          step={0.01}
          onChange={handleParamChange}
          tooltipContent="Adjusts the image's visibility when you hover over the card."
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
