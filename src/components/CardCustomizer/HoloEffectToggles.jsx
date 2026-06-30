import React from 'react';
import styled from 'styled-components';
import ControlSection from './ControlSection';
import ToggleSwitch from './ToggleSwitch';
import ParameterControl from './ParameterControl';
import BlendModeSelector from './BlendModeSelector';
import ColorPaletteEditor from './ColorPaletteEditor';
import ImageUploader from './ImageUploader';

const HoloEffectToggles = ({ 
  customCard, 
  handleParamChange, 
  className 
}) => {
  
  // Helper function to handle image uploads for specific holo effects
  const handleHoloImageUpload = (effectName, e) => {
    
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageDataUrl = reader.result;
      
      // Get the current parameters for this effect to preserve them
      const paramName = `${effectName}Params`;
      const currentParams = customCard[paramName] || {};
      
      // Create updated parameters that preserve existing values
      const updatedParams = {
        ...currentParams,  // ← Preserve all existing parameters (including colors array)
        backgroundImage: imageDataUrl  // ← Only update the background image
      };
      
      
      // Update the entire params object to preserve all properties
      handleParamChange(paramName, updatedParams, false);
    };
    reader.readAsDataURL(file);
  };
  if (!customCard) return null;
  
  // Extract holo effect settings or provide defaults
  const holoEffects = customCard.holoEffects || {
    rareHolo: false,
    rareHoloGalaxy: false,
    wowaHolo: false,
    rareHoloVmax: false
  };

  // Extract effect parameters for each holo type
  const rareHoloParams = customCard.rareHoloParams || {
    space: 1.5,
    hue: 21,
    saturation: 70,
    lightness: 50,
    intensity: 'subtle', // 'subtle' or 'extreme'
    filterStrength: 1.0, // Filter intensity multiplier
    mouseSpeed: 1.0, // Mouse response speed
    blendMode: 'soft-light', // Blend mode for the effect
    colors: [
      'rgb(255, 0, 0)',     // Red
      'rgb(255, 127, 0)',   // Orange
      'rgb(255, 255, 0)',   // Yellow
      'rgb(127, 255, 0)',   // Lime
      'rgb(0, 255, 0)',     // Green
      'rgb(0, 255, 127)',   // Spring Green
      'rgb(0, 255, 255)',   // Cyan
      'rgb(0, 127, 255)',   // Azure
      'rgb(0, 0, 255)',     // Blue
      'rgb(127, 0, 255)',   // Violet
      'rgb(255, 0, 255)',   // Magenta
      'rgb(255, 0, 127)'    // Rose
    ]
  };

  const rareHoloGalaxyParams = customCard.rareHoloGalaxyParams || {
    space: 4,
    brightness: 0.75,
    contrast: 1.2,
    saturation: 1.5,
    blendMode: 'color-dodge', // How uploaded image blends with galaxy colors
    gradientSize: 400, // Size of the rainbow gradient (width %)
    gradientHeight: 900, // Height of the rainbow gradient (%)
    smoothTransitions: 0.0, // Smooth color transitions (0=hard stops, 1=max smooth)
    colors: [
      'rgb(219, 204, 86)',
      'rgb(121, 199, 58)',
      'rgb(58, 192, 183)',
      'rgb(71, 98, 207)',
      'rgb(170, 69, 209)',
      'rgb(255, 90, 180)',
      'rgb(255, 90, 180)',
      'rgb(170, 69, 209)',
      'rgb(71, 98, 207)',
      'rgb(58, 192, 183)',
      'rgb(121, 199, 58)',
      'rgb(219, 204, 86)'
    ]
  };

  const wowaHoloParams = customCard.wowaHoloParams || {
    space: 4,
    angle: 45,
    brightness: 0.6,
    contrast: 1.2
  };

  const rareHoloVmaxParams = customCard.rareHoloVmaxParams || {
    space: 6,
    angle: 133,
    brightness: 0.5,
    contrast: 2.0
  };


  
  return (
    <ControlSection title="Holo Effect Toggles" className={className}>
      <TogglesContainer>
        {/* Rare Holo Toggle and Controls */}
        <ToggleGroup>
          <ToggleSwitch
            label="Rare Holo"
            param="holoEffects.rareHolo"
            checked={holoEffects.rareHolo}
            onChange={handleParamChange}
            tooltipContent="Toggles the classic rare holo effect with rainbow gradient patterns and soft-light blend mode."
          />
          
          {holoEffects.rareHolo && (
            <EffectControls>
              <ParameterControl
                label="Color Spacing (%)"
                param="rareHoloParams.space"
                value={rareHoloParams.space}
                min={0.5}
                max={5}
                step={0.1}
                onChange={handleParamChange}
                tooltipContent="Controls the spacing between colors in the rainbow gradient. Lower values create tighter bands."
              />
              
              <ParameterControl
                label="Hue Multiplier"
                param="rareHoloParams.hue"
                value={rareHoloParams.hue}
                min={1}
                max={50}
                step={1}
                onChange={handleParamChange}
                tooltipContent="Controls the hue variation in the rainbow pattern. Higher values create more color diversity."
              />
              
              <ParameterControl
                label="Saturation (%)"
                param="rareHoloParams.saturation"
                value={rareHoloParams.saturation}
                min={20}
                max={100}
                step={5}
                onChange={handleParamChange}
                tooltipContent="Controls the color intensity of the rainbow pattern."
              />
              
              <ParameterControl
                label="Lightness (%)"
                param="rareHoloParams.lightness"
                value={rareHoloParams.lightness}
                min={20}
                max={80}
                step={5}
                onChange={handleParamChange}
                tooltipContent="Controls the brightness of the rainbow colors."
              />
              
              <ParameterControl
                label="Effect Intensity"
                param="rareHoloParams.intensity"
                value={rareHoloParams.intensity}
                type="select"
                options={[
                  { value: 'subtle', label: 'Subtle (Mathematical)' },
                  { value: 'extreme', label: 'Extreme (Layered)' }
                ]}
                onChange={handleParamChange}
                tooltipContent="Choose between subtle mathematical gradients or extreme layered effects with image texture."
              />
              
              <ParameterControl
                label="Filter Strength"
                param="rareHoloParams.filterStrength"
                value={rareHoloParams.filterStrength || 1.0}
                min={0.1}
                max={3.0}
                step={0.1}
                onChange={handleParamChange}
                tooltipContent="Controls the intensity of the brightness, contrast, and saturation filters. Higher values create more dramatic effects."
              />
              
              <ParameterControl
                label="Mouse Response Speed"
                param="rareHoloParams.mouseSpeed"
                value={rareHoloParams.mouseSpeed || 1.0}
                min={0.1}
                max={5.0}
                step={0.1}
                onChange={handleParamChange}
                tooltipContent="Controls how quickly the effect responds to mouse movement. Higher values make the effect more reactive."
              />
              
              <BlendModeSelector
                label="Blend Mode"
                param="rareHoloParams.blendMode"
                value={rareHoloParams.blendMode || 'soft-light'}
                onChange={handleParamChange}
                tooltipContent="Choose how the holo effect blends with the card image. Different modes create different visual styles."
              />
              
              <ColorPaletteEditor
                label="Rainbow Colors"
                colors={rareHoloParams.colors}
                onChange={(newColors) => {
                  const updatedParams = { ...rareHoloParams, colors: newColors };
                  handleParamChange('rareHoloParams', updatedParams, false);
                }}
                tooltipContent="Customize the colors in the rainbow gradient. Add, remove, or reorder colors to create your own unique rainbow effect."
              />
              
              <ImageUploader
                id="rare-holo-background-upload"
                label="Background Image"
                onImageChange={(e) => handleHoloImageUpload('rareHolo', e)}
                previewSrc={rareHoloParams.backgroundImage}
                tooltipContent="Upload a custom background image to replace the default rainbow gradient pattern."
              />
            </EffectControls>
          )}
        </ToggleGroup>

        {/* Rare Holo Galaxy Toggle and Controls */}
        <ToggleGroup>
          <ToggleSwitch
            label="Rare Holo Galaxy"
            param="holoEffects.rareHoloGalaxy"
            checked={holoEffects.rareHoloGalaxy}
            onChange={handleParamChange}
            tooltipContent="Toggles the galaxy holo effect with space-themed background and color-dodge blend mode."
          />
          
          {holoEffects.rareHoloGalaxy && (
            <EffectControls>
              <ParameterControl
                label="Color Spacing (%)"
                param="rareHoloGalaxyParams.space"
                value={rareHoloGalaxyParams.space}
                min={1}
                max={10}
                step={0.5}
                onChange={handleParamChange}
                tooltipContent="Controls the spacing between galaxy colors. Higher values spread colors further apart."
              />
              
              <ParameterControl
                label="Brightness"
                param="rareHoloGalaxyParams.brightness"
                value={rareHoloGalaxyParams.brightness}
                min={0.1}
                max={2}
                step={0.05}
                onChange={handleParamChange}
                tooltipContent="Controls the overall brightness of the galaxy effect."
              />
              
              <ParameterControl
                label="Contrast"
                param="rareHoloGalaxyParams.contrast"
                value={rareHoloGalaxyParams.contrast}
                min={0.5}
                max={3}
                step={0.1}
                onChange={handleParamChange}
                tooltipContent="Controls the contrast between light and dark areas."
              />
              
              <ParameterControl
                label="Saturation"
                param="rareHoloGalaxyParams.saturation"
                value={rareHoloGalaxyParams.saturation}
                min={0.5}
                max={3}
                step={0.1}
                onChange={handleParamChange}
                tooltipContent="Controls the color intensity of the galaxy effect."
              />
              
              <BlendModeSelector
                label="Image Blend Mode"
                param="rareHoloGalaxyParams.blendMode"
                value={rareHoloGalaxyParams.blendMode || 'color-dodge'}
                onChange={handleParamChange}
                tooltipContent="Controls how the uploaded image blends with the galaxy colors. Try different modes to see dramatic visual changes!"
              />
              
              <ParameterControl
                label="Gradient Width"
                param="rareHoloGalaxyParams.gradientSize"
                value={rareHoloGalaxyParams.gradientSize}
                min={100}
                max={800}
                step={50}
                onChange={handleParamChange}
                tooltipContent="Controls the width of the rainbow gradient. Smaller values = tighter stripes, larger values = wider stripes."
              />
              
              <ParameterControl
                label="Gradient Height"
                param="rareHoloGalaxyParams.gradientHeight"
                value={rareHoloGalaxyParams.gradientHeight}
                min={200}
                max={1500}
                step={100}
                onChange={handleParamChange}
                tooltipContent="Controls the height of the rainbow gradient. Affects how the gradient stretches vertically with mouse movement."
              />
              
              <ParameterControl
                label="Smooth Transitions"
                param="rareHoloGalaxyParams.smoothTransitions"
                value={rareHoloGalaxyParams.smoothTransitions}
                min={0}
                max={1}
                step={0.1}
                onChange={handleParamChange}
                tooltipContent="Controls smoothness of color transitions. 0=hard stops, 1=maximum smooth blending between colors."
              />
              
              <ColorPaletteEditor
                label="Galaxy Colors"
                colors={rareHoloGalaxyParams.colors}
                onChange={(newColors) => {
                  const updatedParams = { ...rareHoloGalaxyParams, colors: newColors };
                  handleParamChange('rareHoloGalaxyParams', updatedParams, false);
                }}
                tooltipContent="Customize the colors in the galaxy gradient. Add, remove, or reorder colors to create your own unique galaxy effect."
              />
              
              <ImageUploader
                id="rare-holo-galaxy-background-upload"
                label="Galaxy Background"
                onImageChange={(e) => handleHoloImageUpload('rareHoloGalaxy', e)}
                previewSrc={rareHoloGalaxyParams.backgroundImage}
                tooltipContent="Upload a custom galaxy background image to replace the default space-themed background."
              />
            </EffectControls>
          )}
        </ToggleGroup>

        {/* Wowa Holo Toggle and Controls */}
        <ToggleGroup>
          <ToggleSwitch
            label="Wowa Holo"
            param="holoEffects.wowaHolo"
            checked={holoEffects.wowaHolo}
            onChange={handleParamChange}
            tooltipContent="Toggles the wowa holo effect with illusion background and soft-light blend mode."
          />
          
          {holoEffects.wowaHolo && (
            <EffectControls>
              <ParameterControl
                label="Color Spacing (%)"
                param="wowaHoloParams.space"
                value={wowaHoloParams.space}
                min={1}
                max={10}
                step={0.5}
                onChange={handleParamChange}
                tooltipContent="Controls the spacing between wowa effect colors."
              />
              
              <ParameterControl
                label="Pattern Angle (°)"
                param="wowaHoloParams.angle"
                value={wowaHoloParams.angle}
                min={0}
                max={360}
                step={5}
                onChange={handleParamChange}
                tooltipContent="Controls the angle of the wowa pattern gradient."
              />
              
              <ParameterControl
                label="Brightness"
                param="wowaHoloParams.brightness"
                value={wowaHoloParams.brightness}
                min={0.1}
                max={2}
                step={0.05}
                onChange={handleParamChange}
                tooltipContent="Controls the brightness of the wowa effect."
              />
              
              <ParameterControl
                label="Contrast"
                param="wowaHoloParams.contrast"
                value={wowaHoloParams.contrast}
                min={0.5}
                max={3}
                step={0.1}
                onChange={handleParamChange}
                tooltipContent="Controls the contrast of the wowa pattern."
              />
              
              <ImageUploader
                id="wowa-holo-background-upload"
                label="Illusion Background"
                onImageChange={(e) => handleHoloImageUpload('wowaHolo', e)}
                previewSrc={wowaHoloParams.backgroundImage}
                tooltipContent="Upload a custom illusion background image to replace the default wowa effect background."
              />
            </EffectControls>
          )}
        </ToggleGroup>

        {/* Rare Holo VMAX Toggle and Controls */}
        <ToggleGroup>
          <ToggleSwitch
            label="Rare Holo VMAX"
            param="holoEffects.rareHoloVmax"
            checked={holoEffects.rareHoloVmax}
            onChange={handleParamChange}
            tooltipContent="Toggles the VMAX holo effect with red/pink gradient and color-dodge blend mode."
          />
          
          {holoEffects.rareHoloVmax && (
            <EffectControls>
              <ParameterControl
                label="Color Spacing (%)"
                param="rareHoloVmaxParams.space"
                value={rareHoloVmaxParams.space}
                min={1}
                max={15}
                step={0.5}
                onChange={handleParamChange}
                tooltipContent="Controls the spacing between VMAX red/pink colors."
              />
              
              <ParameterControl
                label="Pattern Angle (°)"
                param="rareHoloVmaxParams.angle"
                value={rareHoloVmaxParams.angle}
                min={0}
                max={360}
                step={5}
                onChange={handleParamChange}
                tooltipContent="Controls the angle of the VMAX diagonal pattern."
              />
              
              <ParameterControl
                label="Brightness"
                param="rareHoloVmaxParams.brightness"
                value={rareHoloVmaxParams.brightness}
                min={0.1}
                max={2}
                step={0.05}
                onChange={handleParamChange}
                tooltipContent="Controls the brightness of the VMAX effect."
              />
              
              <ParameterControl
                label="Contrast"
                param="rareHoloVmaxParams.contrast"
                value={rareHoloVmaxParams.contrast}
                min={0.5}
                max={4}
                step={0.1}
                onChange={handleParamChange}
                tooltipContent="Controls the contrast of the VMAX pattern."
              />
              
              <ImageUploader
                id="rare-holo-vmax-background-upload"
                label="VMAX Background"
                onImageChange={(e) => handleHoloImageUpload('rareHoloVmax', e)}
                previewSrc={rareHoloVmaxParams.backgroundImage}
                tooltipContent="Upload a custom VMAX background image to replace the default red/pink gradient background."
              />
            </EffectControls>
          )}
        </ToggleGroup>


      </TogglesContainer>
    </ControlSection>
  );
};

const TogglesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const ToggleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
`;

const EffectControls = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  padding: 15px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  border-left: 3px solid #2196F3;
  animation: slideDown 0.3s ease-out;
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @media (min-width: 500px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export default HoloEffectToggles; 