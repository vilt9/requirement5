/**
 * Comprehensive Card State Extractor
 * Captures EVERY SINGLE DETAIL of a customized card for perfect restoration
 */

// Extract all CSS custom properties from an element
const extractCSSVariables = (element) => {
  const computedStyle = window.getComputedStyle(element);
  const cssVariables = {};
  
  // Get all CSS custom properties
  for (let i = 0; i < computedStyle.length; i++) {
    const property = computedStyle[i];
    if (property.startsWith('--')) {
      cssVariables[property] = computedStyle.getPropertyValue(property);
    }
  }
  
  return cssVariables;
};

// Extract computed styles for critical properties
const extractComputedStyles = (element) => {
  const computedStyle = window.getComputedStyle(element);
  const criticalStyles = {};
  
  // Critical visual properties
  const criticalProperties = [
    'transform', 'opacity', 'filter', 'backdrop-filter',
    'border-radius', 'box-shadow', 'background',
    'width', 'height', 'position', 'z-index'
  ];
  
  criticalProperties.forEach(prop => {
    const value = computedStyle.getPropertyValue(prop);
    if (value && value !== 'none' && value !== 'normal') {
      criticalStyles[prop] = value;
    }
  });
  
  return criticalStyles;
};

// Extract image data and convert to base64
const extractImageData = async (element) => {
  const images = {};
  
  // Find all img elements within the card
  const imgElements = element.querySelectorAll('img');
  
  for (const img of imgElements) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to match image
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      
      // Draw image to canvas
      ctx.drawImage(img, 0, 0);
      
      // Convert to base64
      const dataURL = canvas.toDataURL('image/png');
      
      // Store image data with metadata
      images[img.alt || 'image'] = {
        src: dataURL,
        alt: img.alt || '',
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        className: img.className,
        style: img.getAttribute('style') || ''
      };
    } catch (error) {
      console.warn('Failed to extract image data:', error);
      // Fallback to original src
      images[img.alt || 'image'] = {
        src: img.src,
        alt: img.alt || '',
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        className: img.className,
        style: img.getAttribute('style') || ''
      };
    }
  }
  
  return images;
};

// Extract effect states and animations
const extractEffectStates = (element) => {
  const effects = {};
  
  // Extract holo effect properties
  const holoElements = element.querySelectorAll('[class*="holo"]');
  if (holoElements.length > 0) {
    effects.holo = {
      enabled: true,
      elements: Array.from(holoElements).map(el => ({
        className: el.className,
        cssVariables: extractCSSVariables(el),
        computedStyles: extractComputedStyles(el)
      }))
    };
  }
  
  // Extract shine effects
  const shineElements = element.querySelectorAll('[class*="shine"]');
  if (shineElements.length > 0) {
    effects.shine = {
      enabled: true,
      elements: Array.from(shineElements).map(el => ({
        className: el.className,
        cssVariables: extractCSSVariables(el),
        computedStyles: extractComputedStyles(el)
      }))
    };
  }
  
  // Extract aberration effects
  const aberrationElements = element.querySelectorAll('[class*="aberration"]');
  if (aberrationElements.length > 0) {
    effects.aberration = {
      enabled: true,
      elements: Array.from(aberrationElements).map(el => ({
        className: el.className,
        cssVariables: extractCSSVariables(el),
        computedStyles: extractComputedStyles(el)
      }))
    };
  }
  
  // Extract edge highlight effects
  const edgeElements = element.querySelectorAll('[class*="edge"]');
  if (edgeElements.length > 0) {
    effects.edgeHighlight = {
      enabled: true,
      elements: Array.from(edgeElements).map(el => ({
        className: el.className,
        cssVariables: extractCSSVariables(el),
        computedStyles: extractComputedStyles(el)
      }))
    };
  }
  
  return effects;
};

