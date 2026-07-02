import { useState, useRef, useEffect } from 'react';
import * as S from './Card.styles';
import PropTypes from 'prop-types';
import { getHolographicEffectClass } from '../../utils/cardGenerator';
import CustomHoloEffect from './CustomHoloEffect';

// Build the base-background CSS value (behind the card image) from the structured
// model. Fade stops control how soft/spread the blend is; type picks the geometry.
const buildBaseBackground = (bg) => {
  if (!bg) return null;
  const {
    type = 'linear', color1 = '#10131c', color2 = '#05060a', color3 = '#1a1430',
    useThird = false, angle = 135, posX = 50, posY = 50, fadeStart = 0, fadeEnd = 100,
  } = bg;
  if (type === 'solid') return color1;
  const mid = (Number(fadeStart) + Number(fadeEnd)) / 2;
  const stops = useThird
    ? `${color1} ${fadeStart}%, ${color3} ${mid}%, ${color2} ${fadeEnd}%`
    : `${color1} ${fadeStart}%, ${color2} ${fadeEnd}%`;
  if (type === 'radial') return `radial-gradient(circle at ${posX}% ${posY}%, ${stops})`;
  if (type === 'conic') return `conic-gradient(from ${angle}deg at ${posX}% ${posY}%, ${stops})`;
  return `linear-gradient(${angle}deg, ${stops})`;
};

