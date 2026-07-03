import { useState, useRef, useEffect } from 'react';
import * as S from './Card.styles';
import PropTypes from 'prop-types';
import { getHolographicEffectClass } from '../../utils/cardGenerator';
import { loopPhase, inShinyZone } from '../../utils/cardMotion';
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

const Card = ({ cardData, isInteractive = true, onClick, scrub = false, loop = false }) => {
  const [isMoving, setIsMoving] = useState(false);
  const [failedSrc, setFailedSrc] = useState(null); // hides an image that 404s, per-src, so it can't flicker
  const [loadedSrc, setLoadedSrc] = useState(null); // art fades in when its pixels arrive, instead of popping
  const cardRef = useRef(null);
  const cardSceneRef = useRef(null);
  // True while a real pointer is over the card — the loop yields to it.
  const pointerActiveRef = useRef(false);

  // Driven modes: the card rides the GLOBAL motion clock (see cardMotion.js),
  // so every driven card on a page moves in sync. `scrub` also renders the
  // bar beside the card; `loop` rides the clock without its own bar (grids).
  // The clock's phase maps to the pose — the run is two full orbits, so 0 and
  // 1 are the same pose and the loop wraps seamlessly. Crossing the shiny
  // zone fades the holo layers in/out; the motion itself never changes.
  const driven = (scrub || loop) && isInteractive;
  // Touch screens can't hover, so in driven mode the bar is the ONLY control
  // there — direct touch on the card stays off (dragging a finger over the
  // card is janky). Desktops keep the mouse: hovering takes the card over,
  // leaving hands it back to the loop.
  const [coarse] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches
  );
  const directPointer = !(driven && coarse);
  const shinyRef = useRef(null); // last shiny state; null forces a re-apply
  
  // Set CSS variables on CardScene; every consumer lives below it and
  // inherits them. Used for the PER-CARD parameter variables only (the
  // cardData effect) — writing any custom property on the scene invalidates
  // the whole var-heavy subtree, so doing it per frame was the main source
  // of the "hot phone" style-recalc cost. Per-FRAME pose variables go
  // through writeFrameVars below, scoped to the consuming layers.
  const setCardCSSVariables = (variables) => {
    const el = cardSceneRef.current || cardRef.current;
    if (!el) return;
    Object.entries(variables).forEach(([key, value]) => {
      el.style.setProperty(`--${key}`, value);
    });
  };

  // The pose-driven variables are written straight onto the elements whose
  // styles read them — invalidating a handful of tiny subtrees instead of
  // the whole card. Cached per card; the cardData effect clears the cache
  // (holo layers mount/unmount with their toggles).
  const frameLayersRef = useRef(null);
  const getFrameLayers = () => {
    if (!frameLayersRef.current && cardSceneRef.current) {
      const scene = cardSceneRef.current;
      frameLayersRef.current = {
        // every element whose styles read the shine/tilt pose variables
        shine: [...scene.querySelectorAll(
          '.holo-shine, .rare-holo-background, .rare-holo-galaxy-background, '
          + '.wowa-holo-background, .rare-holo-vmax-background, '
          + '.custom-holo-effect, .image-shine, .card-image'
        )],
        // the ONLY layers visible at rest that read a pose variable
        // (their gradients follow --edge-angle at opacity 0.5)
        edges: [...scene.querySelectorAll('.edge-highlight, .thin-edge-border')],
      };
    }
    return frameLayersRef.current;
  };
  const writeFrameVars = (els, variables) => {
    for (const el of els) {
      for (const key in variables) el.style.setProperty(key, variables[key]);
    }
  };

  // Apply one pose to the DOM. `shine: false` (card fully rested — every
  // shine consumer is invisible) skips down to the edge gradients and the
  // transform, which is nearly free by comparison.
  const applyPose = (x, y, hyp, angle, nx, ny, rotateY, rotateX, shine) => {
    const layers = getFrameLayers();
    if (!layers || !cardRef.current) return;
    if (shine) {
      writeFrameVars(layers.shine, {
        '--mx': `${x}%`,
        '--my': `${y}%`,
        '--posx': `${x}%`,
        '--posy': `${y}%`,
        '--hyp': hyp.toFixed(2),
        '--holo-angle': `${angle}deg`,
        // Normalised tilt (-1..1) drives the parallax depth shift.
        '--tilt-x': nx.toFixed(3),
        '--tilt-y': ny.toFixed(3)
      });
    }
    writeFrameVars(layers.edges, { '--edge-angle': `${angle + 90}deg` });
    // Apply transform directly to match the working HTML version
    cardRef.current.style.transform = `
      rotateY(${rotateY}deg)
      rotateX(${rotateX}deg)
      translateZ(50px)
    `;
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
  
  // Drive the tilt + shine math from a pointer position (real or synthetic).
  // Pure geometry — does not touch the moving/floating state, so the tour can
  // keep the card in motion while the effects are gated separately.
  const drivePointer = (e) => {
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

    // (Param-derived variables — including the gradient's companion hues —
    // are applied by the cardData effect; here only the pointer-driven ones.)
    applyPose(x, y, hyp, angle, distanceX, distanceY, rotateY, rotateX, true);
  };

  // Drive the same tilt + shine math from a NORMALISED pose (nx, ny in
  // -1..1) with ZERO DOM reads. The driven loop calls this every frame;
  // drivePointer's getBoundingClientRect forced a style+layout flush per
  // call, which (at 60fps, twice a frame) was the main-thread heat on
  // phones. Formulas are drivePointer's exactly, with the live rect replaced
  // by the card's fixed aspect ratio (420/300 = 364/260 = 1.4 at every
  // size), so the output is pixel-identical.
  const CARD_ASPECT = 1.4;
  const drivePose = (nx, ny, shine = true) => {
    if (!isInteractive || !cardRef.current) return;
    const x = (nx + 1) * 50;
    const y = (ny + 1) * 50;
    const hyp = Math.sqrt(nx * nx + ny * ny);
    const angle = Math.atan2(ny * CARD_ASPECT, nx) * (180 / Math.PI);
    applyPose(x, y, hyp, angle, nx, ny, nx * 15, ny * -15, shine);
  };

  // The motion bar overflows the card face but lives inside the scene, so
  // its pointer traffic bubbles into these handlers. The bar is a control
  // surface, not card: hovering it must release the card (back to the loop),
  // not tilt it — otherwise reaching for pause drags the card around.
  const overBar = (e) => !!e?.target?.closest?.('.scrub-track');

  // Handle mouse movement for interactive card effects
  const handleMouseMove = (e) => {
    if (!isInteractive || !cardRef.current) return;
    if (overBar(e)) {
      if (pointerActiveRef.current) handleMouseLeave();
      return;
    }
    // Crossing back from the bar onto the card re-takes ownership — the
    // scene's own mouseenter won't fire again (the bar is inside it).
    if (!pointerActiveRef.current) handleMouseEnter();
    drivePointer(e);
    setIsMoving(true);
  };

  // Handle mouse enter to activate effects
  const handleMouseEnter = (e) => {
    if (overBar(e)) return; // entered the scene via the bar — card stays loop-driven
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
    cardRef.current.style.transform = '';

    // Reset CSS properties to center (on the consuming layers, where the
    // per-frame writes live — a scene-level reset would be shadowed).
    const layers = getFrameLayers();
    if (layers) {
      writeFrameVars(layers.shine, {
        '--mx': '50%',
        '--my': '50%',
        '--posx': '50%',
        '--posy': '50%',
        '--hyp': '0',
        '--tilt-x': '0',
        '--tilt-y': '0'
      });
    }

    // Update React state
    setIsMoving(false);
  };

  // Handle mouse leave to deactivate effects
  const handleMouseLeave = () => {
    pointerActiveRef.current = false;
    // Driven cards hand straight back to the loop — the next frame re-drives
    // the pose, and a cleared shiny state forces the holo gate to re-apply.
    if (driven) {
      shinyRef.current = null;
      return;
    }
    resetToRest();
  };
  
  // Click-to-flip was removed: the card has no real back face, so flipping
  // just mirrored it. A click only forwards to the caller's handler now.
  const handleCardClick = () => {
    if (!isInteractive) return;
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
    // Holo layers mount/unmount with their toggles — refresh the per-frame
    // write targets on the next pose application.
    frameLayersRef.current = null;
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
      // Generated cards store borderColor/borderOpacity; the customizer writes
      // color/opacity. Accept both so random designs keep their rolled tint.
      const panelColor = borderEffects.color || borderEffects.borderColor;
      const panelOpacity = borderEffects.opacity ?? borderEffects.borderOpacity;
      if (panelColor) vars['border-color'] = panelColor;
      if (panelOpacity !== undefined) vars['border-opacity'] = panelOpacity;
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
      if (wowa.brightness !== undefined) vars['wowa-holo-brightness'] = wowa.brightness;
      if (wowa.contrast !== undefined) vars['wowa-holo-contrast'] = wowa.contrast;
      if (wowa.backgroundImage) vars['wowa-holo-background-image'] = `url(${wowa.backgroundImage})`;
    }

    // Veil (sheen) parameters — the restored card-wide holo knobs. Every one
    // has a neutral CSS fallback, so cards saved before these existed render
    // exactly as they always did.
    if (effectParams) {
      if (effectParams.sheenAngle !== undefined) vars['sheen-angle'] = `${effectParams.sheenAngle}deg`;
      if (effectParams.sheenSpace !== undefined) vars['sheen-space'] = pct(effectParams.sheenSpace);
      if (effectParams.sheenShine !== undefined) vars['sheen-shine'] = effectParams.sheenShine;
      if (effectParams.sheenBrightness !== undefined) vars['sheen-brightness'] = effectParams.sheenBrightness;
      if (effectParams.sheenContrast !== undefined) vars['sheen-contrast'] = effectParams.sheenContrast;
      if (effectParams.sheenSaturate !== undefined) vars['sheen-saturate'] = effectParams.sheenSaturate;
      if (effectParams.sheenDrift !== undefined) vars['sheen-drift'] = effectParams.sheenDrift;
      if (effectParams.veilPresence !== undefined) vars['veil-presence'] = effectParams.veilPresence;
      // Chromatic aberration finally has a visual: RGB ghosts on the Veil
      // layer. The field has always fed the authentic-rarity score.
      if (effectParams.aberrationIntensity !== undefined) vars['sheen-ab'] = effectParams.aberrationIntensity;
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

    // The gradient's companion hues derive from the base hue, which is
    // static per card — computed here once, not on every animation frame
    // (same fallback chain drivePointer used to run per frame).
    const baseHue = vars['base-hue']
      ?? (cardRef.current?.style.getPropertyValue('--base-hue').trim() || 220);
    vars['second-hue'] = `${(parseInt(baseHue) + 60) % 360}`;
    vars['third-hue'] = `${(parseInt(baseHue) + 180) % 360}`;

    setCardCSSVariables(vars);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardData, holoEffects, customHoloImageUrl]);

  // Driven mode: every frame reads the GLOBAL clock's phase and drives the
  // same tilt math as a real hover. Pausing the clock freezes the phase, so
  // the card simply holds its pose; dragging any bar scrubs the clock and the
  // card follows. Off-screen cards (collection grids) skip the work entirely.
  useEffect(() => {
    if (!driven || !cardRef.current) return;
    cardRef.current.classList.remove('floating');
    let raf;
    let visible = true;
    let lastP = -1;
    // Longest .moving fade is 0.4s; the grace keeps shine variables live
    // well past it so a fade-out never freezes mid-shimmer.
    const SHINE_FADE_GRACE_MS = 800;
    let shinyExitAt = -Infinity;
    const io = typeof IntersectionObserver !== 'undefined' && cardSceneRef.current
      ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; })
      : null;
    if (io) io.observe(cardSceneRef.current);
    // The rAF timestamp is shared by every callback in a frame, so all synced
    // cards compute the IDENTICAL phase — exact sync, not near-sync.
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      if (!cardRef.current || !visible) return;
      if (pointerActiveRef.current) return; // a real pointer owns the card
      const p = loopPhase(t);
      // Paused clock → same phase → nothing to redraw (unless a hover just
      // ended and cleared the shiny state to force a re-apply).
      if (p === lastP && shinyRef.current !== null) return;
      lastP = p;
      const shiny = inShinyZone(p);
      if (shiny !== shinyRef.current) {
        shinyRef.current = shiny;
        cardRef.current.classList.toggle('moving', shiny);
        setIsMoving(shiny);
        if (!shiny) shinyExitAt = t; // fade-out starts now
      }
      const angle = p * Math.PI * 4; // two full orbits over the run
      // Pure math into drivePose — no getBoundingClientRect, no forced
      // style/layout flushes: the frame does one style pass, at render.
      // Shine variables keep updating through the fade-out (grace window >
      // the longest .moving transition), then stop while fully rested.
      const shineLive = shiny || (t - shinyExitAt) < SHINE_FADE_GRACE_MS;
      drivePose(Math.sin(angle) * 0.6, Math.cos(angle) * 0.45, shineLive);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); if (io) io.disconnect(); resetToRest(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driven]);

  // Early return if no card data
  if (!cardData) return null;
  
  // Load image URL
  // Handle both custom image URLs and regular image paths
  const imageUrl = imagePath === 'custom_image' && customImageUrl
    ? customImageUrl
    : `/assets/card_images/${imagePath}`;

  // Per-system image-layer presentation. Presence (how solid the image sits
  // at rest), blend mode and gradient-suppression ride on the element itself,
  // so several systems can each layer their own image at once. Cards saved
  // before these fields existed hit the CSS fallbacks: invisible at rest,
  // soft-light, gradient replaced — the old behaviour exactly.
  const imageLayerProps = (p) => ({
    style: {
      ...(p?.imagePresence !== undefined ? { '--holo-image-presence': p.imagePresence } : {}),
      ...(p?.imageBlendMode ? { '--holo-image-blend': p.imageBlendMode } : {}),
      // New-style layers drop the old darkening filter (built for faint
      // soft-light texture) for a gentle tilt-shade that keeps the image legible.
      ...(p?.imagePresence !== undefined
        ? { '--holo-image-filter': 'brightness(calc(var(--hyp, 0) * 0.35 + 0.95)) saturate(1.15)' }
        : {})
    },
    'data-layered': p?.layerGradient ? 'true' : undefined
  });

  return (
    <S.CardScene 
      ref={cardSceneRef}
      className="card-scene"
      // IMPORTANT: Mouse events AND CSS variables are on CardScene instead of CardContainer to fix Chrome corner issues
      // Chrome has problems with 3D transforms and isolation: isolate causing rapid enter/leave events
      // CardScene has stable hit area without 3D transforms, preventing the diamond-shaped hit area bug
      // This fixes both hover detection AND shiny mouse effects in Chrome corners
      // Driven mode on touch screens: the bar is the only control — direct
      // touch is off, and the synthetic mouse events a tap fires must not
      // steal the card either. Desktops keep the mouse even while driven.
      onMouseMove={directPointer ? handleMouseMove : undefined}
      onMouseEnter={directPointer ? handleMouseEnter : undefined}
      onMouseLeave={directPointer ? handleMouseLeave : undefined}
      onTouchMove={directPointer ? handleTouchMove : undefined}
      onTouchStart={directPointer ? handleMouseEnter : undefined}
      onTouchEnd={directPointer ? handleMouseLeave : undefined}
    >
      <S.CardContainer
        ref={cardRef}
        $isInteractive={isInteractive}
        onClick={handleCardClick}
        data-rarity={holoShineClass}
        className={`card-container ${holoShineClass}`}
        style={{
          '--effect-intensity': isMoving ? '1' : '0',
          // Touch screens in driven mode take no direct input on the card, so
          // it must not compete for hits either: the tilted 3D face otherwise
          // beats the bar in hit-testing and swallows taps on the track.
          pointerEvents: !directPointer && !onClick ? 'none' : undefined,
        }}
      >
        <S.EdgeHighlight
          className="edge-highlight"
          style={{
            '--edge-color1': borderEffects?.edgeColor1 || 'rgba(255, 255, 255, 0.5)',
            '--edge-color2': borderEffects?.edgeColor2 || 'rgba(0, 0, 0, 0)'
          }}
        />
        
        <S.CardElement className="card-element">
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
                // Invisible until decoded: dropping the inline 0 hands opacity
                // back to the stylesheet, whose 0.3s transition fades it in.
                <img
                  src={imageUrl}
                  alt="Card Illustration"
                  style={loadedSrc === imageUrl ? undefined : { opacity: 0 }}
                  onLoad={() => setLoadedSrc(imageUrl)}
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
            
            {/* Holographic layers. Veil is one technique among five — it
                stacks with the animated systems rather than replacing them.
                It runs with its own image OR (new) as a hue-matched sheen
                gradient with no image; older cards without the explicit
                toggle are on exactly when they carry an image. */}
            {(holoEffects?.overlay ?? !!customHoloImageUrl) && (
              <CustomHoloEffect
                className="custom-holo-effect"
                $active={true}
                $imageUrl={customHoloImageUrl || null}
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
                          {...imageLayerProps(cardData.rareHoloParams)}
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
                          {...imageLayerProps(cardData.rareHoloGalaxyParams)}
                        />
                      )}
                      
                      {cardData.wowaHoloParams?.backgroundImage && holoEffects?.wowaHolo && (
                        <S.HoloBackgroundImage
                          className="wowa-holo-background"
                          $imageUrl={cardData.wowaHoloParams.backgroundImage}
                          $active={true}
                          {...imageLayerProps(cardData.wowaHoloParams)}
                        />
                      )}
                      
                      {cardData.rareHoloVmaxParams?.backgroundImage && holoEffects?.rareHoloVmax && (
                        <S.HoloBackgroundImage
                          className="rare-holo-vmax-background"
                          $imageUrl={cardData.rareHoloVmaxParams.backgroundImage}
                          $active={true}
                          {...imageLayerProps(cardData.rareHoloVmaxParams)}
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
                  $active={holoEffects?.rareHoloGalaxy && (!cardData.rareHoloGalaxyParams?.backgroundImage || cardData.rareHoloGalaxyParams?.layerGradient)} 
                />
                <S.HoloShine 
                  className="wowa-holo holo-shine" 
                  $active={holoEffects?.wowaHolo && (!cardData.wowaHoloParams?.backgroundImage || cardData.wowaHoloParams?.layerGradient)} 
                />
                <S.HoloShine 
                  className="rare-holo-vmax holo-shine" 
                  $active={holoEffects?.rareHoloVmax && (!cardData.rareHoloVmaxParams?.backgroundImage || cardData.rareHoloVmaxParams?.layerGradient)} 
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
        </S.CardElement>
      </S.CardContainer>

      {/* The motion bar beside the card: dot rides the global clock, dragging
          scrubs it, the button at the base pauses card motion everywhere. */}
      {scrub && isInteractive && <S.ScrubTrack className="scrub-track" />}
    </S.CardScene>
  );
};

export default Card;
