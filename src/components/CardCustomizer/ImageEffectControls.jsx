import React from 'react';
import styled from 'styled-components';
import ControlSection from './ControlSection';
import ParameterControl from './ParameterControl';
import ImageUploader from './ImageUploader';
import ToggleSwitch from './ToggleSwitch';

const ImageEffectControls = ({
  customCard,
  handleParamChange,
  handleMainImageChange,
  mainImagePreview,
  className
}) => {
  if (!customCard) return null;
  
  // Extract params with defaults
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
          label="Image Opacity (Hover)"
          param="imageEffects.opacityHover"
          value={imageOpacityHover}
          min={0}
          max={1}
          step={0.01}
          onChange={handleParamChange}
          tooltipContent="Adjusts the image's visibility when you hover over the card."
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
      </ImageControlsGrid>
      
      <ImageUploaderContainer>
        <ImageUploader
          id="main-image-upload"
          label="Main Card Image"
          onImageChange={handleMainImageChange}
          previewSrc={mainImagePreview}
          accept="image/*"
          tooltipContent="Upload the primary image to display on your card."
        />
      </ImageUploaderContainer>
    </ControlSection>
  );
};

const ImageControlsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;
  margin-bottom: 20px;
  
  @media (min-width: 500px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const ImageUploaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 15px;
`;

export default ImageEffectControls;