const Card = ({ cardData, isInteractive = true, onClick, autoTour = false }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [failedSrc, setFailedSrc] = useState(null); // hides an image that 404s, per-src, so it can't flicker
  const cardRef = useRef(null);
  const cardSceneRef = useRef(null);
  // True while a real pointer is over the card — the auto tour yields to it.
  const pointerActiveRef = useRef(false);
  
  // Helper function to set CSS variables on both CardScene and CardContainer
  // IMPORTANT: CSS variables set on both elements to ensure inheritance works in Chrome
  // CardScene has stable hit area for mouse events, CardContainer for direct child access
  const setCardCSSVariables = (variables) => {
    Object.entries(variables).forEach(([key, value]) => {
      // Set on CardScene (stable hit area)
      if (cardSceneRef.current) {
        cardSceneRef.current.style.setProperty(`--${key}`, value);
      }
      // Also set on CardContainer (for direct child access)
      if (cardRef.current) {
        cardRef.current.style.setProperty(`--${key}`, value);
      }
    });
  };
  
  // Apply card attributes from cardData
  const {
    rarity,
    patternInfo,
    backgroundColor,
    baseBackground,
    imagePath,
    customImageUrl, // Support for direct custom image URLs
    customHoloImageUrl, // Support for custom holographic effect images
    effectParams,
    imageEffects,
    borderEffects,
    holoEffects // New holo effect toggles
  } = cardData || {};
  
  // Determine holographic effect class based on manual toggles, not just rarity
  const getActiveHoloClass = () => {
    if (!holoEffects) return '';
    
    // Check which holo effects are manually toggled ON
    if (holoEffects.rareHoloGalaxy) return 'rare-holo-galaxy';
    if (holoEffects.rareHolo) return 'rare-holo';
    if (holoEffects.wowaHolo) return 'wowa-holo';
    if (holoEffects.rareHoloVmax) return 'rare-holo-vmax';

    
    // Fallback to rarity-based if no manual toggles
    return cardData ? getHolographicEffectClass(rarity) : '';
  };
  
  const holoShineClass = getActiveHoloClass();
  
  // Handle mouse movement for interactive card effects
  const handleMouseMove = (e) => {
    if (!isInteractive || !cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    
    // Calculate center of the card
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate rotation values
    const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 15;
    const rotateX = ((e.clientY - centerY) / (rect.height / 2)) * -15;
    
    // Calculate mouse position relative to card (0-100%)
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const x = (mouseX / rect.width) * 100;
    const y = (mouseY / rect.height) * 100;
    
    // Calculate distance from center (for effect intensity)
    const distanceX = (mouseX - (rect.width / 2)) / (rect.width / 2);
    const distanceY = (mouseY - (rect.height / 2)) / (rect.height / 2);
    const hyp = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    
    // Calculate shine angle
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    
    // Set CSS variables for holographic effects
    setCardCSSVariables({
      mx: `${x}%`,
      my: `${y}%`,
      posx: `${x}%`,
      posy: `${y}%`,
      hyp: hyp.toFixed(2),
      'holo-angle': `${angle}deg`,
      'edge-angle': `${angle + 90}deg`,
      // Normalised tilt (-1..1) drives the parallax depth shift.
      'tilt-x': distanceX.toFixed(3),
      'tilt-y': distanceY.toFixed(3)
    });
    // (Param-derived variables are applied by the cardData effect; here we only
    // update the mouse-driven ones.)

    // Calculate and set the secondary hues for gradient
    const baseHue = cardRef.current?.style.getPropertyValue('--base-hue').trim() || 220;
    setCardCSSVariables({
      'second-hue': `${(parseInt(baseHue) + 60) % 360}`,
      'third-hue': `${(parseInt(baseHue) + 180) % 360}`
    });
    
    // Apply transform directly to match the working HTML version
    const transform = `
      rotateY(${rotateY}deg)
      rotateX(${rotateX}deg)
      translateZ(50px)
      ${isFlipped ? 'rotateY(180deg)' : ''}
    `;
    cardRef.current.style.transform = transform;
    
    // Update React state for other component behaviors
    setIsMoving(true);
  };
  
  // Handle mouse enter to activate effects
  const handleMouseEnter = () => {
    pointerActiveRef.current = true;
    if (!isInteractive || !cardRef.current) return;


    // Add moving class and remove floating class
    cardRef.current.classList.add('moving');
    cardRef.current.classList.remove('floating');

    setIsMoving(true);
  };

  // Return the card to its rest state (classes, transform, CSS vars).
  const resetToRest = () => {
    if (!isInteractive || !cardRef.current) return;

    // Add floating class and remove moving class
    cardRef.current.classList.remove('moving');
    cardRef.current.classList.add('floating');

    // Reset transform directly
    const transform = isFlipped ? 'rotateY(180deg)' : '';
    cardRef.current.style.transform = transform;

    // Reset CSS properties to center
    setCardCSSVariables({
      mx: '50%',
      my: '50%',
      posx: '50%',
      posy: '50%',
      hyp: '0',
      'tilt-x': '0',
      'tilt-y': '0'
    });

    // Update React state
    setIsMoving(false);
  };

  // Handle mouse leave to deactivate effects
  const handleMouseLeave = () => {
    pointerActiveRef.current = false;
    // The tour owns the card while active — don't snap back to rest.
    if (autoTour) return;
    resetToRest();
  };
  
  // Handle card click for flip
  const handleCardClick = () => {
    if (!isInteractive) return;
    setIsFlipped(!isFlipped);
    if (onClick) onClick();
  };
  
  // Handle touch events for mobile
  const handleTouchMove = (e) => {
    if (!isInteractive || !cardRef.current || e.touches.length === 0) return;
    e.preventDefault();
    const touch = e.touches[0];
    handleMouseMove({
      clientX: touch.clientX,
      clientY: touch.clientY
    });
  };

  // Initialize with floating class
  useEffect(() => {
    if (cardRef.current && isInteractive) {
      console.log('Initializing card with floating class');
      cardRef.current.classList.add('floating');
    }
  }, [isInteractive]);
  
  // Apply every parameter-derived CSS variable whenever cardData changes, so
  // customizer changes are visible immediately — not only after a mouse move.
  // Variables are set on the container and inherit to every effect layer.
  useEffect(() => {
    if (!cardData) return;
    const vars = {};
    const pct = (v) => (typeof v === 'number' || /^[\d.]+$/.test(String(v)) ? `${v}%` : v);

    // Generic effect parameters (legacy camelCase names kept for compatibility)
    if (effectParams && typeof effectParams === 'object') {
      Object.assign(vars, effectParams);
      if (effectParams.space !== undefined) vars['space'] = pct(effectParams.space);
      if (effectParams.holoAngle !== undefined) vars['holo-angle'] = `${effectParams.holoAngle}deg`;
      if (effectParams.parallaxDepth !== undefined) vars['parallax-depth'] = effectParams.parallaxDepth;
      // The generic filter sliders drive the tier-specific filter variables
      if (effectParams.filterBrightness !== undefined) {
        vars['rare-holo-galaxy-brightness'] = effectParams.filterBrightness;
        vars['rare-holo-vmax-brightness'] = effectParams.filterBrightness;
      }
      if (effectParams.filterContrast !== undefined) {
        vars['rare-holo-galaxy-contrast'] = effectParams.filterContrast;
        vars['rare-holo-vmax-contrast'] = effectParams.filterContrast;
      }
      if (effectParams.filterSaturate !== undefined) {
        vars['rare-holo-galaxy-saturation'] = effectParams.filterSaturate;
      }
    }

    // Border / image layer parameters
    if (borderEffects) {
      if (borderEffects.color) vars['border-color'] = borderEffects.color;
      if (borderEffects.opacity !== undefined) vars['border-opacity'] = borderEffects.opacity;
      if (borderEffects.colorHover) vars['border-color-hover'] = borderEffects.colorHover;
      if (borderEffects.opacityHover !== undefined) vars['border-opacity-hover'] = borderEffects.opacityHover;
      if (borderEffects.transitionDuration !== undefined) vars['border-transition-duration'] = `${borderEffects.transitionDuration}s`;
    }
    if (imageEffects) {
      if (imageEffects.opacity !== undefined) vars['image-opacity'] = imageEffects.opacity;
      if (imageEffects.opacityHover !== undefined) vars['image-opacity-hover'] = imageEffects.opacityHover;
      if (imageEffects.contrast !== undefined) vars['image-contrast'] = imageEffects.contrast;
      if (imageEffects.saturation !== undefined) vars['image-saturation'] = imageEffects.saturation;
      if (imageEffects.blendMode) vars['image-blend'] = imageEffects.blendMode;
      if (imageEffects.maskOpacity !== undefined) vars['mask-opacity'] = imageEffects.maskOpacity;
    }

    // Rare holo (rainbow) parameters — consumed by the holo-shine layers
    const rare = cardData.rareHoloParams;
    if (rare) {
      if (rare.space !== undefined) vars['rare-holo-space'] = pct(rare.space);
      if (rare.hue !== undefined) vars['rare-holo-h'] = rare.hue;
      if (rare.saturation !== undefined) vars['rare-holo-s'] = pct(rare.saturation);
      if (rare.lightness !== undefined) vars['rare-holo-l'] = pct(rare.lightness);
      if (rare.blendMode) vars['rare-holo-blend-mode'] = rare.blendMode;
      if (rare.filterStrength !== undefined) vars['rare-holo-filter-strength'] = rare.filterStrength;
      // Mouse response speed: higher value → snappier card tilt (shorter transition).
      if (rare.mouseSpeed !== undefined && rare.mouseSpeed > 0) {
        vars['card-tilt-speed'] = `${(0.1 / rare.mouseSpeed).toFixed(3)}s`;
      }
      (rare.colors || []).forEach((color, i) => { vars[`rare-holo-color-${i + 1}`] = color; });
      if (rare.backgroundImage) vars['rare-holo-background-image'] = `url(${rare.backgroundImage})`;
    }

    // Galaxy parameters
    const galaxy = cardData.rareHoloGalaxyParams;
    if (galaxy) {
      if (galaxy.space !== undefined) vars['rare-holo-galaxy-space'] = pct(galaxy.space);
      if (galaxy.blendMode) vars['rare-holo-galaxy-blend-mode'] = galaxy.blendMode;
      if (galaxy.gradientSize !== undefined) vars['rare-holo-galaxy-gradient-size'] = pct(galaxy.gradientSize);
      if (galaxy.gradientHeight !== undefined) vars['rare-holo-galaxy-gradient-height'] = pct(galaxy.gradientHeight);
      if (galaxy.brightness !== undefined) vars['rare-holo-galaxy-brightness'] = galaxy.brightness;
      if (galaxy.contrast !== undefined) vars['rare-holo-galaxy-contrast'] = galaxy.contrast;
      if (galaxy.saturation !== undefined) vars['rare-holo-galaxy-saturation'] = galaxy.saturation;
      if (galaxy.smoothTransitions !== undefined) {
        vars['rare-holo-galaxy-smooth-transitions'] = galaxy.smoothTransitions;
        for (let i = 1; i <= 11; i++) {
          vars[`rare-holo-galaxy-overlap-${i}`] = 1.0 + (galaxy.smoothTransitions * 0.8) + (i - 1);
        }
      }
      (galaxy.colors || []).forEach((color, i) => { vars[`rare-holo-galaxy-color-${i + 1}`] = color; });
      if (galaxy.backgroundImage) vars['rare-holo-galaxy-background-image'] = `url(${galaxy.backgroundImage})`;
    }

    // Wowa parameters — the wowa shine layer reads the generic --angle / --space.
    const wowa = cardData.wowaHoloParams;
    if (wowa) {
      if (wowa.angle !== undefined) vars['angle'] = `${wowa.angle}deg`;
      if (wowa.space !== undefined) vars['space'] = pct(wowa.space);
      if (wowa.backgroundImage) vars['wowa-holo-background-image'] = `url(${wowa.backgroundImage})`;
    }

    // Vmax parameters
    const vmax = cardData.rareHoloVmaxParams;
    if (vmax) {
      if (vmax.space !== undefined) vars['rare-holo-vmax-space'] = pct(vmax.space);
      if (vmax.angle !== undefined) vars['rare-holo-vmax-angle'] = `${vmax.angle}deg`;
      if (vmax.brightness !== undefined) vars['rare-holo-vmax-brightness'] = vmax.brightness;
      if (vmax.contrast !== undefined) vars['rare-holo-vmax-contrast'] = vmax.contrast;
      if (vmax.backgroundImage) vars['rare-holo-vmax-background-image'] = `url(${vmax.backgroundImage})`;
    }

    setCardCSSVariables(vars);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardData, holoEffects, customHoloImageUrl]);

  // Auto tour: a synthetic pointer orbits the card, driving the exact same
  // tilt/shine math as a real hover — this is how touch screens (no hover)
  // get to see the holographic effects move. A real pointer pauses it.
  useEffect(() => {
    if (!autoTour || !isInteractive || !cardRef.current) return;
    const card = cardRef.current;
    card.classList.add('moving');
    card.classList.remove('floating');
    setIsMoving(true);

    let raf;
    const started = performance.now();
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      if (pointerActiveRef.current || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      // A slow lissajous sweep — covers corners and edges, never repeats
      // exactly, and stays gentle enough to read the card.
      const phase = ((t - started) / 7000) * Math.PI * 2;
      const nx = Math.sin(phase) * 0.6;
      const ny = Math.cos(phase * 0.8) * 0.45;
      handleMouseMove({
        clientX: rect.left + rect.width / 2 + nx * (rect.width / 2),
        clientY: rect.top + rect.height / 2 + ny * (rect.height / 2)
      });
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      // Hand the card back to rest unless a real pointer holds it.
      if (!pointerActiveRef.current) resetToRest();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTour, isInteractive]);

  // Early return if no card data
  if (!cardData) return null;
  
  // Load image URL
  // Handle both custom image URLs and regular image paths
  const imageUrl = imagePath === 'custom_image' && customImageUrl
    ? customImageUrl
    : `/assets/card_images/${imagePath}`;
  
  return (
    <S.CardScene 
      ref={cardSceneRef}
      className="card-scene"
      // IMPORTANT: Mouse events AND CSS variables are on CardScene instead of CardContainer to fix Chrome corner issues
      // Chrome has problems with 3D transforms and isolation: isolate causing rapid enter/leave events
      // CardScene has stable hit area without 3D transforms, preventing the diamond-shaped hit area bug
      // This fixes both hover detection AND shiny mouse effects in Chrome corners
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchStart={handleMouseEnter}
      onTouchEnd={handleMouseLeave}
    >
      <S.CardContainer
        ref={cardRef}
        $isFlipped={isFlipped}
        $isInteractive={isInteractive}
        onClick={handleCardClick}
        data-rarity={holoShineClass}
        className={`card-container ${holoShineClass}`}
        style={{
          '--effect-intensity': isMoving ? '1' : '0',
        }}
      >
        <S.EdgeHighlight
          className="edge-highlight"
          style={{
            '--edge-color1': borderEffects?.edgeColor1 || 'rgba(255, 255, 255, 0.5)',
            '--edge-color2': borderEffects?.edgeColor2 || 'rgba(0, 0, 0, 0)'
          }}
        />
        
        <S.CardElement $isFlipped={isFlipped} className="card-element">
          <S.CardFace
            className="card-face"
            style={{
              // Prefer the structured base-background model; fall back to the
              // legacy backgroundColor object or a plain colour string.
              '--card-gradient': buildBaseBackground(baseBackground)
                || (backgroundColor && typeof backgroundColor === 'object'
                  ? (backgroundColor.isGradient ? backgroundColor.gradient : backgroundColor.color)
                  : backgroundColor),
              '--bg-vignette': baseBackground?.vignette ?? 0,
              '--bg-grain': baseBackground?.grain ?? 0
            }}
          >
            <S.DepthLayer className="depth-layer" />

            {/* Base-background texture layers: behind the image (z-index 1), so
                they show through as the image opacity drops. */}
            <S.BgVignette className="bg-vignette" />
            <S.BgGrain className="bg-grain" />
            
            {/* Pattern overlay with specific type */}
            <S.PatternOverlay
              className="pattern-overlay"
              style={{
                '--pattern': patternInfo.css,
                '--pattern-opacity': patternInfo.opacity,
                transform: patternInfo.transform || null,
                animation: patternInfo.animation ? patternInfo.animation : null
              }}
            />
            
            {/* Card image - custom R2 URL when provided, else a generated filler.
                A missing image is hidden (tracked per-src) rather than swapped to
                another path, so a 404 can't loop and flicker. */}
            <S.CardImage className="card-image">
              {imageUrl && failedSrc !== imageUrl && (
                <img
                  src={imageUrl}
                  alt="Card Illustration"
                  onError={() => setFailedSrc(imageUrl)}
                />
              )}
            </S.CardImage>
            
            {/* Thick integrated border (Pokemon style) - moved here for proper layering */}
            <S.CardBorder
              className="card-border central-panel"
              style={{
                '--border-color': borderEffects?.color || 'rgb(255, 215, 0)',
                '--border-opacity': borderEffects?.opacity ?? '0.2',
                'display': borderEffects?.thickBorderEnabled ? 'block' : 'none'
              }}
            />
            
            {/* Blurred card image for the border */}
            <S.CardBorderImage
              className="card-border-image"
              style={{
                '--card-image': `url(${imageUrl})`,
                '--border-image-opacity': borderEffects?.imageOpacity ?? '0.7',
                '--initial-blur': 'blur(2px)',
                '--hover-blur': 'blur(0.5px)',
                '--hover-opacity': '0.9',
                'display': (borderEffects?.thickBorderEnabled && borderEffects?.borderImageEnabled !== false) ? 'block' : 'none'
              }}
            />
            
            {/* Holographic layers. The overlay image is one technique among
                five — it stacks with the animated systems rather than
                replacing them. */}
            {customHoloImageUrl && (
              <CustomHoloEffect
                className="custom-holo-effect"
                $active={true}
                $imageUrl={customHoloImageUrl}
                $blendMode={effectParams?.customHoloBlendMode || 'color-dodge'}
              />
            )}
            {(
              <>
                {/* Render holo effects with custom background images */}
                {(() => {
                  // Check if any holo effect has a custom background image
                  const hasCustomBackground = 
                    (cardData.rareHoloParams?.backgroundImage) ||
                    (cardData.rareHoloGalaxyParams?.backgroundImage) ||
                    (cardData.wowaHoloParams?.backgroundImage) ||
                    (cardData.rareHoloVmaxParams?.backgroundImage);
                  
                  
                  return hasCustomBackground && (
                    <>
                      {/* Render custom background images for each holo effect */}
                      {cardData.rareHoloParams?.backgroundImage && holoEffects?.rareHolo && (
                        <S.HoloBackgroundImage
                          ref={(el) => {
                            if (el && cardData.rareHoloParams) {
                              // Apply Rainbow Colors CSS variables to this component
                              if (cardData.rareHoloParams.colors) {
                                cardData.rareHoloParams.colors.forEach((color, index) => {
                                  el.style.setProperty(`--rare-holo-color-${index + 1}`, color);
                                });
                              }
                              if (cardData.rareHoloParams.space !== undefined) {
                                el.style.setProperty('--rare-holo-space', `${cardData.rareHoloParams.space}%`);
                              }
                              if (cardData.rareHoloParams.hue !== undefined) {
                                el.style.setProperty('--rare-holo-h', cardData.rareHoloParams.hue);
                              }
                              if (cardData.rareHoloParams.saturation !== undefined) {
                                el.style.setProperty('--rare-holo-s', `${cardData.rareHoloParams.saturation}%`);
                              }
                              if (cardData.rareHoloParams.lightness !== undefined) {
                                el.style.setProperty('--rare-holo-l', `${cardData.rareHoloParams.lightness}%`);
                              }
                            }
                          }}
                          className="rare-holo-background"
                          $className="rare-holo-background"
                          $imageUrl={cardData.rareHoloParams.backgroundImage}
                          $active={true}
                        />
                      )}
                      
                      {cardData.rareHoloGalaxyParams?.backgroundImage && holoEffects?.rareHoloGalaxy && (
                        <S.HoloBackgroundImage
                          ref={(el) => {
                            if (el && cardData.rareHoloGalaxyParams?.colors) {
                              // Apply Galaxy Colors CSS variables to this component
                              cardData.rareHoloGalaxyParams.colors.forEach((color, index) => {
                                el.style.setProperty(`--rare-holo-galaxy-color-${index + 1}`, color);
                              });
                              if (cardData.rareHoloGalaxyParams.space !== undefined) {
                                el.style.setProperty('--rare-holo-galaxy-space', `${cardData.rareHoloGalaxyParams.space}%`);
                              }
                              if (cardData.rareHoloGalaxyParams.blendMode !== undefined) {
                                el.style.setProperty('--rare-holo-galaxy-blend-mode', cardData.rareHoloGalaxyParams.blendMode);
                              }
                              if (cardData.rareHoloGalaxyParams.gradientSize !== undefined) {
                                el.style.setProperty('--rare-holo-galaxy-gradient-size', `${cardData.rareHoloGalaxyParams.gradientSize}%`);
                              }
                              if (cardData.rareHoloGalaxyParams.gradientHeight !== undefined) {
                                el.style.setProperty('--rare-holo-galaxy-gradient-height', `${cardData.rareHoloGalaxyParams.gradientHeight}%`);
                              }
                              if (cardData.rareHoloGalaxyParams.smoothTransitions !== undefined) {
                                el.style.setProperty('--rare-holo-galaxy-smooth-transitions', cardData.rareHoloGalaxyParams.smoothTransitions);
                                // Calculate overlap values for each color: 1.0 (no overlap) to 1.8 (max overlap)
                                for (let i = 1; i <= 11; i++) {
                                  const overlapValue = 1.0 + (cardData.rareHoloGalaxyParams.smoothTransitions * 0.8) + (i - 1);
                                  el.style.setProperty(`--rare-holo-galaxy-overlap-${i}`, overlapValue);
                                }
                              }
                            }
                          }}
                          className="rare-holo-galaxy-background"
                          $className="rare-holo-galaxy-background"
                          $imageUrl={cardData.rareHoloGalaxyParams.backgroundImage}
                          $active={true}
                        />
                      )}
                      
                      {cardData.wowaHoloParams?.backgroundImage && holoEffects?.wowaHolo && (
                        <S.HoloBackgroundImage
                          className="wowa-holo-background"
                          $imageUrl={cardData.wowaHoloParams.backgroundImage}
                          $active={true}
                        />
                      )}
                      
                      {cardData.rareHoloVmaxParams?.backgroundImage && holoEffects?.rareHoloVmax && (
                        <S.HoloBackgroundImage
                          className="rare-holo-vmax-background"
                          $imageUrl={cardData.rareHoloVmaxParams.backgroundImage}
                          $active={true}
                        />
                      )}
                    </>
                  );
                })()}
                
                {/* Original CSS-based holo effects (subtle mode) */}
                <S.HoloShine 
                  className="rare-holo holo-shine" 
                  $active={holoEffects?.rareHolo && cardData.rareHoloParams?.intensity !== 'extreme'} 
                  data-intensity={cardData.rareHoloParams?.intensity || 'subtle'}
                />
                
                {/* Extreme mode - layered architecture */}
                {holoEffects?.rareHolo && cardData.rareHoloParams?.intensity === 'extreme' && (
                  <S.HoloBackgroundImage
                    ref={(el) => {
                      if (el && cardData.rareHoloParams) {
                        // Apply Rainbow Colors CSS variables to this component
                        if (cardData.rareHoloParams.colors) {
                          cardData.rareHoloParams.colors.forEach((color, index) => {
                            el.style.setProperty(`--rare-holo-color-${index + 1}`, color);
                          });
                        }
                        if (cardData.rareHoloParams.space !== undefined) {
                          el.style.setProperty('--rare-holo-space', `${cardData.rareHoloParams.space}%`);
                        }
                        if (cardData.rareHoloParams.hue !== undefined) {
                          el.style.setProperty('--rare-holo-h', cardData.rareHoloParams.hue);
                        }
                        if (cardData.rareHoloParams.saturation !== undefined) {
                          el.style.setProperty('--rare-holo-s', `${cardData.rareHoloParams.saturation}%`);
                        }
                        if (cardData.rareHoloParams.lightness !== undefined) {
                          el.style.setProperty('--rare-holo-l', `${cardData.rareHoloParams.lightness}%`);
                        }
                        if (cardData.rareHoloParams.filterStrength !== undefined) {
                          el.style.setProperty('--rare-holo-filter-strength', cardData.rareHoloParams.filterStrength);
                        }
                        if (cardData.rareHoloParams.blendMode !== undefined) {
                          el.style.setProperty('--rare-holo-blend-mode', cardData.rareHoloParams.blendMode);
                        }
                      }
                    }}
                    className="rare-holo-background"
                    $className="rare-holo-background"
                    $imageUrl={cardData.rareHoloParams?.backgroundImage || "/assets/img/shine1.png"}
                    $active={true}
                    data-intensity="extreme"
                  />
                )}
                <S.HoloShine 
                  className="rare-holo-galaxy holo-shine" 
                  $active={holoEffects?.rareHoloGalaxy && !cardData.rareHoloGalaxyParams?.backgroundImage} 
                />
                <S.HoloShine 
                  className="wowa-holo holo-shine" 
                  $active={holoEffects?.wowaHolo && !cardData.wowaHoloParams?.backgroundImage} 
                />
                <S.HoloShine 
                  className="rare-holo-vmax holo-shine" 
                  $active={holoEffects?.rareHoloVmax && !cardData.rareHoloVmaxParams?.backgroundImage} 
                />

              </>
            )}
            
            {/* Image shine effect */}
            <S.ImageShine className="image-shine" />

            {/* Thin edge border */}
            <S.ThinEdgeBorder
              className="thin-edge-border"
              style={{
                /* Pass gradient colors for the edge highlight */
                '--edge-angle': 'var(--edge-angle, 45deg)',
                '--edge-color1': borderEffects?.thinEdgeColor || 'rgba(255, 255, 255, 0.8)',
                '--edge-color2': borderEffects?.thinEdgeColor || 'rgba(255, 215, 0, 0.6)',
                'display': borderEffects?.thinEdgeEnabled ? 'block' : 'none'
              }}
            />
          </S.CardFace>
          
          <S.CardBack className="card-back" />
        </S.CardElement>
      </S.CardContainer>
    </S.CardScene>
  );
};

export default Card;
