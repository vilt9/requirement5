import React from 'react';
import styled from 'styled-components';
import ControlSection from './ControlSection';
import ToggleSwitch from './ToggleSwitch';
import ParameterControl from './ParameterControl';
import BlendModeSelector from './BlendModeSelector';
import ColorPaletteEditor from './ColorPaletteEditor';
import HoloImageInput from './HoloImageInput';
import { Dim } from '../UI';
import { HOLO_NAMES } from '../../utils/holoNames';

const HoloEffectToggles = ({
  customCard,
  handleParamChange,
  className,
  imageLibrary = [],
  addToLibrary,
  overlayImage,
  onOverlaySelect,
  onOverlayClear
}) => {
  // Set (or clear, with null) the texture image for one of the four systems.
  // Every image chosen here also lands in the shared library.
  const setEffectImage = (effectName, imageDataUrl) => {
    const paramName = `${effectName}Params`;
    const currentParams = customCard[paramName] || {};
    const updatedParams = { ...currentParams, backgroundImage: imageDataUrl || undefined };
    handleParamChange(paramName, updatedParams, false);
    if (imageDataUrl && addToLibrary) addToLibrary(imageDataUrl);
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

  // Signal only reads spacing/angle/texture — it has no brightness/contrast.
  const wowaHoloParams = customCard.wowaHoloParams || {
    space: 4,
    angle: 45
  };

  const rareHoloVmaxParams = customCard.rareHoloVmaxParams || {
    space: 6,
    angle: 133,
    brightness: 0.5,
    contrast: 2.0
  };


  
  return (
    <ControlSection title="Holographic Systems" className={className}>
      <TogglesContainer>
        <Dim style={{ fontSize: 11, lineHeight: 1.5 }}>
          Five ways to make a card holographic — combine them freely, and any
          image from your library can drive any of them. {HOLO_NAMES.overlay}{' '}
          blends your image straight over the card; the four systems below
          animate their texture as the card tilts, each with its own
          character. A system without an image uses its built-in gradient.
        </Dim>

        {/* Veil: the simplest technique — image + blend mode, no machinery. */}
        <ToggleGroup className="holo-overlay-group">
          <OverlayHead>
            <span className="name">{HOLO_NAMES.overlay}</span>
            <Dim style={{ fontSize: 10 }}>
              Your image blended straight over the card, shining with the pointer.
            </Dim>
          </OverlayHead>
          <HoloImageInput
            id="holo-image-upload"
            label={`${HOLO_NAMES.overlay} image`}
            value={overlayImage || null}
            onSelect={onOverlaySelect}
            onClear={onOverlayClear}
            imageLibrary={imageLibrary}
          />
          {overlayImage && (
            <BlendModeSelector
              label="Blend Mode"
              param="effectParams.customHoloBlendMode"
              value={customCard.effectParams?.customHoloBlendMode || 'color-dodge'}
              onChange={handleParamChange}
              tooltipContent={`How the ${HOLO_NAMES.overlay} image blends with the card. 'color-dodge' for bright shine, 'overlay' for subtle, 'hard-light' for vivid.`}
            />
          )}
        </ToggleGroup>

        {/* Prism (rareHolo) */}
        <ToggleGroup>
          <ToggleSwitch
            label={HOLO_NAMES.rareHolo}
            param="holoEffects.rareHolo"
            checked={holoEffects.rareHolo}
            onChange={handleParamChange}
            tooltipContent={`${HOLO_NAMES.rareHolo}: rainbow gradient bands sweeping with the tilt, soft-light blended.`}
          />

          {holoEffects.rareHolo && (
            <EffectControls>
              <HoloImageInput
                id="rare-holo-background-upload"
                label="texture image (replaces the rainbow gradient)"
                value={rareHoloParams.backgroundImage || null}
                onSelect={(url) => setEffectImage('rareHolo', url)}
                onClear={() => setEffectImage('rareHolo', null)}
                imageLibrary={imageLibrary}
              />
              <ParameterControl
                label="Band Width"
                param="rareHoloParams.space"
                value={rareHoloParams.space}
                min={0.5}
                max={5}
                step={0.1}
                onChange={handleParamChange}
                description="How wide each rainbow band is — low is tight stripes, high is broad washes."
              />

              <ParameterControl
                label="Color Spread"
                param="rareHoloParams.hue"
                value={rareHoloParams.hue}
                min={1}
                max={50}
                step={1}
                onChange={handleParamChange}
                description="How many different colors get packed into the sweep — higher is busier."
              />

              <ParameterControl
                label="Color Vividness"
                param="rareHoloParams.saturation"
                value={rareHoloParams.saturation}
                min={20}
                max={100}
                step={5}
                onChange={handleParamChange}
                description="Grey and subtle at the low end, neon at the top."
              />

              <ParameterControl
                label="Band Brightness"
                param="rareHoloParams.lightness"
                value={rareHoloParams.lightness}
                min={20}
                max={80}
                step={5}
                onChange={handleParamChange}
                description="How light the bands glow — low is moody, high is bright."
              />

              <ToggleSwitch
                label="Extra Layers"
                param="rareHoloParams.intensity"
                checked={rareHoloParams.intensity === 'extreme'}
                onChange={(param, checked) =>
                  handleParamChange(param, checked ? 'extreme' : 'subtle', false)
                }
                description="Stacks a second, heavier rainbow pass for a stronger effect."
              />

              <ParameterControl
                label="Effect Strength"
                param="rareHoloParams.filterStrength"
                value={rareHoloParams.filterStrength || 1.0}
                min={0.1}
                max={3.0}
                step={0.1}
                onChange={handleParamChange}
                description="One knob that turns the whole Prism effect up or down."
              />

              <ParameterControl
                label="Tilt Response"
                param="rareHoloParams.mouseSpeed"
                value={rareHoloParams.mouseSpeed || 1.0}
                min={0.1}
                max={5.0}
                step={0.1}
                onChange={handleParamChange}
                description="How fast the card follows your touch — high snaps, low glides."
              />

              <BlendModeSelector
                label="Blend Mode"
                param="rareHoloParams.blendMode"
                value={rareHoloParams.blendMode || 'soft-light'}
                onChange={handleParamChange}
                description="How the rainbow mixes with the artwork underneath it."
              />

              <ColorPaletteEditor
                label="Rainbow Colors"
                colors={rareHoloParams.colors}
                onChange={(newColors) => {
                  const updatedParams = { ...rareHoloParams, colors: newColors };
                  handleParamChange('rareHoloParams', updatedParams, false);
                }}
                tooltipContent="The band colors, in order — add, remove, or reorder them."
              />
              
            </EffectControls>
          )}
        </ToggleGroup>

        {/* Nebula (rareHoloGalaxy) */}
        <ToggleGroup>
          <ToggleSwitch
            label={HOLO_NAMES.rareHoloGalaxy}
            param="holoEffects.rareHoloGalaxy"
            checked={holoEffects.rareHoloGalaxy}
            onChange={handleParamChange}
            tooltipContent={`${HOLO_NAMES.rareHoloGalaxy}: a deep-space gradient that stretches and drifts with the tilt, color-dodge blended.`}
          />

          {holoEffects.rareHoloGalaxy && (
            <EffectControls>
              <HoloImageInput
                id="rare-holo-galaxy-background-upload"
                label="texture image (replaces the galaxy background)"
                value={rareHoloGalaxyParams.backgroundImage || null}
                onSelect={(url) => setEffectImage('rareHoloGalaxy', url)}
                onClear={() => setEffectImage('rareHoloGalaxy', null)}
                imageLibrary={imageLibrary}
              />
              <ParameterControl
                label="Swirl Scale"
                param="rareHoloGalaxyParams.space"
                value={rareHoloGalaxyParams.space}
                min={1}
                max={10}
                step={0.5}
                onChange={handleParamChange}
                description="Size of the color swirls — low is fine detail, high is broad clouds."
              />

              <ParameterControl
                label="Brightness"
                param="rareHoloGalaxyParams.brightness"
                value={rareHoloGalaxyParams.brightness}
                min={0.1}
                max={2}
                step={0.05}
                onChange={handleParamChange}
                description="Lifts or dims the whole effect."
              />

              <ParameterControl
                label="Contrast"
                param="rareHoloGalaxyParams.contrast"
                value={rareHoloGalaxyParams.contrast}
                min={0.5}
                max={3}
                step={0.1}
                onChange={handleParamChange}
                description="Sharpens the split between glow and shadow."
              />

              <ParameterControl
                label="Color Vividness"
                param="rareHoloGalaxyParams.saturation"
                value={rareHoloGalaxyParams.saturation}
                min={0.5}
                max={3}
                step={0.1}
                onChange={handleParamChange}
                description="Grey and subtle at the low end, neon at the top."
              />

              <BlendModeSelector
                label="Blend Mode"
                param="rareHoloGalaxyParams.blendMode"
                value={rareHoloGalaxyParams.blendMode || 'color-dodge'}
                onChange={handleParamChange}
                description="How the nebula mixes with the artwork underneath it."
              />

              <ParameterControl
                label="Glow Width"
                param="rareHoloGalaxyParams.gradientSize"
                value={rareHoloGalaxyParams.gradientSize}
                min={100}
                max={800}
                step={50}
                onChange={handleParamChange}
                description="Stretches the color field sideways — low is tight stripes, high is wide washes."
              />

              <ParameterControl
                label="Glow Height"
                param="rareHoloGalaxyParams.gradientHeight"
                value={rareHoloGalaxyParams.gradientHeight}
                min={200}
                max={1500}
                step={100}
                onChange={handleParamChange}
                description="Stretches the color field vertically as the card tilts."
              />

              <ParameterControl
                label="Color Blending"
                param="rareHoloGalaxyParams.smoothTransitions"
                value={rareHoloGalaxyParams.smoothTransitions}
                min={0}
                max={1}
                step={0.1}
                onChange={handleParamChange}
                description="0 keeps hard edges between colors; 1 melts them together."
              />

              <ColorPaletteEditor
                label="Nebula Colors"
                colors={rareHoloGalaxyParams.colors}
                onChange={(newColors) => {
                  const updatedParams = { ...rareHoloGalaxyParams, colors: newColors };
                  handleParamChange('rareHoloGalaxyParams', updatedParams, false);
                }}
                tooltipContent="The swirl colors, in order — add, remove, or reorder them."
              />
              
            </EffectControls>
          )}
        </ToggleGroup>

        {/* Signal (wowaHolo) */}
        <ToggleGroup>
          <ToggleSwitch
            label={HOLO_NAMES.wowaHolo}
            param="holoEffects.wowaHolo"
            checked={holoEffects.wowaHolo}
            onChange={handleParamChange}
            tooltipContent={`${HOLO_NAMES.wowaHolo}: a broad angular sweep crossing the card, soft-light blended.`}
          />

          {holoEffects.wowaHolo && (
            <EffectControls>
              <HoloImageInput
                id="wowa-holo-background-upload"
                label="texture image (replaces the illusion background)"
                value={wowaHoloParams.backgroundImage || null}
                onSelect={(url) => setEffectImage('wowaHolo', url)}
                onClear={() => setEffectImage('wowaHolo', null)}
                imageLibrary={imageLibrary}
              />
              <ParameterControl
                label="Stripe Spacing"
                param="wowaHoloParams.space"
                value={wowaHoloParams.space}
                min={1}
                max={10}
                step={0.5}
                onChange={handleParamChange}
                description="Distance between the sweeping stripes."
              />

              <ParameterControl
                label="Sweep Direction"
                param="wowaHoloParams.angle"
                value={wowaHoloParams.angle}
                min={0}
                max={360}
                step={5}
                onChange={handleParamChange}
                description="The angle the stripes travel across the card."
              />

            </EffectControls>
          )}
        </ToggleGroup>

        {/* Pulse (rareHoloVmax) */}
        <ToggleGroup>
          <ToggleSwitch
            label={HOLO_NAMES.rareHoloVmax}
            param="holoEffects.rareHoloVmax"
            checked={holoEffects.rareHoloVmax}
            onChange={handleParamChange}
            tooltipContent={`${HOLO_NAMES.rareHoloVmax}: high-contrast red/pink bands, color-dodge blended.`}
          />

          {holoEffects.rareHoloVmax && (
            <EffectControls>
              <HoloImageInput
                id="rare-holo-vmax-background-upload"
                label="texture image (replaces the red/pink gradient)"
                value={rareHoloVmaxParams.backgroundImage || null}
                onSelect={(url) => setEffectImage('rareHoloVmax', url)}
                onClear={() => setEffectImage('rareHoloVmax', null)}
                imageLibrary={imageLibrary}
              />
              <ParameterControl
                label="Band Spacing"
                param="rareHoloVmaxParams.space"
                value={rareHoloVmaxParams.space}
                min={1}
                max={15}
                step={0.5}
                onChange={handleParamChange}
                description="Distance between the pulse bands."
              />

              <ParameterControl
                label="Band Direction"
                param="rareHoloVmaxParams.angle"
                value={rareHoloVmaxParams.angle}
                min={0}
                max={360}
                step={5}
                onChange={handleParamChange}
                description="The angle the bands run across the card."
              />

              <ParameterControl
                label="Brightness"
                param="rareHoloVmaxParams.brightness"
                value={rareHoloVmaxParams.brightness}
                min={0.1}
                max={2}
                step={0.05}
                onChange={handleParamChange}
                description="Lifts or dims the whole effect."
              />

              <ParameterControl
                label="Contrast"
                param="rareHoloVmaxParams.contrast"
                value={rareHoloVmaxParams.contrast}
                min={0.5}
                max={4}
                step={0.1}
                onChange={handleParamChange}
                description="Sharpens the split between light and dark bands."
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

const OverlayHead = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  .name {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--amber-text);
  }
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