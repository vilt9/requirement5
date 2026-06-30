import React, { useState } from 'react';
import * as S from './CardLayerDebug.styles';
import * as CardStyles from '../Card/Card.styles';
import { useCards } from '../../context/CardContext';

const CardLayerDebug = ({ cardData }) => {
  const [isVisible, setIsVisible] = useState(true);
  const { currentCard } = useCards();
  
  // Use currentCard if cardData is not provided
  const card = cardData || currentCard || {};
  
  // Extract rarity for testing different effects
  const rarity = card.rarity || 0.98; // Default to highest rarity for testing
  const isUltraRare = rarity >= 0.98;
  const isVMaxRare = rarity >= 0.95 && rarity < 0.98;
  const isGalaxyRare = rarity >= 0.9 && rarity < 0.95;
  const isHoloRare = rarity >= 0.8 && rarity < 0.9;
  
  // Generate a standard set of test cards with different effects - no custom styling
  const testCards = [
    {
      title: 'Full Card',
      description: 'The complete card with all layers combined',
      component: <S.CardWrapper>
        <CardStyles.CardElement>
          <CardStyles.CardFace className="front">
            <CardStyles.DepthLayer />
            <CardStyles.PatternOverlay 
              className={card?.patternInfo?.type?.toLowerCase() || "diamond"} 
              style={{ 
                '--pattern': card?.patternInfo?.css || 'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.1))',
                'opacity': card?.patternInfo?.opacity || 0.5
              }} 
            />
            <CardStyles.CardImage>
              <img src={card?.imageUrl || '/src/assets/img/placeholder.jpg'} alt="Card Illustration" />
              <CardStyles.ImageShine style={card?.effectParams ? {
                '--shine-intensity': card.effectParams.imageShineIntensity || '0.7'
              } : undefined} />
              <CardStyles.ImageMask 
                className={card?.imageEffects?.maskType || "vignette"}
                style={card?.imageEffects ? {
                  '--mask-opacity': card.imageEffects.maskOpacity || '0.3'
                } : undefined}
              />
            </CardStyles.CardImage>
            <CardStyles.HoloEffect style={card?.effectParams ? {
              '--shine-color1': card.effectParams.shineColor1 || 'rgba(255, 0, 0, 0.5)',
              '--shine-color2': card.effectParams.shineColor2 || 'rgba(0, 146, 255, 0.5)',
              '--shine-color3': card.effectParams.shineColor3 || 'rgba(0, 200, 0, 0.5)',
              '--shine-offset1': card.effectParams.shineOffset1 || '20%',
              '--shine-offset2': card.effectParams.shineOffset2 || '40%',
              '--shine-offset3': card.effectParams.shineOffset3 || '60%'
            } : undefined} />
            <CardStyles.HoloShine className="rare-ultra" $active={isUltraRare} />
            <CardStyles.HoloShine className="rare-holo-vmax" $active={isVMaxRare} />
            <CardStyles.HoloShine className="rare-holo-galaxy" $active={isGalaxyRare} />
            <CardStyles.HoloShine className="rare-holo" $active={isHoloRare} />
            <CardStyles.ChromaticAberration $active={isUltraRare || isVMaxRare} style={card?.effectParams ? {
              '--aberration-intensity': card.effectParams.aberrationIntensity || '0.5',
              '--aberration-speed': card.effectParams.aberrationSpeed || '10s'
            } : undefined} />
          </CardStyles.CardFace>
        </CardStyles.CardElement>
      </S.CardWrapper>,
      styles: 'Full card with all integrated effects'
    },
    {
      title: 'Card Base',
      description: 'Base card element and face',
      component: <S.CardWrapper>
        <CardStyles.CardElement>
          <CardStyles.CardFace className="front" />
        </CardStyles.CardElement>
      </S.CardWrapper>,
      styles: 'CardFace - border-radius: 15px; background matches the working_index.html'
    },
    {
      title: 'Depth Layer',
      description: 'Creates depth beneath other elements',
      component: <S.CardWrapper>
        <CardStyles.DepthLayer />
      </S.CardWrapper>,
      styles: 'DepthLayer - provides a 3D depth effect behind the main card elements'
    },
    {
      title: 'Pattern Overlay',
      description: 'Background pattern layer',
      component: <S.CardWrapper>
        <CardStyles.PatternOverlay 
          className={card?.patternInfo?.type?.toLowerCase() || "diamond"} 
          style={{ 
            '--pattern': card?.patternInfo?.css || 'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.1))',
            'opacity': card?.patternInfo?.opacity || 0.5
          }}
        />
      </S.CardWrapper>,
      styles: 'PatternOverlay - same pattern as the main card'
    },
    {
      title: 'Card Image',
      description: 'Main image layer with container',
      component: <S.CardWrapper>
        <CardStyles.CardImage>
          <img src={card?.imageUrl || '/src/assets/img/placeholder.jpg'} alt="Card Illustration" />
        </CardStyles.CardImage>
      </S.CardWrapper>,
      styles: 'CardImage - contains the main illustration'
    },
    {
      title: 'Image Shine',
      description: 'Shine effect applied on the image',
      component: <S.CardWrapper>
        <CardStyles.ImageShine style={card?.effectParams ? {
          '--shine-intensity': card.effectParams.imageShineIntensity || '0.7'
        } : undefined} />
      </S.CardWrapper>,
      styles: 'ImageShine - applies shine effect based on mouse movement'
    },
    {
      title: 'Image Mask',
      description: 'Vignette/mask effect on image',
      component: <S.CardWrapper>
        <CardStyles.ImageMask 
          className={card?.imageEffects?.maskType || "vignette"}
          style={card?.imageEffects ? {
            '--mask-opacity': card.imageEffects.maskOpacity || '0.3'
          } : undefined}
        />
      </S.CardWrapper>,
      styles: 'ImageMask - adds vignette or directional fade effects'
    },
    {
      title: 'Holo Effect',
      description: 'Base holographic gradient effect',
      component: <S.CardWrapper>
        <CardStyles.HoloEffect style={card?.effectParams ? {
          '--shine-color1': card.effectParams.shineColor1 || 'rgba(255, 0, 0, 0.5)',
          '--shine-color2': card.effectParams.shineColor2 || 'rgba(0, 146, 255, 0.5)',
          '--shine-color3': card.effectParams.shineColor3 || 'rgba(0, 200, 0, 0.5)',
          '--shine-offset1': card.effectParams.shineOffset1 || '20%',
          '--shine-offset2': card.effectParams.shineOffset2 || '40%',
          '--shine-offset3': card.effectParams.shineOffset3 || '60%'
        } : undefined} />
      </S.CardWrapper>,
      styles: 'HoloEffect - base holographic effect with precise colors from card data'
    },
    {
      title: 'Ultra Rare',
      description: 'Ultra rare holographic effect',
      component: <S.CardWrapper>
        <CardStyles.HoloShine className="rare-ultra" $active={true} />
      </S.CardWrapper>,
      styles: 'HoloShine (rare-ultra) - vibrant gradient matching working_index.html'
    },
    {
      title: 'VMAX Rare',
      description: 'VMAX rare holographic effect',
      component: <S.CardWrapper>
        <CardStyles.HoloShine className="rare-holo-vmax" $active={true} />
      </S.CardWrapper>,
      styles: 'HoloShine (rare-holo-vmax) - exactly matching the main card'
    },
    {
      title: 'Galaxy Holo',
      description: 'Galaxy rare holographic effect',
      component: <S.CardWrapper>
        <CardStyles.HoloShine className="rare-holo-galaxy" $active={true} />
      </S.CardWrapper>,
      styles: 'HoloShine (rare-holo-galaxy) - exactly matching the main card'
    },
    {
      title: 'Basic Holo',
      description: 'Basic holographic effect',
      component: <S.CardWrapper>
        <CardStyles.HoloShine className="rare-holo" $active={true} />
      </S.CardWrapper>,
      styles: 'HoloShine (rare-holo) - exactly matching the main card'
    },
    {
      title: 'Card Border', 
      description: 'Thick integrated border effect',
      component: <S.CardWrapper>
        <CardStyles.CardBorder style={card?.borderEffects ? {
          '--border-color': card.borderEffects.borderColor || 'rgba(255, 215, 0, 0.2)',
          '--border-opacity': card.borderEffects.borderOpacity || '0.8'
        } : undefined} />
      </S.CardWrapper>,
      styles: 'CardBorder - thick border matching the main card'
    },
    {
      title: 'Border Image',
      description: 'Blurred card image for border',
      component: <S.CardWrapper>
        <CardStyles.CardBorderImage style={card?.borderEffects && card?.imagePath ? {
          '--card-image': `url("/src/assets/card_images/${card.imagePath}")`,
          '--border-image-opacity': card.borderEffects.borderImageOpacity || '0.7'
        } : undefined} />
      </S.CardWrapper>,
      styles: 'CardBorderImage - blurred border effect matching the main card'
    },
    {
      title: 'Thin Edge Border',
      description: 'Thin edge highlight border',
      component: <S.CardWrapper>
        <CardStyles.ThinEdgeBorder style={card?.borderEffects ? {
          '--edge-angle': '45deg',
          '--edge-color1': card.borderEffects.thinEdgeColor || 'rgba(255, 255, 255, 0.8)',
          '--edge-color2': card.borderEffects.thinEdgeColor || 'rgba(255, 215, 0, 0.6)'
        } : undefined} />
      </S.CardWrapper>,
      styles: 'ThinEdgeBorder - edge highlight matching the main card'
    },
    {
      title: 'Chromatic Aberration',
      description: 'Color shift effect for high rarity',
      component: <S.CardWrapper>
        <CardStyles.ChromaticAberration 
          $active={true} 
          style={card?.effectParams ? {
            '--aberration-intensity': card.effectParams.aberrationIntensity || '0.5',
            '--aberration-speed': card.effectParams.aberrationSpeed || '10s'
          } : undefined}
        />
      </S.CardWrapper>,
      styles: 'ChromaticAberration - color shift effect matching the main card'
    }
  ];

  if (!isVisible) {
    return (
      <S.ToggleButton onClick={() => setIsVisible(true)}>
        Show Layer Debug
      </S.ToggleButton>
    );
  }

  return (
    <S.DebugContainer>
      <S.DebugHeader>
        <h2>Card Layer Debug</h2>
        <S.ToggleButton onClick={() => setIsVisible(false)}>
          Hide Layer Debug
        </S.ToggleButton>
      </S.DebugHeader>

      <S.LayerGrid>
        {testCards.map((card, index) => (
          <S.LayerCard key={index}>
            <S.LayerTitle>{card.title}</S.LayerTitle>
            <S.CardDisplay>
              {card.component}
            </S.CardDisplay>
            <S.LayerDescription>
              <h4>{card.description}</h4>
              <S.LayerStyles>
                <code>{card.styles}</code>
              </S.LayerStyles>
            </S.LayerDescription>
          </S.LayerCard>
        ))}
      </S.LayerGrid>

      <S.CSSVariablesSection>
        <h3>CSS Variables Used in Card Effects</h3>
        <S.VariablesTable>
          <thead>
            <tr>
              <th>Variable</th>
              <th>Purpose</th>
              <th>Used in</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>--mx, --my</code></td>
              <td>Mouse position for dynamic effects</td>
              <td>HoloShine, HoloEffect</td>
            </tr>
            <tr>
              <td><code>--posx, --posy</code></td>
              <td>Position values for gradients</td>
              <td>HoloShine</td>
            </tr>
            <tr>
              <td><code>--hyp</code></td>
              <td>Distance from center for effect intensity</td>
              <td>HoloShine, HoloEffect</td>
            </tr>
            <tr>
              <td><code>--holo-angle</code></td>
              <td>Angle for holographic effects</td>
              <td>HoloShine, HoloEffect</td>
            </tr>
            <tr>
              <td><code>--space</code></td>
              <td>Spacing for repeating gradients</td>
              <td>HoloShine (rare-ultra)</td>
            </tr>
            <tr>
              <td><code>--angle</code></td>
              <td>Angle for linear gradients</td>
              <td>HoloShine (rare-ultra)</td>
            </tr>
          </tbody>
        </S.VariablesTable>
      </S.CSSVariablesSection>

      <S.BlendModeSection>
        <h3>Blend Modes Used</h3>
        <S.BlendModeTable>
          <thead>
            <tr>
              <th>Blend Mode</th>
              <th>Effect</th>
              <th>Used in</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>color-dodge</code></td>
              <td>Brightens base layer based on blend layer</td>
              <td>HoloShine (base)</td>
            </tr>
            <tr>
              <td><code>color-burn</code></td>
              <td>Darkens base layer based on blend layer</td>
              <td>HoloShine (rare-ultra)</td>
            </tr>
            <tr>
              <td><code>screen</code></td>
              <td>Always brightens/lightens colors</td>
              <td>HoloShine (rare-ultra)</td>
            </tr>
            <tr>
              <td><code>soft-light</code></td>
              <td>Subtle lighting effect similar to diffuse light</td>
              <td>HoloShine (rare-ultra)</td>
            </tr>
            <tr>
              <td><code>overlay</code></td>
              <td>Combines multiply and screen</td>
              <td>HoloShine (VMAX)</td>
            </tr>
          </tbody>
        </S.BlendModeTable>
      </S.BlendModeSection>
    </S.DebugContainer>
  );
};

export default CardLayerDebug;
