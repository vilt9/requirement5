import React from 'react';
import styled from 'styled-components';
import ColorPicker from './ColorPicker';

const ColorPaletteEditor = ({
  label,
  param,
  colors = ['#ffffff'], // Default to white if no colors provided
  onChange,
  tooltipContent,
  description
}) => {
  const desc = description || tooltipContent;
  // Ensure colors is always an array
  const safeColors = Array.isArray(colors) ? colors : ['#ffffff'];
  
  const addColor = () => {
    const newColors = [...safeColors, '#ffffff'];
    onChange(newColors);
  };

  const removeColor = (index) => {
    if (safeColors.length > 1) {
      const newColors = safeColors.filter((_, i) => i !== index);
      onChange(newColors);
    }
  };

  const updateColor = (index, newColor) => {
    const newColors = [...safeColors];
    newColors[index] = newColor;
    onChange(newColors);
  };

  const moveColor = (fromIndex, toIndex) => {
    const newColors = [...safeColors];
    const [movedColor] = newColors.splice(fromIndex, 1);
    newColors.splice(toIndex, 0, movedColor);
    onChange(newColors);
  };

  return (
    <PaletteContainer>
      <PaletteLabel>{label}</PaletteLabel>
      {desc && <Description>{desc}</Description>}
      
      <ColorsList>
        {safeColors.map((color, index) => (
          <ColorItem key={index}>
            <ColorPicker
              label={`Color ${index + 1}`}
              param={param ? `${param}.${index}` : undefined}
              value={color}
              onChange={(_, newColor) => updateColor(index, newColor)}
            />
            
            <ColorControls>
              {index > 0 && (
                <ControlButton
                  onClick={() => moveColor(index, index - 1)}
                  title="Move up"
                >
                  ↑
                </ControlButton>
              )}
              
              {index < safeColors.length - 1 && (
                <ControlButton
                  onClick={() => moveColor(index, index + 1)}
                  title="Move down"
                >
                  ↓
                </ControlButton>
              )}
              
              {safeColors.length > 1 && (
                <ControlButton
                  onClick={() => removeColor(index)}
                  title="Remove color"
                >
                  ×
                </ControlButton>
              )}
            </ColorControls>
          </ColorItem>
        ))}
      </ColorsList>
      
      <AddColorButton onClick={addColor}>
        + Add Color
      </AddColorButton>
      
      <GradientPreview colors={safeColors} />
    </PaletteContainer>
  );
};

const PaletteContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
`;

const PaletteLabel = styled.label`
  font-size: 11px;
  color: var(--amber-text);
  font-family: var(--font-mono);
`;

const Description = styled.span`
  font-size: 10px;
  line-height: 1.45;
  color: var(--amber-dim);
`;

const ColorsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ColorItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
`;

const ColorControls = styled.div`
  display: flex;
  gap: 2px;
`;

const ControlButton = styled.button`
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: ${props => props.danger ? 'rgba(255, 0, 0, 0.3)' : 'var(--field-bg)'};
  color: var(--amber-text);
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${props => props.danger ? 'rgba(255, 0, 0, 0.5)' : 'var(--panel-hover)'};
  }
`;

const AddColorButton = styled.button`
  background: var(--panel);
  border: 1px solid var(--gold);
  color: var(--gold-bright);
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  font-family: var(--font-mono);

  &:hover {
    background: var(--panel-hover);
    color: var(--white);
  }
`;

const GradientPreview = ({ colors = ['#ffffff'] }) => {
  const safeColors = Array.isArray(colors) ? colors : ['#ffffff'];
  
  return (
    <PreviewContainer>
      <PreviewLabel>Preview:</PreviewLabel>
      <PreviewGradient
        style={{
          background: `linear-gradient(90deg, ${safeColors.join(', ')})`
        }}
      />
    </PreviewContainer>
  );
};

const PreviewContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const PreviewLabel = styled.span`
  font-size: 10px;
  color: var(--amber-text);
  font-family: var(--font-mono);
`;

const PreviewGradient = styled.div`
  height: 20px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

export default ColorPaletteEditor;
