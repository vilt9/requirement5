# How to Generate a New Holographic Effect

This document provides a comprehensive guide on how to add new holographic effects to the card generator. By following these steps exactly, you'll ensure your new effects integrate perfectly with the existing system.

## Table of Contents

1. [Overview of the Holographic Effect System](#overview-of-the-holographic-effect-system)
2. [Step 1: Define the Rarity Range](#step-1-define-the-rarity-range)
3. [Step 2: Add the CSS Style Definition](#step-2-add-the-css-style-definition)
4. [Step 3: Update the Information Display](#step-3-update-the-information-display)
5. [Common Pitfalls and Troubleshooting](#common-pitfalls-and-troubleshooting)
6. [Example: Complete Implementation of a New Effect](#example-complete-implementation-of-a-new-effect)

## Overview of the Holographic Effect System

The card holographic effects follow a specific pattern:

1. Each effect is assigned to a specific rarity range of cards
2. The CSS class for the effect is defined in `Card.styles.jsx` within the `HoloShine` component
3. The effect's name is displayed in the information panel when a card with that effect is generated
4. Effects are only visible when the user hovers over or interacts with the card

## Step 1: Define the Rarity Range

First, update the `getHolographicEffectClass` function in `app/src/utils/cardGenerator.js` to include your new effect within a specific rarity range.

```javascript
// Function to apply holographic effect based on rarity
export const getHolographicEffectClass = (rarity) => {
  // Add your new effect within a specific rarity range
  if (rarity >= 0.82 && rarity < 0.85) return 'your-new-effect';
  
  // Existing effects
  if (rarity >= 0.85 && rarity < 0.9) return 'wowa-holo';
  if (rarity >= 0.95) return 'rare-ultra';
  if (rarity >= 0.9) return 'rare-holo-vmax';
  if (rarity >= 0.7) return 'rare-holo-galaxy';
  if (rarity >= 0.5) return 'rare-holo';
  return '';
};
```

Important: Make sure your new effect's rarity range doesn't overlap with existing effects.

## Step 2: Add the CSS Style Definition

Next, add your holographic effect CSS definition to the `HoloShine` component in `app/src/components/Card/Card.styles.jsx`. The precise location is critical - it must be added within the `HoloShine` styled component, alongside the other holographic effects.

```jsx
// In Card.styles.jsx within the HoloShine styled component

  &.your-new-effect {
    --space: 4%;  // Adjust spacing as needed
    
    background-image:
      url("/src/assets/img/your-texture.png"),  // Main texture image
      repeating-linear-gradient(
        var(--angle, 45deg),
        rgba(255, 0, 0, 0.2) calc(var(--space)*1),   // Color 1 - low opacity
        rgba(0, 255, 0, 0.2) calc(var(--space)*2),   // Color 2 - low opacity
        rgba(0, 0, 255, 0.2) calc(var(--space)*3),   // Color 3 - low opacity
        rgba(255, 255, 0, 0.2) calc(var(--space)*4)  // Color 4 - low opacity
      ),
      // Add a radial gradient that follows mouse position
      radial-gradient(
        ellipse at var(--mx) var(--my),
        rgba(255, 255, 255, 0.3) 0%,   // Center highlight
        rgba(255, 255, 255, 0.15) 30%, // Middle fade
        rgba(0, 0, 0, 0.2) 80%         // Edge darkening
      );
    
    // Blend modes control how the layers mix
    background-blend-mode: soft-light, screen, overlay;
    background-size: 200% 200%, 300% 800%, 200% 200%;
    background-position: center, 0% var(--posy), var(--posx) var(--posy);
    
    // Filter controls the overall look
    filter: brightness(0.6) contrast(1.2) saturate(0.9);
    opacity: 0; // Start invisible when not hovered
    mix-blend-mode: soft-light;
    
    // Only show effect on hover/interaction
    ${CardContainer}:hover & {
      opacity: 0.4; // Subtle visibility on hover
      transition: all 0.2s ease;
    }
  }
```

### Key CSS Properties to Adjust:

1. `--space`: Controls spacing between gradient colors
2. `background-image`: 
   - First URL: The texture image for your effect
   - Linear gradient: Color pattern with low opacity values (0.2-0.3 recommended)
   - Radial gradient: Mouse position highlight effect
3. `background-blend-mode`: How layers blend (soft-light, screen, overlay, color-dodge)
4. `filter`: Adjust brightness, contrast, and saturation 
5. `opacity`: Set to 0 initially, then 0.3-0.5 on hover

## Step 3: Update the Information Display

Update both the Home and Collection page components to display the name of your new effect.

### Home.jsx

Update the Holo Effect display in `app/src/pages/Home.jsx`:

```jsx
<InfoValue>{
  currentCard.rarity >= 0.98 ? 'VMAX Holographic' :
  currentCard.rarity >= 0.9 ? 'Ultra Rare Shine' :
  currentCard.rarity >= 0.85 && currentCard.rarity < 0.9 ? 'WOWA Holo' :
  currentCard.rarity >= 0.82 && currentCard.rarity < 0.85 ? 'Your New Effect' : // Add this line
  currentCard.rarity >= 0.8 ? 'Galaxy Holographic' :
  currentCard.rarity >= 0.7 ? 'Standard Holographic' :
  'None'
}</InfoValue>
```

Update the rarity display name in the same file:

```jsx
<InfoValue>
  {currentCard.rarity >= 0.98 ? 'VMAX Rare' :
    currentCard.rarity >= 0.9 ? 'Ultra Rare' :
    currentCard.rarity >= 0.85 && currentCard.rarity < 0.9 ? 'WOWA Rare' :
    currentCard.rarity >= 0.82 && currentCard.rarity < 0.85 ? 'Your New Rare' : // Add this line
    currentCard.rarity >= 0.8 ? 'Galaxy Rare' :
    currentCard.rarity >= 0.7 ? 'Holo Rare' :
    'Common'} ({(currentCard.rarity * 100).toFixed(2)}%)
</InfoValue>
```

### Collection.jsx

Update the rarity text in the Collection page as well:

```jsx
// Get rarity text
const getRarityText = (rarity) => {
  if (rarity >= 0.98) return 'VMAX Rare';
  if (rarity >= 0.9) return 'Ultra Rare';
  if (rarity >= 0.85 && rarity < 0.9) return 'WOWA Rare';
  if (rarity >= 0.82 && rarity < 0.85) return 'Your New Rare'; // Add this line
  if (rarity >= 0.8) return 'Galaxy Rare';
  if (rarity >= 0.7) return 'Holo Rare';
  return 'Common';
};
```

## Common Pitfalls and Troubleshooting

1. **Different Base Class Issue**: If you see your effect with a different base class (e.g., `sc-abcDef yourEffect` instead of `sc-xyzAbc yourEffect` where all other effects have the same `sc-xyzAbc` prefix), it means you haven't added the CSS in the correct location. The CSS must be inside the `HoloShine` styled component, not elsewhere in the styles file.

2. **Effect Not Showing**: If your effect doesn't show on hover:
   - Check that the opacity is 0 initially and > 0 on hover
   - Verify the rarity range doesn't overlap with other effects
   - Ensure background images are using correct paths

3. **Effect Too Bright/Washed Out**: If the effect overwhelms the card image:
   - Reduce opacity values in gradients (aim for 0.2-0.3)
   - Lower the hover opacity (0.3-0.5 range)
   - Decrease brightness in the filter

4. **Visual Inconsistency**: To maintain visual consistency with other effects:
   - Keep blend modes similar to existing effects
   - Ensure hover transition uses the same timing
   - Match z-index and transform values with similar effects

## Example: Complete Implementation of a New Effect

Let's implement a complete "Cosmic Holo" effect example that uses a star field texture.

### Step 1: Define the Rarity Range

```javascript
// In cardGenerator.js
export const getHolographicEffectClass = (rarity) => {
  if (rarity >= 0.82 && rarity < 0.85) return 'cosmic-holo';
  
  // Existing effects
  if (rarity >= 0.85 && rarity < 0.9) return 'wowa-holo';
  if (rarity >= 0.95) return 'rare-ultra';
  if (rarity >= 0.9) return 'rare-holo-vmax';
  if (rarity >= 0.7) return 'rare-holo-galaxy';
  if (rarity >= 0.5) return 'rare-holo';
  return '';
};
```

### Step 2: Add the CSS Style Definition

```jsx
// In Card.styles.jsx within the HoloShine styled component

  &.cosmic-holo {
    --space: 5%;
    
    background-image:
      url("/src/assets/img/starfield.png"),
      repeating-linear-gradient(
        var(--angle, 120deg),
        rgba(75, 0, 130, 0.2) calc(var(--space)*1),  // Indigo
        rgba(148, 0, 211, 0.2) calc(var(--space)*2), // Violet
        rgba(238, 130, 238, 0.2) calc(var(--space)*3), // Violet-pink
        rgba(255, 0, 255, 0.2) calc(var(--space)*4), // Magenta
        rgba(199, 21, 133, 0.2) calc(var(--space)*5) // Medium violet-red
      ),
      radial-gradient(
        ellipse at var(--mx) var(--my),
        rgba(255, 255, 255, 0.3) 0%,
        rgba(255, 255, 255, 0.1) 30%,
        rgba(0, 0, 0, 0.2) 80%
      );
    
    background-blend-mode: soft-light, screen, overlay;
    background-size: 200% 200%, 300% 800%, 200% 200%;
    background-position: center, 0% var(--posy), var(--posx) var(--posy);
    
    filter: brightness(0.65) contrast(1.2) saturate(0.9);
    opacity: 0; // Start invisible when not hovered
    mix-blend-mode: soft-light;
    
    ${CardContainer}:hover & {
      opacity: 0.4;
      transition: all 0.2s ease;
    }
  }
```

### Step 3: Update the Information Display

```jsx
// In Home.jsx - Holo Effect display
<InfoValue>{
  currentCard.rarity >= 0.98 ? 'VMAX Holographic' :
  currentCard.rarity >= 0.9 ? 'Ultra Rare Shine' :
  currentCard.rarity >= 0.85 && currentCard.rarity < 0.9 ? 'WOWA Holo' :
  currentCard.rarity >= 0.82 && currentCard.rarity < 0.85 ? 'Cosmic Holo' :
  currentCard.rarity >= 0.8 ? 'Galaxy Holographic' :
  currentCard.rarity >= 0.7 ? 'Standard Holographic' :
  'None'
}</InfoValue>

// In Home.jsx - Rarity display
<InfoValue>
  {currentCard.rarity >= 0.98 ? 'VMAX Rare' :
    currentCard.rarity >= 0.9 ? 'Ultra Rare' :
    currentCard.rarity >= 0.85 && currentCard.rarity < 0.9 ? 'WOWA Rare' :
    currentCard.rarity >= 0.82 && currentCard.rarity < 0.85 ? 'Cosmic Rare' :
    currentCard.rarity >= 0.8 ? 'Galaxy Rare' :
    currentCard.rarity >= 0.7 ? 'Holo Rare' :
    'Common'} ({(currentCard.rarity * 100).toFixed(2)}%)
</InfoValue>

// In Collection.jsx
const getRarityText = (rarity) => {
  if (rarity >= 0.98) return 'VMAX Rare';
  if (rarity >= 0.9) return 'Ultra Rare';
  if (rarity >= 0.85 && rarity < 0.9) return 'WOWA Rare';
  if (rarity >= 0.82 && rarity < 0.85) return 'Cosmic Rare';
  if (rarity >= 0.8) return 'Galaxy Rare';
  if (rarity >= 0.7) return 'Holo Rare';
  return 'Common';
};
```

With these implementations, your new "Cosmic Holo" effect will appear for cards with rarity between 0.82 and 0.85, displaying a starfield texture with a purple-themed gradient when the user hovers or interacts with the card.

Remember: The key to successful implementation is maintaining consistency with the existing effect patterns while making just enough changes to create a visually distinct new effect.
