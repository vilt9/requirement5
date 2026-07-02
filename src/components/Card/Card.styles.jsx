import styled, { css, keyframes } from 'styled-components';

// Key animations for card effects
const chromaticShift = keyframes`
  0%, 100% {
    filter: hue-rotate(0deg) contrast(2);
  }
  50% {
    filter: hue-rotate(360deg) contrast(3);
  }
`;

const floatingCard = keyframes`
  0%, 100% {
    transform: translateY(0) rotateX(2deg);
  }
  50% {
    transform: translateY(-10px) rotateX(-2deg);
  }
`;

const gradientShift = keyframes`
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
`;

const patternRotate = keyframes`
  0% {
    transform: translateZ(1px) rotate(0deg);
  }
  100% {
    transform: translateZ(1px) rotate(360deg);
  }
`;

const patternShimmer = keyframes`
  0%, 100% {
    opacity: 0.9;
    filter: brightness(1);
  }
  50% {
    opacity: 0.7;
    filter: brightness(1.2);
  }
`;

const waveAnimation = keyframes`
  0% {
    background-position: 0% 0%;
  }
  100% {
    background-position: 100% 100%;
  }
`;

const noiseAnimation = keyframes`
  0% {
    transform: translate(0, 0);
  }
  10% {
    transform: translate(-5%, -5%);
  }
  20% {
    transform: translate(-10%, 5%);
  }
  30% {
    transform: translate(5%, -10%);
  }
  40% {
    transform: translate(-5%, 15%);
  }
  50% {
    transform: translate(-10%, 5%);
  }
  60% {
    transform: translate(15%, 0);
  }
  70% {
    transform: translate(0, 10%);
  }
  80% {
    transform: translate(-15%, 0);
  }
  90% {
    transform: translate(10%, 5%);
  }
  100% {
    transform: translate(0, 0);
  }
`;

// Card scene - perspective container
export const CardScene = styled.div`
  width: 300px;
  height: 420px;
  perspective: 1000px;
  transform-style: preserve-3d;
  margin: 20px;
  /* Add z-index to ensure proper stacking context */
  position: relative;
  z-index: 1;
  /* Touching a card must never select it or flash a tap highlight — that's
     what made the holo state "stick" on phones. */
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;

  /* Very narrow screens: shrink the card (children are %-based, so the whole
     face scales) and trim the glow margin so it never overflows the viewport. */
  @media (max-width: 374px) {
    width: 260px;
    height: 364px;
    margin: 12px;
  }
`;

// Card container - handles hover and moving states
export const CardContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  cursor: ${({ $isInteractive }) => $isInteractive ? 'pointer' : 'default'};
  transform-style: preserve-3d;
  /* This creates a single stacking context for all card elements */
  isolation: isolate;
  
  /* Change transition to match working HTML, only for flipping */
  transition: box-shadow 0.3s ease;
  
  /* Only apply rotateY for flipping */
  ${({ $isFlipped }) => $isFlipped && css`
    & > .${CardElement} {
      transform: rotateY(180deg);
    }
  `}
  
  /* Floating animation for non-moving state */
  ${({ $isInteractive }) => $isInteractive && css`
    &.floating {
      animation: ${floatingCard} 5s ease-in-out infinite;
    }
    
    &:hover {
      animation-play-state: paused;
    }
    
    /* Moving class gets added/removed via direct DOM manipulation */
    &.moving {
      animation-play-state: paused;
    }
  `}
`;

// Edge highlight effect
export const EdgeHighlight = styled.div`
  position: absolute;
  inset: calc(0px - 2px);
  border-radius: 17px;
  background: linear-gradient(
    var(--edge-angle, 135deg),
    var(--edge-color1, rgba(255, 255, 255, 0.5)),
    var(--edge-color2, rgba(0, 0, 0, 0))
  );
  z-index: calc(0 - 1);
  opacity: 0.5;
  transition: opacity 0.3s ease;
  transform: translateZ(0);
  
  ${CardContainer}.moving & {
    opacity: 0.8;
  }
`;

// Thick integrated border that shows card image details
/* Thick integrated border (Pokemon style) - matches the depth-layer in working HTML */
export const CardBorder = styled.div`
  position: absolute;
  /* Inset by 10px to create an inner border effect */
  inset: 10px;
  background: var(--border-color, rgb(255, 215, 0)); /* Default to gold color */
  border-radius: 12px;
  /* Position slightly above the card face but below the card image */
  transform: translateZ(2px);
  z-index: 3; /* Position above base card but below holographic effects */
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
  opacity: var(--border-opacity, 0.2);
  transition: background var(--border-transition-duration, 0.1s) ease, opacity var(--border-transition-duration, 0.1s) ease, box-shadow var(--border-transition-duration, 0.1s) ease;

  /* Add subtle animation on moving */
  ${CardContainer}.moving & {
    background: var(--border-color-hover, var(--border-color, rgb(255, 215, 0)));
    opacity: var(--border-opacity-hover, var(--border-opacity, 0.2));
    box-shadow: 0 0 25px rgba(255, 215, 0, 0.3);
  }
`;

/* Blurred image border that overlays on the thick border */
export const CardBorderImage = styled.div`
  position: absolute;
  /* Match the same inset as CardBorder */
  inset: 10px;
  border-radius: 12px;
  overflow: hidden;
  pointer-events: none;
  background-image: var(--card-image);
  background-size: cover;
  background-position: center;
  filter: var(--initial-blur, blur(2px)) brightness(0.8) saturate(1.5);
  /* Position just above the border for nice layering */
  transform: translateZ(2.25px);
  z-index: 4; /* Just above the border but below holographic effects */
  opacity: var(--border-image-opacity, 0.7);
  /* Blend with the CardBorder beneath it */
  mix-blend-mode: overlay;
  /* Add transition for blur change on hover */
  transition: filter 0.4s ease-out;
  
  /* Enhance effect on moving - using CSS variables for dynamic behavior */
  ${CardContainer}.moving & {
    filter: var(--hover-blur, blur(2px)) brightness(0.9) saturate(1.8);
    opacity: var(--hover-opacity, 0.8);
  }
