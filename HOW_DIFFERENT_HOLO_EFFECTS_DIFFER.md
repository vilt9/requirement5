# How Different Holographic Effects Differ

This document analyzes the different holographic effects in the card generator and identifies the key elements that can be customized to create new effects. By understanding these differences, you can create unique and visually appealing holographic effects for your cards.

## Table of Contents

1. [Overview of Existing Effects](#overview-of-existing-effects)
2. [Key Customization Parameters](#key-customization-parameters)
3. [Mouse Interaction Techniques](#mouse-interaction-techniques)
4. [Background Image Usage](#background-image-usage)
5. [Color Manipulation](#color-manipulation)
6. [Blend Modes & Opacity](#blend-modes--opacity)
7. [Filters & Visual Adjustments](#filters--visual-adjustments)
8. [Comparative Effect Matrix](#comparative-effect-matrix)
9. [Creating Distinctive Effects](#creating-distinctive-effects)

## Overview of Existing Effects

Our card generator has several holographic effects with distinct visual characteristics:

1. **Standard Holo (rare-holo)**: Subtle rainbow pattern with no texture image
2. **Galaxy Holo (rare-holo-galaxy)**: Space-themed effect with galaxy texture
3. **VMAX Holo (rare-holo-vmax)**: Premium effect with shine texture and pink/red gradients
4. **Ultra Rare (rare-ultra)**: Highest tier effect with vibrant rainbow colors
5. **WOWA Holo (wowa-holo)**: Modern effect with illusion texture and rainbow gradient

## Key Customization Parameters

Analyzing the code, we can identify these key parameters that differentiate holographic effects:

### 1. Space Variable
```css
--space: 4%; /* Controls spacing between gradient colors */
```
- `rare-holo`: 1.5% (tighter rainbow bands)
- `rare-holo-galaxy`: 4% (medium bands)
- `rare-holo-vmax`: 6% (wider bands)
- `rare-ultra`: 5% (wider rainbow bands)
- `wowa-holo`: 4% (medium bands)

This variable controls how tight or spread out color bands appear. Smaller values create more detailed, tighter patterns.

### 2. Angle Variables
```css
--angle: 133deg; /* Direction of gradient */
--holo-angle: 45deg; /* Direction of shine effect */
```
- `rare-holo`: Uses fixed 90deg (horizontal bands)
- `rare-holo-galaxy`: Uses 82deg (angled bands)
- `rare-holo-vmax`: Uses 133deg (diagonal bands)
- `rare-ultra`: Uses 133deg and 0deg (multiple angles)
- `wowa-holo`: Uses 45deg (diagonal bands)

Modifying angle variables creates different directional effects for the pattern.

## Mouse Interaction Techniques

Each effect handles mouse interaction differently:

### 1. Mouse Position Variables
```css
--mx: mouse X position (0-100%)
--my: mouse Y position (0-100%)
```

### 2. Mouse Tracking Techniques

- **Direct Follow**:
  ```css
  radial-gradient(ellipse at var(--mx) var(--my), ...)
  ```
  Used by `wowa-holo` - the shine directly follows the mouse

- **Offset Follow**:
  ```css
  ellipse at calc(var(--mx) * 0.7 + 15%) calc(var(--my) * 0.7 + 15%)
  ```
  Used by `rare-holo-galaxy` - the shine follows the mouse with an offset

- **Inverse Follow**:
  ```css
  background-position: calc(((50% - var(--posx)) * 2.5) + 50%) calc(((50% - var(--posy)) * 2.5) + 50%)
  ```
  Used by `rare-holo-galaxy` - the pattern moves in the opposite direction of the mouse

- **Partial Follow**:
  ```css
  background-position: center, 0% var(--posy), var(--posx) var(--posy)
  ```
  Used by `rare-holo-vmax` - some layers follow X movement, others follow Y movement

### 3. Highlight Types

- **Circular Highlight**:
  ```css
  radial-gradient(ellipse at var(--mx) var(--my), ...)
  ```
  
- **Farthest Corner**:
  ```css
  radial-gradient(farthest-corner circle at var(--mx) var(--my), ...)
  ```
  Creates a larger highlight that extends to corners

## Background Image Usage

Background images add texture to the holographic effect:

- `rare-holo`: No background image, pure gradient
- `rare-holo-galaxy`: Uses galaxy.jpg texture (doubled for complex effect)
- `rare-holo-vmax`: Uses shine4.png texture
- `rare-ultra`: Uses shine2.png texture
- `wowa-holo`: Uses illusion.png texture

### Image Techniques:

1. **Single Image**:
   ```css
   url("/src/assets/img/shine2.png")
   ```

2. **Doubled Image**:
   ```css
   url("/src/assets/img/galaxy.jpg"),
   url("/src/assets/img/galaxy.jpg")
   ```
   Creates more complex texture and depth

3. **Image Sizing**:
   ```css
   background-size: 200% 200%, 300% 800%, 200% 200%;
   ```
   Oversized images allow for movement and parallax effects

## Color Manipulation

Different effects use various approaches to color:

### 1. Color Definition Methods

- **HSL Calculation**:
  ```css
  hsl(calc(var(--h)*0), var(--s), var(--l))
  ```
  Used by `rare-holo` - generates colors from a base hue

- **Direct RGB**:
  ```css
  rgb(255, 90, 90)
  ```
  Used by `rare-ultra` - specifies exact color values

- **RGBA with Opacity**:
  ```css
  rgba(255, 140, 0, 0.2)
  ```
  Used by `wowa-holo` - adds transparency to colors

- **RGB from Variables**:
  ```css
  rgba(var(--red), 0.6)
  ```
  References predefined color variables

### 2. Color Schemes

- `rare-holo`: Full rainbow spectrum via HSL calculations
- `rare-holo-galaxy`: Yellow to blue to pink spectrum
- `rare-holo-vmax`: Red/pink monochromatic scheme
- `rare-ultra`: Vibrant rainbow spectrum with high saturation
- `wowa-holo`: Orange to blue spectrum

### 3. Opacity Patterns

- `rare-holo-galaxy`: Uses full opacity colors for bold effect
- `rare-holo-vmax`: Uses very low opacity (0.2) for subtle effect
- `rare-ultra`: Mixed high/low opacity for contrast
- `wowa-holo`: Consistent low opacity (0.2) for subtle effect

## Blend Modes & Opacity

Blend modes drastically change how effects interact with the card:

### 1. Blend Mode Combinations

- `rare-holo`: `soft-light, soft-light, screen, overlay`
- `rare-holo-galaxy`: `color-dodge, color-burn, saturation, screen`
- `rare-holo-vmax`: `soft-light, screen, overlay`
- `rare-ultra`: `color-burn, screen, soft-light`
- `wowa-holo`: `soft-light, screen, overlay`

### 2. Mix Blend Mode

- `rare-holo`: Not specified (defaults to normal)
- `rare-holo-galaxy`: `color-dodge`
- `rare-holo-vmax`: `color-dodge`
- `rare-ultra`: Not specified (defaults to normal)
- `wowa-holo`: `soft-light`

### 3. Hover Opacity

- `rare-holo`: Uses base component's 0.8 opacity
- `rare-holo-galaxy`: Uses base component's 0.8 opacity
- `rare-holo-vmax`: 0.3 opacity (more subtle)
- `rare-ultra`: Uses base component's 0.8 opacity
- `wowa-holo`: 0.4 opacity (subtle but visible)

## Filters & Visual Adjustments

Filter properties dramatically change the visual appearance:

### 1. Brightness/Contrast/Saturation

- `rare-holo`: `brightness(calc((var(--hyp) + 0.7)*0.7)) contrast(3) saturate(.35)`
- `rare-holo-galaxy`: `brightness(.75) contrast(1.2) saturate(1.5)`
- `rare-holo-vmax`: `brightness(calc((var(--hyp) + 0.8) * 0.5)) contrast(2.0) saturate(1.5)`
- `rare-ultra`: `brightness(1.1) contrast(1.5) saturate(0.85) hue-rotate(-10deg)`
- `wowa-holo`: `brightness(0.6) contrast(1.2) saturate(0.9)`

### 2. Dynamic Brightness

Some effects use mouse distance from center to adjust brightness:
```css
brightness(calc((var(--hyp) + 0.7)*0.7))
```
- `--hyp` represents the distance of the mouse from the center
- Higher values increase brightness as mouse moves away from center

### 3. Additional Filters

- `hue-rotate`: Used by `rare-ultra` to shift the color spectrum
- `contrast`: Higher values (2.0-3.0) create more defined patterns
- `saturate`: Values < 1.0 reduce color intensity, > 1.0 increase intensity

## Comparative Effect Matrix

| Feature | Standard Holo | Galaxy Holo | VMAX Holo | Ultra Rare | WOWA Holo |
|---------|--------------|-------------|-----------|------------|-----------|
| Image Used | None | galaxy.jpg (×2) | shine4.png | shine2.png | illusion.png |
| Space Value | 1.5% | 4% | 6% | 5% | 4% |
| Color Scheme | Rainbow (HSL) | Yellow to Blue | Red/Pink | Rainbow | Orange to Blue |
| Mouse Follow | Direct | Inverse | Partial | Partial | Direct |
| Opacity on Hover | 0.8 | 0.8 | 0.3 | 0.8 | 0.4 |
| Blend Mode | soft-light | color-dodge | color-dodge | screen | soft-light |
| Filter Intensity | High contrast | High saturation | Medium contrast | High brightness | Low brightness |
| Special Feature | HSL calculation | Double image | Dedicated z-index | Triple gradient | Zero base opacity |

## Creating Distinctive Effects

When creating new effects, consider combining these elements to create a unique look:

1. **Choose a Base**: Start by deciding if your effect will be texture-based (like Galaxy) or pattern-based (like Standard Holo)

2. **Interaction Style**: Decide how the effect will react to mouse movement:
   - Direct tracking (follows mouse exactly)
   - Inverse tracking (moves opposite to mouse)
   - Partial tracking (some elements follow, others don't)
   - Distance-based (effect intensity changes with mouse distance)

3. **Color Scheme**: Consider a unified theme:
   - Monochromatic (variations of one color)
   - Complementary (opposite colors)
   - Analogous (adjacent colors)
   - Full rainbow

4. **Subtlety vs. Boldness**: Balance these elements:
   - Base opacity (0 for only-on-hover effects)
   - Hover opacity (0.3-0.8 range)
   - Filter strength (brightness/contrast/saturation)
   - Blend modes (soft-light for subtle, color-dodge for bold)

5. **Special Features**: Add uniqueness with:
   - Dynamic transformations
   - Multiple layered textures
   - Custom calculation for variables
   - Hover state transitions

By thoughtfully combining these elements, you can create holographic effects that range from subtle and elegant to bold and eye-catching, each with its own distinctive character.
