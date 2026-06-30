import React from 'react';
import styled from 'styled-components';
import ControlSection from './ControlSection';
import ParameterControl from './ParameterControl';
import BlendModeSelector from './BlendModeSelector';
import ImageUploader from './ImageUploader';

const HoloEffectControls = ({
  customCard,
  handleParamChange,
  handleHoloImageUpload,
  holoImagePreview,
  className
}) => {
  if (!customCard) return null;
  
  // Extract effectParams or provide defaults
  const effectParams = customCard.effectParams || {};
  // Nullish coalescing so a legitimate 0 isn't swallowed by the default.
  const space = effectParams.space ?? 4;
  const shineIntensity = effectParams.shineIntensity ?? 0.8;
  const aberrationIntensity = effectParams.aberrationIntensity ?? 0.5;
  const blendMode = effectParams.customHoloBlendMode || 'color-dodge';
  const filterBrightness = effectParams.filterBrightness ?? 0.6;
  const filterContrast = effectParams.filterContrast ?? 1.2;
  const filterSaturate = effectParams.filterSaturate ?? 0.9;
  const holoAngle = effectParams.holoAngle ?? 45;
  
  return (
    <ControlSection title="Holographic Effect" className={className}>
      <HoloControlsGrid>
        <ParameterControl
          label="Rarity (Affects Holo Visibility)"
          param="rarity"
          value={customCard.rarity ?? 0.5}
          min={0}
          max={1}
          step={0.01}
          onChange={handleParamChange}
          tooltipContent="Controls how rare the card appears. Higher values (0.8+) enhance holographic effects, making them more visible and pronounced. Set above 0.85 for maximum holographic shine."
        />
        
        <ParameterControl
          label="Space Between Colors (%)"
          param="effectParams.space"
          value={space}
          min={1}
          max={10}
          step={0.5}
          onChange={handleParamChange}
          tooltipContent="Adjusts the spacing between colors in the holographic gradient. Lower values create tighter color bands, while higher values spread colors further apart."
        />
        
        <ParameterControl
          label="Shine Intensity"
          param="effectParams.shineIntensity"
          value={shineIntensity}
          min={0}
          max={1}
          step={0.01}
          onChange={handleParamChange}
          tooltipContent="Controls how bright the holographic shine appears. Higher values create more pronounced shine that catches light more dramatically as the card moves."
        />
        
        <ParameterControl
          label="Aberration Intensity"
          param="effectParams.aberrationIntensity"
          value={aberrationIntensity}
          min={0}
          max={1}
          step={0.01}
          onChange={handleParamChange}
          tooltipContent="Controls the chromatic aberration effect (color separation). Higher values create more dramatic rainbow-like color separation around edges of the holographic effect."
        />
        
        <ParameterControl
          label="Holo Pattern Angle (°)"
          param="effectParams.holoAngle"
          value={holoAngle}
          min={0}
          max={360}
          step={1}
          onChange={handleParamChange}
          tooltipContent="Sets the angle of the holographic pattern in degrees. This changes the direction of light reflection and how the holographic pattern moves as you tilt the card."
        />
        
        <BlendModeSelector
          label="Holographic Blend Mode"
          param="effectParams.customHoloBlendMode"
          value={blendMode}
          onChange={handleParamChange}
          tooltipContent="Determines how the holographic effect blends with the card. Different modes create dramatically different visual effects: 'color-dodge' for bright shine, 'overlay' for subtle effect, 'hard-light' for vivid colors."
        />
        
        <ParameterControl
          label="Filter Brightness"
          param="effectParams.filterBrightness"
          value={filterBrightness}
          min={0.1}
          max={2}
          step={0.05}
          onChange={handleParamChange}
          tooltipContent="Adjusts the brightness of the holographic effect. Higher values create brighter, more visible effects, while lower values create more subtle, darker effects."
        />
        
        <ParameterControl
          label="Filter Contrast"
          param="effectParams.filterContrast"
          value={filterContrast}
          min={0.5}
          max={3}
          step={0.1}
          onChange={handleParamChange}
          tooltipContent="Adjusts the contrast of the holographic effect. Higher values create more defined, sharp holographic patterns with greater separation between light and dark areas."
        />
        
        <ParameterControl
          label="Filter Saturation"
          param="effectParams.filterSaturate"
          value={filterSaturate}
          min={0}
          max={2}
          step={0.05}
          onChange={handleParamChange}
          tooltipContent="Controls color intensity of the holographic effect. Higher values create more vibrant, colorful effects, while lower values create more muted, desaturated effects."
        />
      </HoloControlsGrid>
      
      <ImageUploadContainer>
        <ImageUploader
          id="holo-image-upload"
          label="Holographic Effect Image"
          onImageChange={handleHoloImageUpload}
          previewSrc={holoImagePreview}
          accept="image/*"
          tooltipContent="Upload a custom image to use as the holographic effect pattern. Try images with bright spots, gradients, or light patterns for the best holographic appearance."
        />
      </ImageUploadContainer>
    </ControlSection>
  );
};

const HoloControlsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;
  margin-bottom: 20px;
  
  @media (min-width: 500px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const ImageUploadContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 15px;
`;

export default HoloEffectControls;