`;


// Thin edge border (like paper edge) - matches the edge-highlight in working HTML
export const ThinEdgeBorder = styled.div`
  position: absolute;
  /* Slightly larger than the card to create an outer glow */
  inset: calc(0px - 1px);
  border-radius: 15px;
  background: transparent;
  border: 1px solid;
  border-image: linear-gradient(
    var(--edge-angle, 45deg),
    var(--edge-color1, rgba(255, 255, 255, 0.8)),
    var(--edge-color2, rgba(255, 215, 0, 0.6))
  ) 1;
  opacity: 0.5;
  transform: translateZ(0);
  pointer-events: none;
  z-index: 5; /* Reduced z-index so it doesn't appear on top of everything */
  transition: opacity 0.3s ease;
  
  /* Enhanced hover effect for thin border */
  .card.moving & {
    opacity: 0.8;
  }
`;

// Main card element - handles flipping
export const CardElement = styled.div`
  width: 100%;
  height: 100%;
  border-radius: var(--card-border-radius);
  position: absolute;
  transform-style: preserve-3d;
  /* Mouse Response Speed: higher = snappier tilt (shorter transition). */
  transition: transform var(--card-tilt-speed, 0.1s) ease;
  backface-visibility: hidden;
  /* Remove the background from this element as it's now on CardFace */
  overflow: hidden;
  /* Remove duplicate transform property and use flat value to avoid layering issues */
  transform: translateZ(0);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
`;

/* Card face - front of card */
export const CardFace = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 15px;
  transform-style: preserve-3d; /* Critical for proper 3D stacking */
  backface-visibility: hidden;
  
  /* Default gradient uses vibrant colors and proper spacing - from working_index.html */
  background: linear-gradient(
    135deg,
    hsl(var(--base-hue, 220) 80% 40%),
    hsl(var(--second-hue, 280) 90% 45%),
    hsl(var(--third-hue, 40) 85% 40%)
  );
  z-index: 1; /* Base z-index */
  
  /* Allow overriding with custom gradient via CSS variable */
  background: var(--card-gradient, linear-gradient(
    135deg,
    hsl(var(--base-hue, 220) 80% 40%),
    hsl(var(--second-hue, 280) 90% 45%),
    hsl(var(--third-hue, 40) 85% 40%)
  ));
  
  overflow: hidden;
  transform: translateZ(0.5px);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
  z-index: 1; /* Ensure proper stacking context */
`;

