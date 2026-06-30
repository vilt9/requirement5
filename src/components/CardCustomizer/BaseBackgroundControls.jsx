import React from 'react';
import styled from 'styled-components';
import ControlSection from './ControlSection';
import ParameterControl from './ParameterControl';
import ColorPicker from './ColorPicker';
import ToggleSwitch from './ToggleSwitch';
import Tooltip from './Tooltip';

// The base background sits behind the card image and shows through as the image
// opacity drops. Fully editable: geometry (type), up to three colours, the fade
// stops that control how soft/spread the blend is, position/angle, plus vignette
// and film-grain texture. "Randomize" rolls a fresh coherent palette + fade.
const TYPES = [
  { value: 'linear', label: 'Linear fade' },
  { value: 'radial', label: 'Radial fade' },
  { value: 'conic', label: 'Conic sweep' },
  { value: 'solid', label: 'Solid' },
];

const DEFAULTS = {
  type: 'linear', color1: '#10131c', color2: '#05060a', color3: '#1a1430',
  useThird: false, angle: 135, posX: 50, posY: 50,
  fadeStart: 0, fadeEnd: 100, vignette: 0, grain: 0,
};

const BaseBackgroundControls = ({ customCard, handleParamChange, onRandomize }) => {
  if (!customCard) return null;
  const bg = { ...DEFAULTS, ...(customCard.baseBackground || {}) };

  // ColorPicker emits (param, value) with no numeric flag; force isNumeric=false.
  const setColor = (param, value) => handleParamChange(param, value, false);
  const isRadialOrConic = bg.type === 'radial' || bg.type === 'conic';
  const isSolid = bg.type === 'solid';

  return (
    <ControlSection title="Base Background">
      <Hint>Sits behind the image — lower the Image Opacity to reveal it.</Hint>

      <FieldRow>
        <RowLabel>Type</RowLabel>
        <Select
          value={bg.type}
          onChange={(e) => handleParamChange('baseBackground.type', e.target.value, false)}
        >
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <Tooltip content="Geometry of the fade: linear (directional), radial (from a point), conic (angular sweep), or a flat solid colour." />
      </FieldRow>

      <ColorPicker
        label="Color 1"
        param="baseBackground.color1"
        value={bg.color1}
        onChange={setColor}
        tooltipContent="The primary background colour (the solid colour, when type is Solid)."
      />
      {!isSolid && (
        <ColorPicker
          label="Color 2"
          param="baseBackground.color2"
          value={bg.color2}
          onChange={setColor}
          tooltipContent="The colour the fade blends toward."
        />
      )}
      {!isSolid && (
        <ToggleSwitch
          label="Use third color"
          param="baseBackground.useThird"
          checked={!!bg.useThird}
          onChange={handleParamChange}
          tooltipContent="Add a third colour in the middle of the fade for a richer blend."
        />
      )}
      {!isSolid && bg.useThird && (
        <ColorPicker
          label="Color 3 (mid)"
          param="baseBackground.color3"
          value={bg.color3}
          onChange={setColor}
          tooltipContent="The middle colour of the three-stop fade."
        />
      )}

      {!isSolid && (bg.type === 'linear' || bg.type === 'conic') && (
        <ParameterControl
          label={bg.type === 'conic' ? 'Sweep Start (°)' : 'Fade Angle (°)'}
          param="baseBackground.angle"
          value={bg.angle}
          min={0} max={360} step={1}
          onChange={handleParamChange}
          tooltipContent="Direction of the fade in degrees."
        />
      )}

      {!isSolid && isRadialOrConic && (
        <>
          <ParameterControl
            label="Center X (%)"
            param="baseBackground.posX"
            value={bg.posX}
            min={0} max={100} step={1}
            onChange={handleParamChange}
            tooltipContent="Horizontal position of the fade's center."
          />
          <ParameterControl
            label="Center Y (%)"
            param="baseBackground.posY"
            value={bg.posY}
            min={0} max={100} step={1}
            onChange={handleParamChange}
            tooltipContent="Vertical position of the fade's center."
          />
        </>
      )}

      {!isSolid && (
        <>
          <ParameterControl
            label="Fade Start (%)"
            param="baseBackground.fadeStart"
            value={bg.fadeStart}
            min={0} max={100} step={1}
            onChange={handleParamChange}
            tooltipContent="Where the first colour holds before it starts blending. Higher = the first colour fills more of the card."
          />
          <ParameterControl
            label="Fade End (%)"
            param="baseBackground.fadeEnd"
            value={bg.fadeEnd}
            min={0} max={100} step={1}
            onChange={handleParamChange}
            tooltipContent="Where the blend completes. Lower = a harder, tighter fade; higher = a softer, longer spread."
          />
        </>
      )}

      <ParameterControl
        label="Vignette"
        param="baseBackground.vignette"
        value={bg.vignette}
        min={0} max={1} step={0.01}
        onChange={handleParamChange}
        tooltipContent="Darkens the edges of the background to draw focus to the center."
      />
      <ParameterControl
        label="Grain"
        param="baseBackground.grain"
        value={bg.grain}
        min={0} max={1} step={0.01}
        onChange={handleParamChange}
        tooltipContent="Subtle film-grain texture over the background for a printed, tactile feel."
      />

      <RandomizeButton type="button" onClick={onRandomize}>
        ⟳ Randomize background
      </RandomizeButton>
    </ControlSection>
  );
};

const Hint = styled.p`
  font-size: 10px;
  color: var(--amber-dim);
  margin: 0 0 8px;
`;

const FieldRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
`;

const RowLabel = styled.span`
  font-size: 11px;
  color: var(--amber-text);
  min-width: 36px;
`;

const Select = styled.select`
  flex: 1;
  background: var(--field-bg);
  border: 1px solid var(--panel-border);
  color: var(--amber-text);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 4px 6px;
  border-radius: 3px;

  &:focus { outline: none; border-color: var(--gold); }
  option { background: #1a1510; }
`;

const RandomizeButton = styled.button`
  margin-top: 10px;
  width: 100%;
  background: var(--panel);
  border: 1px solid var(--gold);
  color: var(--gold-bright);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 7px;
  border-radius: 3px;
  cursor: pointer;

  &:hover { background: var(--panel-hover); color: var(--white); }
`;

export default BaseBackgroundControls;