// Extract animation and timing states
const extractAnimationStates = (element) => {
  const animations = {};
  
  // Check for floating animation
  if (element.classList.contains('floating')) {
    animations.floating = true;
  }
  
  // Check for time effects
  const timeElements = element.querySelectorAll('[class*="day"], [class*="night"]');
  if (timeElements.length > 0) {
    animations.timeEffects = {
      isNight: element.querySelector('[class*="night"]') !== null,
      mode: element.querySelector('[class*="night"]') ? 'night' : 'day'
    };
  }
  
  // Extract CSS animations
  const computedStyle = window.getComputedStyle(element);
  const animationName = computedStyle.getPropertyValue('animation-name');
  const animationDuration = computedStyle.getPropertyValue('animation-duration');
  const animationTimingFunction = computedStyle.getPropertyValue('animation-timing-function');
  
  if (animationName && animationName !== 'none') {
    animations.cssAnimations = {
      name: animationName,
      duration: animationDuration,
      timingFunction: animationTimingFunction
    };
  }
  
  return animations;
};

// Extract pattern and texture information
const extractPatternInfo = (element) => {
  const patterns = {};
  
  // Look for pattern-related elements
  const patternElements = element.querySelectorAll('[class*="pattern"]');
  if (patternElements.length > 0) {
    patterns.elements = Array.from(patternElements).map(el => ({
      className: el.className,
      cssVariables: extractCSSVariables(el),
      computedStyles: extractComputedStyles(el)
    }));
  }
  
  // Extract background patterns from CSS
  const computedStyle = window.getComputedStyle(element);
  const backgroundImage = computedStyle.getPropertyValue('background-image');
  
  if (backgroundImage && backgroundImage !== 'none') {
    patterns.backgroundImage = backgroundImage;
  }
  
  return patterns;
};

// Extract layout and positioning information
const extractLayoutInfo = (element) => {
  const layout = {};
  
  const computedStyle = window.getComputedStyle(element);
  
  // Position and transform
  layout.position = computedStyle.getPropertyValue('position');
  layout.transform = computedStyle.getPropertyValue('transform');
  layout.transformOrigin = computedStyle.getPropertyValue('transform-origin');
  
  // Dimensions
  layout.width = computedStyle.getPropertyValue('width');
  layout.height = computedStyle.getPropertyValue('height');
  layout.scale = computedStyle.getPropertyValue('scale');
  
  // Spacing
  layout.margin = computedStyle.getPropertyValue('margin');
  layout.padding = computedStyle.getPropertyValue('padding');
  
  // Border and radius
  layout.borderRadius = computedStyle.getPropertyValue('border-radius');
  layout.border = computedStyle.getPropertyValue('border');
  
  return layout;
};

// Main extraction function
export const extractCardState = async (cardElement) => {
  if (!cardElement) {
    throw new Error('Card element is required for state extraction');
  }
  
  try {
    const state = {
      // Metadata
      extractedAt: new Date().toISOString(),
      elementType: cardElement.tagName,
      className: cardElement.className,
      
      // CSS Variables (the most critical part)
      cssVariables: extractCSSVariables(cardElement),
      
      // Computed styles
      computedStyles: extractComputedStyles(cardElement),
      
      // Images
      images: await extractImageData(cardElement),
      
      // Effects
      effects: extractEffectStates(cardElement),
      
      // Animations
      animations: extractAnimationStates(cardElement),
      
      // Patterns
      patterns: extractPatternInfo(cardElement),
      
      // Layout
      layout: extractLayoutInfo(cardElement),
      
      // Inner HTML structure (for complex cases)
      innerHTML: cardElement.innerHTML,
      
      // All attributes
      attributes: Array.from(cardElement.attributes).reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
      }, {})
    };
    
    return state;
  } catch (error) {
    console.error('Failed to extract card state:', error);
    throw new Error(`State extraction failed: ${error.message}`);
  }
};

// Extract state from multiple cards
export const extractMultipleCardStates = async (cardElements) => {
  const states = [];
  
  for (const element of cardElements) {
    try {
      const state = await extractCardState(element);
      states.push(state);
    } catch (error) {
      console.warn('Failed to extract state from card element:', error);
    }
  }
  
  return states;
};

// Validate extracted state
export const validateCardState = (state) => {
  const errors = [];
  
  if (!state.cssVariables) {
    errors.push('CSS variables are missing');
  }
  
  if (!state.computedStyles) {
    errors.push('Computed styles are missing');
  }
  
  if (!state.images) {
    errors.push('Image data is missing');
  }
  
  if (Object.keys(state.cssVariables || {}).length === 0) {
    errors.push('No CSS variables were extracted');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}; 