/* Card back - back of card */
export const CardBack = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 15px;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  background: linear-gradient(45deg, #1a1a1a, #333);
  transform: rotateY(180deg) translateZ(0.5px);
`;

/* Base-background vignette: darkens the edges of the gradient behind the image. */
export const BgVignette = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 15px;
  pointer-events: none;
  z-index: 1;
  background: radial-gradient(ellipse at center, transparent 42%, rgba(0, 0, 0, 1) 125%);
  opacity: var(--bg-vignette, 0);
`;

/* Base-background grain: subtle film-noise texture over the gradient. */
export const BgGrain = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 15px;
  pointer-events: none;
  z-index: 1;
  mix-blend-mode: overlay;
  opacity: var(--bg-grain, 0);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 140px 140px;
`;

/* Depth layer - creates 3D effect */
export const DepthLayer = styled.div`
  position: absolute;
  inset: 10px;
  background: rgba(255,255,255,0.1);
  border-radius: 12px;
  transform: translateZ(2px);
  box-shadow: 0 0 20px rgba(0,0,0,0.2);
`;

// Pattern overlay - applies pattern on card
export const PatternOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: var(--pattern);
  mix-blend-mode: soft-light;
  opacity: var(--pattern-opacity, 0.7);
  transform: translateZ(1px);
  transform-origin: center;
  border-radius: 15px;
  
  &.shimmering-pattern {
    animation: ${patternShimmer} 3s ease-in-out infinite;
    mix-blend-mode: hard-light;
    opacity: 0.9 !important;
  }
`;

// Holographic effect layer - improved for better gradient interaction
export const HoloEffect = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 15px;
  background: linear-gradient(
      var(--holo-angle, 45deg),
      hsla(0, 0%, 100%, 0.2) 0%,
      hsla(var(--base-hue, 220), 50%, 80%, 0.15) 15%,
      hsla(var(--second-hue, 280), 70%, 85%, 0.6) 40%,
      hsla(var(--third-hue, 40), 60%, 80%, 0.15) 65%,
      hsla(0, 0%, 100%, 0.2) 100%
    );
  /* Use color-dodge for more vibrant interaction with underlying gradient */
  mix-blend-mode: overlay;
  opacity: 0;
  transform: translateZ(4px); /* Position in front of the card image */
  transition: opacity 0.2s ease, background 0.2s ease;
  pointer-events: none;
  z-index: 5; /* Explicitly set z-index to be ABOVE the card image */
  
  /* Enhanced moving effect that responds to mouse position */
  ${CardContainer}.moving & {
    opacity: 0.8; /* Only visible on moving as per the rules */
    transition: opacity 0.3s ease-in;
  }
  
  /* Adjust properties based on card rarity */
  ${CardContainer}[data-rarity="rare-holo-vmax"] & {
    mix-blend-mode: color-dodge;
    background: linear-gradient(
      var(--holo-angle, 45deg),
      hsla(0, 80%, 60%, 0.2) 0%,
      hsla(350, 90%, 65%, 0.4) 20%,
      hsla(300, 100%, 70%, 0.7) 40%,
      hsla(350, 90%, 65%, 0.4) 60%,
      hsla(0, 80%, 60%, 0.2) 100%
    );
    opacity: 0; /* Start invisible */
    z-index: 5; /* Ensure it's visible above the card image */
    transform: translateZ(5px); /* Move it forward in the stack */
    
    /* Only show on moving */
    ${CardContainer}.moving & {
      opacity: 0.8;
    }
  }
`;



// Holographic shine layer - different types based on rarity
export const HoloShine = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 15px;
  background-position: center;
  background-size: 100% 100%;
  opacity: 0;
  transition: opacity 0.2s ease;
  /* Position above the card image */
  transform: translateZ(5px);
  z-index: 6; /* Just above the card image but not too aggressive */
  overflow: hidden;
  /* More subtle blend mode */
  mix-blend-mode: soft-light; 
  pointer-events: none;
  display: ${({ $active }) => $active ? 'block' : 'none'};
  
  /* More gradual transition on moving for smoother effect */
  ${CardContainer}.moving & {
    opacity: ${({ $active }) => $active ? 0.8 : 0}; /* Increased opacity for better visibility */
    transition: opacity 0.3s ease-in-out;
  }
  
  /* CSS variables for holographic effects */
  --space: 4%;
  --h: 0;
  --s: 70%;
  --l: 50%;
  --red: 255, 0, 0;
  --blu: 0, 146, 255;
  --gre: 0, 200, 0;
  --yel: 255, 255, 0;
  --vio: 255, 0, 255;
  --holo-angle: 45deg;
  --edge-angle: 135deg;
  --hyp: 0;
  
  &.rare-holo {
    --space: var(--rare-holo-space, 1.5%);
    --h: var(--rare-holo-h, 21);
    --s: var(--rare-holo-s, 70%);
    --l: var(--rare-holo-l, 50%);
    
    /* Original subtle effect - exact restoration */
    background-image: var(--rare-holo-background-image, 
      repeating-linear-gradient(90deg,
        hsl(calc(var(--h)*0), var(--s), var(--l)) calc(var(--space)*0),
        hsl(calc(var(--h)*0), var(--s), var(--l)) calc(var(--space)*1),
        hsl(calc(var(--h)*1), var(--s), var(--l)) calc(var(--space)*1),
        hsl(calc(var(--h)*1), var(--s), var(--l)) calc(var(--space)*2),
        hsl(calc(var(--h)*2), var(--s), var(--l)) calc(var(--space)*2),
        hsl(calc(var(--h)*2), var(--s), var(--l)) calc(var(--space)*3),
        hsl(calc(var(--h)*3), var(--s), var(--l)) calc(var(--space)*3),
        hsl(calc(var(--h)*3), var(--s), var(--l)) calc(var(--space)*4),
        hsl(calc(var(--h)*4), var(--s), var(--l)) calc(var(--space)*4),
        hsl(calc(var(--h)*4), var(--s), var(--l)) calc(var(--space)*5),
        hsl(calc(var(--h)*5), var(--s), var(--l)) calc(var(--space)*5),
        hsl(calc(var(--h)*5), var(--s), var(--l)) calc(var(--space)*6),
        hsl(calc(var(--h)*6), var(--s), var(--l)) calc(var(--space)*6),
        hsl(calc(var(--h)*6), var(--s), var(--l)) calc(var(--space)*7),
        hsl(calc(var(--h)*7), var(--s), var(--l)) calc(var(--space)*7),
        hsl(calc(var(--h)*7), var(--s), var(--l)) calc(var(--space)*8),
        hsl(calc(var(--h)*8), var(--s), var(--l)) calc(var(--space)*8),
        hsl(calc(var(--h)*8), var(--s), var(--l)) calc(var(--space)*9),
        hsl(calc(var(--h)*9), var(--s), var(--l)) calc(var(--space)*9),
        hsl(calc(var(--h)*9), var(--s), var(--l)) calc(var(--space)*10),
        hsl(calc(var(--h)*10), var(--s), var(--l)) calc(var(--space)*10),
        hsl(calc(var(--h)*10), var(--s), var(--l)) calc(var(--space)*11),
        hsl(calc(var(--h)*11), var(--s), var(--l)) calc(var(--space)*11),
        hsl(calc(var(--h)*11), var(--s), var(--l)) calc(var(--space)*12),
        hsl(calc(var(--h)*12), var(--s), var(--l)) calc(var(--space)*12),
        hsl(calc(var(--h)*12), var(--s), var(--l)) calc(var(--space)*13)
      )
    ),
      /* Modified shine effect for more natural light reflection */
      radial-gradient(
        ellipse at 
        calc(var(--mx) * 0.8 + 10%) 
        calc(var(--my) * 0.8 + 10%),
        rgba(230, 230, 230, 0.6) 0%,
        rgba(230, 230, 230, 0.5) 10%,
        rgba(200, 200, 200, 0.3) 30%,
        rgba(100, 100, 100, 0.2) 60%,
        rgba(0, 0, 0, 0.3) 100%
      );
    
    background-blend-mode: soft-light, soft-light, screen, overlay;
    background-position: center, calc(((50% - var(--posx)) * 25) + 50%) center;
    background-size: 100px 100px, 200% 200%;
    
    /* Original filter - exact restoration with user control */
    filter: brightness(calc((var(--hyp) + 0.7)*0.7*var(--rare-holo-filter-strength, 1))) contrast(calc(3*var(--rare-holo-filter-strength, 1))) saturate(calc(.35*var(--rare-holo-filter-strength, 1)));
    mix-blend-mode: var(--rare-holo-blend-mode, soft-light);
    
    /* Extreme mode - layered architecture with image texture */
    &[data-intensity="extreme"] {
      background-image: var(--rare-holo-background-image, url("/assets/img/shine1.png"));
      background-size: cover;
      background-position: var(--posx, 50%) var(--posy, 50%);
      mix-blend-mode: soft-light;
      filter: brightness(calc((var(--hyp, 0) + 0.7) * 0.7)) contrast(1.2) saturate(1.5);
      
      /* Add the rainbow gradient and shine effect via ::before pseudo-element */
      &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(90deg,
          var(--rare-holo-color-1, hsl(calc(var(--h)*0), var(--s), var(--l))) calc(var(--space)*0),
          var(--rare-holo-color-1, hsl(calc(var(--h)*0), var(--s), var(--l))) calc(var(--space)*1),
          var(--rare-holo-color-2, hsl(calc(var(--h)*1), var(--s), var(--l))) calc(var(--space)*1),
          var(--rare-holo-color-2, hsl(calc(var(--h)*1), var(--s), var(--l))) calc(var(--space)*2),
          var(--rare-holo-color-3, hsl(calc(var(--h)*2), var(--s), var(--l))) calc(var(--space)*2),
          var(--rare-holo-color-3, hsl(calc(var(--h)*2), var(--s), var(--l))) calc(var(--space)*3),
          var(--rare-holo-color-4, hsl(calc(var(--h)*3), var(--s), var(--l))) calc(var(--space)*3),
          var(--rare-holo-color-4, hsl(calc(var(--h)*3), var(--s), var(--l))) calc(var(--space)*4),
          var(--rare-holo-color-5, hsl(calc(var(--h)*4), var(--s), var(--l))) calc(var(--space)*4),
          var(--rare-holo-color-5, hsl(calc(var(--h)*4), var(--s), var(--l))) calc(var(--space)*5),
          var(--rare-holo-color-6, hsl(calc(var(--h)*5), var(--s), var(--l))) calc(var(--space)*5),
          var(--rare-holo-color-6, hsl(calc(var(--h)*5), var(--s), var(--l))) calc(var(--space)*6),
          var(--rare-holo-color-7, hsl(calc(var(--h)*6), var(--s), var(--l))) calc(var(--space)*6),
          var(--rare-holo-color-7, hsl(calc(var(--h)*6), var(--s), var(--l))) calc(var(--space)*7),
          var(--rare-holo-color-8, hsl(calc(var(--h)*7), var(--s), var(--l))) calc(var(--space)*7),
          var(--rare-holo-color-8, hsl(calc(var(--h)*7), var(--s), var(--l))) calc(var(--space)*8),
          var(--rare-holo-color-9, hsl(calc(var(--h)*8), var(--s), var(--l))) calc(var(--space)*8),
          var(--rare-holo-color-9, hsl(calc(var(--h)*8), var(--s), var(--l))) calc(var(--space)*9),
          var(--rare-holo-color-10, hsl(calc(var(--h)*9), var(--s), var(--l))) calc(var(--space)*9),
          var(--rare-holo-color-10, hsl(calc(var(--h)*9), var(--s), var(--l))) calc(var(--space)*10),
          var(--rare-holo-color-11, hsl(calc(var(--h)*10), var(--s), var(--l))) calc(var(--space)*10),
          var(--rare-holo-color-11, hsl(calc(var(--h)*10), var(--s), var(--l))) calc(var(--space)*11),
          var(--rare-holo-color-12, hsl(calc(var(--h)*11), var(--s), var(--l))) calc(var(--space)*11),
          var(--rare-holo-color-12, hsl(calc(var(--h)*11), var(--s), var(--l))) calc(var(--space)*12)
        ),
        /* Modified shine effect for more natural light reflection */
        radial-gradient(
          ellipse at 
          calc(var(--mx) * 0.8 + 10%) 
          calc(var(--my) * 0.8 + 10%),
          rgba(230, 230, 230, 0.6) 0%,
          rgba(230, 230, 230, 0.5) 10%,
          rgba(200, 200, 200, 0.3) 30%,
          rgba(100, 100, 100, 0.2) 60%,
          rgba(0, 0, 0, 0.3) 100%
        );
        background-blend-mode: soft-light, soft-light, screen, overlay;
        background-position: center, calc(((50% - var(--posx)) * 25) + 50%) center;
        background-size: 100px 100px, 200% 200%;
        pointer-events: none;
      }
    }
  }
  
  &.rare-holo-galaxy {
    --space: var(--rare-holo-galaxy-space, 4%);
    
    background-image: 
      var(--rare-holo-galaxy-background-image, url("/assets/img/galaxy.jpg")),
      var(--rare-holo-galaxy-background-image, url("/assets/img/galaxy.jpg")),
      repeating-linear-gradient(
        82deg,
        var(--rare-holo-galaxy-color-1, rgb(219, 204, 86)) calc(var(--space)*1),
        var(--rare-holo-galaxy-color-1, rgb(219, 204, 86)) calc(var(--space)*var(--rare-holo-galaxy-overlap-1, 1.0)),
        var(--rare-holo-galaxy-color-2, rgb(121, 199, 58)) calc(var(--space)*2),
        var(--rare-holo-galaxy-color-2, rgb(121, 199, 58)) calc(var(--space)*var(--rare-holo-galaxy-overlap-2, 2.0)),
        var(--rare-holo-galaxy-color-3, rgb(58, 192, 183)) calc(var(--space)*3),
        var(--rare-holo-galaxy-color-3, rgb(58, 192, 183)) calc(var(--space)*var(--rare-holo-galaxy-overlap-3, 3.0)),
        var(--rare-holo-galaxy-color-4, rgb(71, 98, 207)) calc(var(--space)*4),
        var(--rare-holo-galaxy-color-4, rgb(71, 98, 207)) calc(var(--space)*var(--rare-holo-galaxy-overlap-4, 4.0)),
        var(--rare-holo-galaxy-color-5, rgb(170, 69, 209)) calc(var(--space)*5),
        var(--rare-holo-galaxy-color-5, rgb(170, 69, 209)) calc(var(--space)*var(--rare-holo-galaxy-overlap-5, 5.0)),
        var(--rare-holo-galaxy-color-6, rgb(255, 90, 180)) calc(var(--space)*6),
        var(--rare-holo-galaxy-color-6, rgb(255, 90, 180)) calc(var(--space)*var(--rare-holo-galaxy-overlap-6, 6.0)),
        var(--rare-holo-galaxy-color-7, rgb(255, 90, 180)) calc(var(--space)*7),
        var(--rare-holo-galaxy-color-7, rgb(255, 90, 180)) calc(var(--space)*var(--rare-holo-galaxy-overlap-7, 7.0)),
        var(--rare-holo-galaxy-color-8, rgb(170, 69, 209)) calc(var(--space)*8),
        var(--rare-holo-galaxy-color-8, rgb(170, 69, 209)) calc(var(--space)*var(--rare-holo-galaxy-overlap-8, 8.0)),
        var(--rare-holo-galaxy-color-9, rgb(71, 98, 207)) calc(var(--space)*9),
        var(--rare-holo-galaxy-color-9, rgb(71, 98, 207)) calc(var(--space)*var(--rare-holo-galaxy-overlap-9, 9.0)),
        var(--rare-holo-galaxy-color-10, rgb(58, 192, 183)) calc(var(--space)*10),
        var(--rare-holo-galaxy-color-10, rgb(58, 192, 183)) calc(var(--space)*var(--rare-holo-galaxy-overlap-10, 10.0)),
        var(--rare-holo-galaxy-color-11, rgb(121, 199, 58)) calc(var(--space)*11),
        var(--rare-holo-galaxy-color-11, rgb(121, 199, 58)) calc(var(--space)*var(--rare-holo-galaxy-overlap-11, 11.0)),
        var(--rare-holo-galaxy-color-12, rgb(219, 204, 86)) calc(var(--space)*12)
      ),
      /* Natural radial shine effect */
      radial-gradient(
        ellipse at 
        calc(var(--mx) * 0.7 + 15%) 
        calc(var(--my) * 0.7 + 15%),
        rgba(255, 255, 255, 0.6) 5%,
        rgba(150, 150, 150, 0.3) 40%,
        rgba(0, 0, 0, 0.6) 100%
      );
    
    background-blend-mode: var(--rare-holo-galaxy-blend-mode, color-dodge), color-burn, saturation, screen;
    background-position: center, center, 
      calc(((50% - var(--posx)) * 2.5) + 50%) calc(((50% - var(--posy)) * 2.5) + 50%), 
      center;
    background-size: cover, cover, var(--rare-holo-galaxy-gradient-size, 400%) var(--rare-holo-galaxy-gradient-height, 900%), cover;
    
    filter: brightness(var(--rare-holo-galaxy-brightness, .75)) contrast(var(--rare-holo-galaxy-contrast, 1.2)) saturate(var(--rare-holo-galaxy-saturation, 1.5));
    mix-blend-mode: color-dodge;
  }
  
  &.rare-holo-vmax {
    --space: var(--rare-holo-vmax-space, 6%);
    --angle: var(--rare-holo-vmax-angle, 133deg);
    
    /* More reasonable z-index that doesn't dominate everything */
    z-index: 7;
    transform: translateZ(6px);
    
    background-image: var(--rare-holo-vmax-background-image, url("/assets/img/shine4.png")),
      /* Diagonal gradient with reds and pinks - more subtle now */
      repeating-linear-gradient(-33deg,
        rgba(206, 42, 36, 0.2) calc(var(--space)*1),    /* Red - much lower opacity */
        rgba(157, 33, 32, 0.2) calc(var(--space)*2),    /* Dark Red - much lower opacity */
        rgba(224, 88, 139, 0.2) calc(var(--space)*3),   /* Pink - much lower opacity */
        rgba(180, 32, 113, 0.2) calc(var(--space)*4),   /* Dark Pink - much lower opacity */
        rgba(123, 36, 103, 0.2) calc(var(--space)*5)),  /* Purple - much lower opacity */
      /* Subtle radial gradient that follows mouse */
      radial-gradient(
        farthest-corner circle at var(--mx) var(--my),
        rgba(255, 100, 120, 0.1) 0%,   /* Much lower opacity */
        rgba(255, 100, 120, 0.15) 25%, /* Much lower opacity */
        rgba(255, 100, 120, 0.2) 50%,  /* Much lower opacity */
        rgba(255, 100, 120, 0.25) 75%  /* Much lower opacity */
      );
    /* More subtle blend modes */
    background-blend-mode: soft-light, screen, overlay;
    background-size: cover,cover,400% 900%,cover;
    // background-size: 100% 100%, 1100% 1100%, 600% 600%;
    background-position: center, 0% var(--posy), var(--posx) var(--posy);
    
    /* Much more subtle moving effect - just a hint of shimmer */
    ${CardContainer}.moving & {
      opacity: 0.3; /* Much lower opacity to be subtle */
      filter: brightness(1.1) contrast(1.2) saturate(1.1); /* Less intense filtering */
    }
    
    /* Base filter when not hovered */
    filter: brightness(calc((var(--hyp) + 0.8) * var(--rare-holo-vmax-brightness, 0.5))) contrast(var(--rare-holo-vmax-contrast, 2.0)) saturate(1.5);
    opacity: 0.8; /* Slightly higher opacity for premium effect */
    mix-blend-mode: color-dodge;
    transition: all 0.1s ease-out;
    pointer-events: none;
  }
  
  &.wowa-holo {
    --space: 4%;
    
    background-image: var(--wowa-holo-background-image, url("/assets/new_shiny_imgs/illusion.png")),
      repeating-linear-gradient(
        var(--angle, 45deg),
        rgba(255, 140, 0, 0.2) calc(var(--space)*1),   /* Orange - very low opacity */
        rgba(255, 215, 0, 0.2) calc(var(--space)*2),   /* Gold - very low opacity */
        rgba(255, 255, 0, 0.2) calc(var(--space)*3),   /* Yellow - very low opacity */
        rgba(173, 255, 47, 0.2) calc(var(--space)*4),  /* Green-yellow - very low opacity */
        rgba(50, 205, 50, 0.2) calc(var(--space)*5),   /* Lime green - very low opacity */
        rgba(0, 191, 255, 0.2) calc(var(--space)*6),   /* Deep sky blue - very low opacity */
        rgba(30, 144, 255, 0.2) calc(var(--space)*7),  /* Dodger blue - very low opacity */
        rgba(138, 43, 226, 0.2) calc(var(--space)*8)   /* Blue violet - very low opacity */
      ),
      /* Add a radial gradient that follows mouse position */
      radial-gradient(
        ellipse at var(--mx) var(--my),
        rgba(255, 255, 255, 0.3) 0%,   /* Reduced highlights */
        rgba(255, 255, 255, 0.15) 30%,  
        rgba(0, 0, 0, 0.2) 80%
      );
    
    /* Use the same blend modes as galaxy holo */
    background-blend-mode: soft-light, screen, overlay;
    background-size: 200% 200%, 300% 800%, 200% 200%;
    background-position: center, 0% var(--posy), var(--posx) var(--posy);
    
    /* Significantly reduced brightness and contrast */
    filter: brightness(0.6) contrast(1.2) saturate(0.9);
    opacity: 0; /* Start with zero opacity - invisible when not hovered */
    mix-blend-mode: soft-light;
    
    /* Only show the effect on moving */
    ${CardContainer}.moving & {
      opacity: 0.4; /* Subtle visibility on moving */
      transition: all 0.2s ease;
    }
  }
  

`;

// Chromatic aberration effect
export const ChromaticAberration = styled.div`
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: translateZ(4px);
  border-radius: 15px;
  display: ${({ $active }) => $active ? 'block' : 'none'};
  
  &::before, &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: inherit;
    border-radius: 15px;
    mix-blend-mode: screen;
  }
  
  &::before {
    background: rgba(255, 0, 0, 0.5);
    transform: translate3d(-5px, 0, 0);
    animation: ${chromaticShift} 10s infinite alternate;
  }
  
  &::after {
    background: rgba(0, 255, 255, 0.5);
    transform: translate3d(5px, 0, 0);
    animation: ${chromaticShift} 10s infinite alternate reverse;
  }
  
  ${CardContainer}.moving & {
    opacity: ${({ $active }) => $active ? 0.5 : 0};
  }
`;

// Create a dedicated component for Holo Effect Toggles background images
export const HoloBackgroundImage = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 15px;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  opacity: 0; /* Start invisible like original holo effects */
  transition: opacity 0.2s ease;
  transform: translateZ(5px);
  z-index: 6; /* Same as original HoloShine */
  overflow: hidden;
  pointer-events: none;
  display: ${({ $active }) => $active ? 'block' : 'none'};
  
  /* Background image from props */
  background-image: ${({ $imageUrl }) => $imageUrl ? `url("${$imageUrl}")` : 'none'};
  
  /* Mimic original holo effect behavior exactly */
  mix-blend-mode: soft-light; /* Same as original HoloShine */
  
  /* Mouse-responsive positioning like original */
  background-position: var(--posx, 50%) var(--posy, 50%);
  
  /* Moving effect - mimic original behavior */
  ${CardContainer}.moving & {
    opacity: 0.8; /* Same moving opacity as original */
    transition: opacity 0.3s ease-in-out; /* Same timing as original */
  }
  
  /* Apply same filters as original holo effects */
  filter: brightness(calc((var(--hyp, 0) + 0.7) * 0.7)) contrast(1.2) saturate(1.5);
  
  /* Add Galaxy Colors gradient layer for rare-holo-galaxy */
  ${({ $className }) => $className === 'rare-holo-galaxy-background' && `
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        82deg,
        var(--rare-holo-galaxy-color-1, rgb(219, 204, 86)) calc(var(--rare-holo-galaxy-space, 4%)*1),
        var(--rare-holo-galaxy-color-1, rgb(219, 204, 86)) calc(var(--rare-holo-galaxy-space, 4%)*var(--rare-holo-galaxy-overlap-1, 1.0)),
        var(--rare-holo-galaxy-color-2, rgb(121, 199, 58)) calc(var(--rare-holo-galaxy-space, 4%)*2),
        var(--rare-holo-galaxy-color-2, rgb(121, 199, 58)) calc(var(--rare-holo-galaxy-space, 4%)*var(--rare-holo-galaxy-overlap-2, 2.0)),
        var(--rare-holo-galaxy-color-3, rgb(58, 192, 183)) calc(var(--rare-holo-galaxy-space, 4%)*3),
        var(--rare-holo-galaxy-color-3, rgb(58, 192, 183)) calc(var(--rare-holo-galaxy-space, 4%)*var(--rare-holo-galaxy-overlap-3, 3.0)),
        var(--rare-holo-galaxy-color-4, rgb(71, 98, 207)) calc(var(--rare-holo-galaxy-space, 4%)*4),
        var(--rare-holo-galaxy-color-4, rgb(71, 98, 207)) calc(var(--rare-holo-galaxy-space, 4%)*var(--rare-holo-galaxy-overlap-4, 4.0)),
        var(--rare-holo-galaxy-color-5, rgb(170, 69, 209)) calc(var(--rare-holo-galaxy-space, 4%)*5),
        var(--rare-holo-galaxy-color-5, rgb(170, 69, 209)) calc(var(--rare-holo-galaxy-space, 4%)*var(--rare-holo-galaxy-overlap-5, 5.0)),
        var(--rare-holo-galaxy-color-6, rgb(255, 90, 180)) calc(var(--rare-holo-galaxy-space, 4%)*6),
        var(--rare-holo-galaxy-color-6, rgb(255, 90, 180)) calc(var(--rare-holo-galaxy-space, 4%)*var(--rare-holo-galaxy-overlap-6, 6.0)),
        var(--rare-holo-galaxy-color-7, rgb(255, 90, 180)) calc(var(--rare-holo-galaxy-space, 4%)*7),
        var(--rare-holo-galaxy-color-7, rgb(255, 90, 180)) calc(var(--rare-holo-galaxy-space, 4%)*var(--rare-holo-galaxy-overlap-7, 7.0)),
        var(--rare-holo-galaxy-color-8, rgb(170, 69, 209)) calc(var(--rare-holo-galaxy-space, 4%)*8),
        var(--rare-holo-galaxy-color-8, rgb(170, 69, 209)) calc(var(--rare-holo-galaxy-space, 4%)*var(--rare-holo-galaxy-overlap-8, 8.0)),
        var(--rare-holo-galaxy-color-9, rgb(71, 98, 207)) calc(var(--rare-holo-galaxy-space, 4%)*9),
        var(--rare-holo-galaxy-color-9, rgb(71, 98, 207)) calc(var(--rare-holo-galaxy-space, 4%)*var(--rare-holo-galaxy-overlap-9, 9.0)),
        var(--rare-holo-galaxy-color-10, rgb(58, 192, 183)) calc(var(--rare-holo-galaxy-space, 4%)*10),
        var(--rare-holo-galaxy-color-10, rgb(58, 192, 183)) calc(var(--rare-holo-galaxy-space, 4%)*var(--rare-holo-galaxy-overlap-10, 10.0)),
        var(--rare-holo-galaxy-color-11, rgb(121, 199, 58)) calc(var(--rare-holo-galaxy-space, 4%)*11),
        var(--rare-holo-galaxy-color-11, rgb(121, 199, 58)) calc(var(--rare-holo-galaxy-space, 4%)*var(--rare-holo-galaxy-overlap-11, 11.0)),
        var(--rare-holo-galaxy-color-12, rgb(219, 204, 86)) calc(var(--rare-holo-galaxy-space, 4%)*12)
      );
      background-size: var(--rare-holo-galaxy-gradient-size, 400%) var(--rare-holo-galaxy-gradient-height, 900%);
      background-position: calc(((50% - var(--posx)) * 2.5) + 50%) calc(((50% - var(--posy)) * 2.5) + 50%);
      mix-blend-mode: var(--rare-holo-galaxy-blend-mode, color-dodge);
      opacity: 0.6;
      pointer-events: none;
    }
  `}

  /* Add Rainbow Colors gradient layer for rare-holo */
  ${({ $className }) => $className === 'rare-holo-background' && `
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(90deg,
        var(--rare-holo-color-1, hsl(calc(var(--rare-holo-h, 21)*0), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*0),
        var(--rare-holo-color-1, hsl(calc(var(--rare-holo-h, 21)*0), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*1),
        var(--rare-holo-color-2, hsl(calc(var(--rare-holo-h, 21)*1), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*1),
        var(--rare-holo-color-2, hsl(calc(var(--rare-holo-h, 21)*1), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*2),
        var(--rare-holo-color-3, hsl(calc(var(--rare-holo-h, 21)*2), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*2),
        var(--rare-holo-color-3, hsl(calc(var(--rare-holo-h, 21)*2), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*3),
        var(--rare-holo-color-4, hsl(calc(var(--rare-holo-h, 21)*3), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*3),
        var(--rare-holo-color-4, hsl(calc(var(--rare-holo-h, 21)*3), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*4),
        var(--rare-holo-color-5, hsl(calc(var(--rare-holo-h, 21)*4), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*4),
        var(--rare-holo-color-5, hsl(calc(var(--rare-holo-h, 21)*4), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*5),
        var(--rare-holo-color-6, hsl(calc(var(--rare-holo-h, 21)*5), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*5),
        var(--rare-holo-color-6, hsl(calc(var(--rare-holo-h, 21)*5), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*6),
        var(--rare-holo-color-7, hsl(calc(var(--rare-holo-h, 21)*6), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*6),
        var(--rare-holo-color-7, hsl(calc(var(--rare-holo-h, 21)*6), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*7),
        var(--rare-holo-color-8, hsl(calc(var(--rare-holo-h, 21)*7), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*7),
        var(--rare-holo-color-8, hsl(calc(var(--rare-holo-h, 21)*7), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*8),
        var(--rare-holo-color-9, hsl(calc(var(--rare-holo-h, 21)*8), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*8),
        var(--rare-holo-color-9, hsl(calc(var(--rare-holo-h, 21)*8), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*9),
        var(--rare-holo-color-10, hsl(calc(var(--rare-holo-h, 21)*9), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*9),
        var(--rare-holo-color-10, hsl(calc(var(--rare-holo-h, 21)*9), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*10),
        var(--rare-holo-color-11, hsl(calc(var(--rare-holo-h, 21)*10), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*10),
        var(--rare-holo-color-11, hsl(calc(var(--rare-holo-h, 21)*10), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*11),
        var(--rare-holo-color-12, hsl(calc(var(--rare-holo-h, 21)*11), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*11),
        var(--rare-holo-color-12, hsl(calc(var(--rare-holo-h, 21)*11), var(--rare-holo-s, 70%), var(--rare-holo-l, 50%))) calc(var(--rare-holo-space, 1.5%)*12)
      ),
      /* Modified shine effect for more natural light reflection */
      radial-gradient(
        ellipse at 
        calc(var(--mx) * 0.8 + 10%) 
        calc(var(--my) * 0.8 + 10%),
        rgba(230, 230, 230, 0.6) 0%,
        rgba(230, 230, 230, 0.5) 10%,
        rgba(200, 200, 200, 0.3) 30%,
        rgba(100, 100, 100, 0.2) 60%,
        rgba(0, 0, 0, 0.3) 100%
      );
      background-blend-mode: soft-light, soft-light, screen, overlay;
      background-position: center, calc(((50% - var(--posx)) * 25) + 50%) center;
      background-size: 100px 100px, 200% 200%;
      pointer-events: none;
    }
  `}
`;

// Card image and related styles
export const CardImage = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  overflow: visible; /* Allow effects to overflow the card image */
  border-radius: 15px;
  z-index: 2; /* Set the base z-index */
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    transition: opacity 0.3s ease, transform 0.3s ease-out;
    mix-blend-mode: var(--image-blend, normal);
    /* Apply opacity, contrast and saturation via CSS variables */
    opacity: var(--image-opacity, 1);
    filter: contrast(var(--image-contrast, 1)) saturate(var(--image-saturation, 1)) var(--image-filter, none);
    /* Parallax depth: at rest only the slight scale applies (so the image can
       shift on tilt without exposing edges). --parallax-depth 0 = no effect. */
    transform: scale(calc(1 + var(--parallax-depth, 0) * 0.07));
  }

  ${CardContainer}.moving & img {
    opacity: var(--image-opacity-hover, var(--image-opacity, 1));
    /* Shift the image opposite the tilt for a window-into-depth feel. */
    transition: transform 0.12s ease-out, opacity 0.3s ease;
    transform: translate3d(
        calc(var(--tilt-x, 0) * var(--parallax-depth, 0) * -16px),
        calc(var(--tilt-y, 0) * var(--parallax-depth, 0) * -16px), 0)
      scale(calc(1 + var(--parallax-depth, 0) * 0.07));
  }
  
  /* Apply image mask if specified */
  &:after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--mask-pattern, none);
    opacity: var(--mask-opacity, 0.3);
    mix-blend-mode: var(--mask-blend-mode, normal);
    pointer-events: none;
    z-index: 2;
  }

  /* Image shine effect that shows through transparent areas */
  ${CardContainer}.moving &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 10px;
    background: linear-gradient(
      var(--holo-angle, 45deg),
      rgba(255,255,255,0) 0%,
      rgba(255,255,255,0.3) 30%, 
      rgba(255,255,255,0.5) 45%,
      rgba(255,255,255,0.7) 60%,
      rgba(255,255,255,0) 100%
    );
    mix-blend-mode: overlay;
    opacity: 0.7;
    z-index: 3;
    pointer-events: none;
    filter: blur(0.5px);
    transition: opacity 0.3s ease;
  }

  /* Special shine for VMAX cards */
  ${CardContainer}[data-rarity="rare-holo-vmax"].moving &::before {
    background: linear-gradient(
      var(--holo-angle, 45deg),
      rgba(255,0,0,0) 0%,
      rgba(255,80,80,0.2) 30%, 
      rgba(255,120,120,0.4) 45%,
      rgba(255,160,160,0.6) 60%,
      rgba(255,0,0,0) 100%
    );
    mix-blend-mode: color-dodge;
    opacity: 0.8;
  }
`;

// Image shine effect - positioned on top of the image, visible on hover, and reactive to mouse position
export const ImageShine = styled.div`
  position: absolute;
  inset: 0;
  border-radius: 15px;
  background: linear-gradient(
    var(--holo-angle, 45deg),
    rgba(255,255,255,0) 0%,
    rgba(255,255,255,0.5) 50%,
    rgba(255,255,255,0) 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  transform: translateZ(6px); /* Position above both card image and holo effects */
  pointer-events: none;
  mix-blend-mode: overlay;
  z-index: 10; /* Ensure it's above all other elements */
  
  ${CardContainer}.moving & {
    opacity: 0.7;
  }
  
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at var(--mx) var(--my),
      rgba(255,255,255,0.7) 0%,
      rgba(255,255,255,0) 60%
    );
    mix-blend-mode: overlay;
    opacity: var(--effect-intensity, 0);
  }
`;

// Image mask for effects
export const ImageMask = styled.div`
  position: absolute;
  inset: 0;
  opacity: 0.3;
  border-radius: 10px;
  background: radial-gradient(ellipse at center, transparent 30%, black 100%);
  transition: opacity 0.3s ease;
  
  ${CardContainer}.moving & {
    opacity: 0.1;
  }
  
  &.vignette {
    background: radial-gradient(ellipse at center, transparent 30%, black 100%);
  }
  
  &.horizontal-fade {
    background: linear-gradient(to right, black 0%, transparent 40%, transparent 60%, black 100%);
  }
  
  &.vertical-fade {
    background: linear-gradient(to bottom, black 0%, transparent 40%, transparent 60%, black 100%);
  }
  
  &.diagonal-fade {
    background: linear-gradient(135deg, black 0%, transparent 40%, transparent 60%, black 100%);
  }
`;
