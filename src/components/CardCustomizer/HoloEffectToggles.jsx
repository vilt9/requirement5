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
  // Set (or clear, with null) the image layer for one of the four systems.
  // A fresh image arrives as a REAL layer: visible at rest, screen-blended,
  // with the system's gradient kept underneath — the stacking the systems
  // were always meant to allow. Every image chosen also lands in the library.
  const setEffectImage = (effectName, imageDataUrl) => {
    const paramName = `${effectName}Params`;
    const currentParams = customCard[paramName] || {};
    const updatedParams = imageDataUrl
      ? {
        ...currentParams,
        backgroundImage: imageDataUrl,
        layerGradient: currentParams.layerGradient ?? true,
        imagePresence: currentParams.imagePresence ?? 0.55,
        imageBlendMode: currentParams.imageBlendMode ?? 'screen'
      }
      : { ...currentParams, backgroundImage: undefined };
    handleParamChange(paramName, updatedParams, false);
    if (imageDataUrl && addToLibrary) addToLibrary(imageDataUrl);
  };

  // The image-layer knobs every system shares once an image is set. A plain
  // render function (not a component) so re-renders don't remount the
  // sliders mid-drag.
  const renderImageLayerControls = (sys, params) => (
    <>
      <ParameterControl
        label="Image Presence"
        param={`${sys}Params.imagePresence`}
        value={params.imagePresence ?? 0}
        min={0}
        max={1}
        step={0.05}
        onChange={handleParamChange}
        description="How solidly the image sits on the card while it rests — 0 only shows it in motion."
      />
      <BlendModeSelector
        label="Image Blend Mode"
        param={`${sys}Params.imageBlendMode`}
        value={params.imageBlendMode || 'soft-light'}
        onChange={handleParamChange}
        description="How the image mixes with everything under it — 'normal' keeps it a plain picture."
      />
      <ToggleSwitch
        label="Gradient Underneath"
        param={`${sys}Params.layerGradient`}
        checked={!!params.layerGradient}
        onChange={(param, checked) => handleParamChange(param, checked, false)}
        description="Keeps the system's own gradient running under your image instead of being replaced by it."
      />
    </>
  );
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

  // Veil state: cards from before the explicit toggle are on exactly when
  // they carry an overlay image — same rule the renderer applies.
  const ep = customCard.effectParams || {};
  const overlayOn = holoEffects.overlay ?? !!overlayImage;


  
  return (
    <ControlSection title="Holographic Systems" className={className}>
      <TogglesContainer>
        <Dim style={{ fontSize: 11, lineHeight: 1.5 }}>
          Five ways to make a card holographic — combine them freely, and any
          image from your library can drive any of them. {HOLO_NAMES.overlay}{' '}
          is the standard card-wide sheen (with or without an image); the four
          systems below animate their texture as the card tilts, each with its
          own character. Images now LAYER with the gradients — stack several
          systems, each with its own image, for properly weird cards.
        </Dim>

        {/* Veil: the standard technique — a card-wide sheen with the full
            set of restored knobs. Works with no image at all (hue-matched
            gradient), or blends your image straight over the card. */}
        <ToggleGroup className="holo-overlay-group">
          <ToggleSwitch
            label={HOLO_NAMES.overlay}
            param="holoEffects.overlay"
            checked={overlayOn}
            onChange={(param, checked) => handleParamChange(param, checked, false)}
            tooltipContent={`${HOLO_NAMES.overlay}: the standard holographic sheen across the whole card — its own gradient, or your image blended over everything.`}
          />

          {overlayOn && (
            <EffectControls>
              <HoloImageInput
                id="holo-image-upload"
                label={`${HOLO_NAMES.overlay} image (optional — without one, a sheen in the card's own colors)`}
                value={overlayImage || null}
                onSelect={onOverlaySelect}
                onClear={onOverlayClear}
                imageLibrary={imageLibrary}
              />
              <BlendModeSelector
                label="Blend Mode"
                param="effectParams.customHoloBlendMode"
                value={customCard.effectParams?.customHoloBlendMode || 'color-dodge'}
                onChange={handleParamChange}
                tooltipContent={`How the ${HOLO_NAMES.overlay} blends with the card. 'color-dodge' for bright shine, 'overlay' for subtle, 'hard-light' for vivid.`}
              />
              {!overlayImage && (
                <>
                  <ParameterControl
                    label="Sheen Angle"
                    param="effectParams.sheenAngle"
                    value={ep.sheenAngle ?? 0}
                    min={0}
                    max={360}
                    step={5}
                    onChange={handleParamChange}
                    description="Rotates the sheen bands relative to the tilt — 0 follows the pointer exactly."
                  />
                  <ParameterControl
                    label="Band Spacing"
                    param="effectParams.sheenSpace"
                    value={ep.sheenSpace ?? 12}
                    min={4}
                    max={40}
                    step={1}
                    onChange={handleParamChange}
                    description="How wide the sheen bands run — low is tight stripes, high is broad washes."
                  />
                </>
              )}
              <ParameterControl
                label="Shine Intensity"
                param="effectParams.sheenShine"
                value={ep.sheenShine ?? 1}
                min={0.2}
                max={1.1}
                step={0.05}
                onChange={handleParamChange}
                description="How strongly the veil glows while the card moves."
              />
              <ParameterControl
                label="Presence at Rest"
                param="effectParams.veilPresence"
                value={ep.veilPresence ?? 0}
                min={0}
                max={0.8}
                step={0.05}
                onChange={handleParamChange}
                description="Keeps some of the veil visible even when the card sits still."
              />
              <ParameterControl
                label="Aberration"
                param="effectParams.aberrationIntensity"
                value={ep.aberrationIntensity ?? 0}
                min={0}
                max={1}
                step={0.05}
                onChange={handleParamChange}
                description="Chromatic fringing: red/blue ghosts split apart as the card tilts. Also nudges authentic rarity."
              />
              <ParameterControl
                label="Brightness"
                param="effectParams.sheenBrightness"
                value={ep.sheenBrightness ?? 1}
                min={0.3}
                max={2}
                step={0.05}
                onChange={handleParamChange}
                description="Lifts or dims the whole veil."
              />
              <ParameterControl
                label="Contrast"
                param="effectParams.sheenContrast"
                value={ep.sheenContrast ?? 1}
                min={0.4}
                max={2}
                step={0.05}
                onChange={handleParamChange}
                description="Sharpens the split between the veil's glow and shadow."
              />
              <ParameterControl
                label="Color Vividness"
                param="effectParams.sheenSaturate"
                value={ep.sheenSaturate ?? 1}
                min={0}
                max={2}
                step={0.05}
                onChange={handleParamChange}
                description="Grey and subtle at the low end, neon at the top."
              />
              <ParameterControl
                label="Drift"
                param="effectParams.sheenDrift"
                value={ep.sheenDrift ?? 1}
                min={0}
                max={3}
                step={0.1}
                onChange={handleParamChange}
                description="How far the veil slides as the card tilts — 0 pins it still, high sweeps it around."
              />
            </EffectControls>
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
                label="image layer (rides the effect; stack it with the gradient below)"
                value={rareHoloParams.backgroundImage || null}
                onSelect={(url) => setEffectImage('rareHolo', url)}
                onClear={() => setEffectImage('rareHolo', null)}
                imageLibrary={imageLibrary}
              />
              {rareHoloParams.backgroundImage && renderImageLayerControls('rareHolo', rareHoloParams)}
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
                label="image layer (rides the effect; stack it with the gradient below)"
                value={rareHoloGalaxyParams.backgroundImage || null}
                onSelect={(url) => setEffectImage('rareHoloGalaxy', url)}
                onClear={() => setEffectImage('rareHoloGalaxy', null)}
                imageLibrary={imageLibrary}
              />
              {rareHoloGalaxyParams.backgroundImage && renderImageLayerControls('rareHoloGalaxy', rareHoloGalaxyParams)}
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
                label="image layer (rides the effect; stack it with the gradient below)"
                value={wowaHoloParams.backgroundImage || null}
                onSelect={(url) => setEffectImage('wowaHolo', url)}
                onClear={() => setEffectImage('wowaHolo', null)}
                imageLibrary={imageLibrary}
              />
              {wowaHoloParams.backgroundImage && renderImageLayerControls('wowaHolo', wowaHoloParams)}
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

              <ParameterControl
                label="Brightness"
                param="wowaHoloParams.brightness"
                value={wowaHoloParams.brightness ?? 0.6}
                min={0.1}
                max={2}
                step={0.05}
                onChange={handleParamChange}
                description="Lifts or dims the whole effect."
              />

              <ParameterControl
                label="Contrast"
                param="wowaHoloParams.contrast"
                value={wowaHoloParams.contrast ?? 1.2}
                min={0.5}
                max={3}
                step={0.1}
                onChange={handleParamChange}
                description="Sharpens the split between glow and shadow."
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
                label="image layer (rides the effect; stack it with the gradient below)"
                value={rareHoloVmaxParams.backgroundImage || null}
                onSelect={(url) => setEffectImage('rareHoloVmax', url)}
                onClear={() => setEffectImage('rareHoloVmax', null)}
                imageLibrary={imageLibrary}
              />
              {rareHoloVmaxParams.backgroundImage && renderImageLayerControls('rareHoloVmax', rareHoloVmaxParams)}
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