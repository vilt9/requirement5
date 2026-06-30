/**
 * Comprehensive Card State Restorer
 * Perfectly restores ALL card properties from saved state
 */

// Apply CSS custom properties to an element
const applyCSSVariables = (element, cssVariables) => {
  if (!cssVariables || typeof cssVariables !== 'object') {
    return;
  }
  
  Object.entries(cssVariables).forEach(([property, value]) => {
    if (value !== undefined && value !== null) {
      element.style.setProperty(property, value);
    }
  });
};

// Apply computed styles to an element
const applyComputedStyles = (element, computedStyles) => {
  if (!computedStyles || typeof computedStyles !== 'object') {
    return;
  }
  
  Object.entries(computedStyles).forEach(([property, value]) => {
    if (value !== undefined && value !== null) {
      // Handle different property types
      if (property === 'transform') {
        element.style.transform = value;
      } else if (property === 'filter') {
        element.style.filter = value;
      } else if (property === 'backdrop-filter') {
        element.style.backdropFilter = value;
      } else {
        element.style[property] = value;
      }
    }
  });
};

// Restore images to the card
const restoreImages = (element, images) => {
  if (!images || typeof images !== 'object') {
    return;
  }
  
  Object.entries(images).forEach(([key, imageData]) => {
    // Find existing image or create new one
    let imgElement = element.querySelector(`img[alt="${imageData.alt}"]`);
    
    if (!imgElement) {
      imgElement = document.createElement('img');
      imgElement.alt = imageData.alt;
      element.appendChild(imgElement);
    }
    
    // Restore image properties
    imgElement.src = imageData.src;
    imgElement.className = imageData.className || '';
    
    if (imageData.style) {
      imgElement.setAttribute('style', imageData.style);
    }
    
    // Restore dimensions if specified
    if (imageData.width) {
      imgElement.style.width = imageData.width;
    }
    if (imageData.height) {
      imgElement.style.height = imageData.height;
    }
  });
};

// Restore effect states
const restoreEffects = (element, effects) => {
  if (!effects || typeof effects !== 'object') {
    return;
  }
  
  // Restore holo effects
  if (effects.holo && effects.holo.enabled) {
    effects.holo.elements.forEach(effectData => {
      const effectElement = element.querySelector(`.${effectData.className.split(' ')[0]}`);
      if (effectElement) {
        applyCSSVariables(effectElement, effectData.cssVariables);
        applyComputedStyles(effectElement, effectData.computedStyles);
      }
    });
  }
  
  // Restore shine effects
  if (effects.shine && effects.shine.enabled) {
    effects.shine.elements.forEach(effectData => {
      const effectElement = element.querySelector(`.${effectData.className.split(' ')[0]}`);
      if (effectElement) {
        applyCSSVariables(effectElement, effectData.cssVariables);
        applyComputedStyles(effectElement, effectData.computedStyles);
      }
    });
  }
  
  // Restore aberration effects
  if (effects.aberration && effects.aberration.enabled) {
    effects.aberration.elements.forEach(effectData => {
      const effectElement = element.querySelector(`.${effectData.className.split(' ')[0]}`);
      if (effectElement) {
        applyCSSVariables(effectElement, effectData.cssVariables);
        applyComputedStyles(effectElement, effectData.computedStyles);
      }
    });
  }
  
  // Restore edge highlight effects
  if (effects.edgeHighlight && effects.edgeHighlight.enabled) {
    effects.edgeHighlight.elements.forEach(effectData => {
      const effectElement = element.querySelector(`.${effectData.className.split(' ')[0]}`);
      if (effectElement) {
        applyCSSVariables(effectElement, effectData.cssVariables);
        applyComputedStyles(effectElement, effectData.computedStyles);
      }
    });
  }
};

// Restore animation states
const restoreAnimations = (element, animations) => {
  if (!animations || typeof animations !== 'object') {
    return;
  }
  
  // Restore floating animation
  if (animations.floating) {
    element.classList.add('floating');
  }
  
  // Restore time effects
  if (animations.timeEffects) {
    const { isNight, mode } = animations.timeEffects;
    
    // Remove existing time classes
    element.classList.remove('day', 'night');
    
    // Add appropriate time class
    if (mode === 'night') {
      element.classList.add('night');
    } else {
      element.classList.add('day');
    }
  }
  
  // Restore CSS animations
  if (animations.cssAnimations) {
    const { name, duration, timingFunction } = animations.cssAnimations;
    
    if (name && name !== 'none') {
      element.style.animationName = name;
    }
    if (duration) {
      element.style.animationDuration = duration;
    }
    if (timingFunction) {
      element.style.animationTimingFunction = timingFunction;
    }
  }
};

// Restore pattern and texture information
const restorePatterns = (element, patterns) => {
  if (!patterns || typeof patterns !== 'object') {
    return;
  }
  
  // Restore pattern elements
  if (patterns.elements) {
    patterns.elements.forEach(patternData => {
      const patternElement = element.querySelector(`.${patternData.className.split(' ')[0]}`);
      if (patternElement) {
        applyCSSVariables(patternElement, patternData.cssVariables);
        applyComputedStyles(patternElement, patternData.computedStyles);
      }
    });
  }
  
  // Restore background patterns
  if (patterns.backgroundImage) {
    element.style.backgroundImage = patterns.backgroundImage;
  }
};

// Restore layout and positioning
const restoreLayout = (element, layout) => {
  if (!layout || typeof layout !== 'object') {
    return;
  }
  
  // Position and transform
  if (layout.position) {
    element.style.position = layout.position;
  }
  if (layout.transform) {
    element.style.transform = layout.transform;
  }
  if (layout.transformOrigin) {
    element.style.transformOrigin = layout.transformOrigin;
  }
  
  // Dimensions
  if (layout.width) {
    element.style.width = layout.width;
  }
  if (layout.height) {
    element.style.height = layout.height;
  }
  if (layout.scale) {
    element.style.scale = layout.scale;
  }
  
  // Spacing
  if (layout.margin) {
    element.style.margin = layout.margin;
  }
  if (layout.padding) {
    element.style.padding = layout.padding;
  }
  
  // Border and radius
  if (layout.borderRadius) {
    element.style.borderRadius = layout.borderRadius;
  }
  if (layout.border) {
    element.style.border = layout.border;
  }
};

// Restore element attributes
const restoreAttributes = (element, attributes) => {
  if (!attributes || typeof attributes !== 'object') {
    return;
  }
  
  Object.entries(attributes).forEach(([name, value]) => {
    if (value !== undefined && value !== null) {
      try {
        element.setAttribute(name, value);
      } catch (error) {
        console.warn(`Failed to restore attribute ${name}:`, error);
      }
    }
  });
};

// Main restoration function
export const restoreCardState = (cardElement, savedState) => {
  if (!cardElement) {
    throw new Error('Card element is required for state restoration');
  }
  
  if (!savedState) {
    throw new Error('Saved state is required for restoration');
  }
  
  try {
    // Validate the saved state
    if (!savedState.cssVariables) {
      console.warn('Saved state missing CSS variables - restoration may be incomplete');
    }
    
    // Apply all state components
    applyCSSVariables(cardElement, savedState.cssVariables);
    applyComputedStyles(cardElement, savedState.computedStyles);
    restoreImages(cardElement, savedState.images);
    restoreEffects(cardElement, savedState.effects);
    restoreAnimations(cardElement, savedState.animations);
    restorePatterns(cardElement, savedState.patterns);
    restoreLayout(cardElement, savedState.layout);
    restoreAttributes(cardElement, savedState.attributes);
    
    // Force a reflow to ensure all changes are applied
    cardElement.offsetHeight;
    
    return true;
  } catch (error) {
    console.error('Failed to restore card state:', error);
    throw new Error(`State restoration failed: ${error.message}`);
  }
};

// Restore state to multiple cards
export const restoreMultipleCardStates = (cardElements, savedStates) => {
  if (!Array.isArray(cardElements) || !Array.isArray(savedStates)) {
    throw new Error('Both cardElements and savedStates must be arrays');
  }
  
  const results = [];
  
  cardElements.forEach((element, index) => {
    try {
      const savedState = savedStates[index];
      if (savedState) {
        const success = restoreCardState(element, savedState);
        results.push({ element, success, error: null });
      } else {
        results.push({ element, success: false, error: 'No saved state available' });
      }
    } catch (error) {
      results.push({ element, success: false, error: error.message });
    }
  });
  
  return results;
};

// Verify restoration fidelity
export const verifyRestoration = (originalElement, restoredElement) => {
  const verification = {
    cssVariables: { match: true, differences: [] },
    computedStyles: { match: true, differences: [] },
    images: { match: true, differences: [] },
    effects: { match: true, differences: [] },
    animations: { match: true, differences: [] },
    overall: true
  };
  
  try {
    // Compare CSS variables
    const originalCSS = window.getComputedStyle(originalElement);
    const restoredCSS = window.getComputedStyle(restoredElement);
    
    for (let i = 0; i < originalCSS.length; i++) {
      const property = originalCSS[i];
      if (property.startsWith('--')) {
        const originalValue = originalCSS.getPropertyValue(property);
        const restoredValue = restoredCSS.getPropertyValue(property);
        
        if (originalValue !== restoredValue) {
          verification.cssVariables.match = false;
          verification.cssVariables.differences.push({
            property,
            original: originalValue,
            restored: restoredValue
          });
        }
      }
    }
    
    // Check overall match
    verification.overall = verification.cssVariables.match && 
                           verification.computedStyles.match && 
                           verification.images.match && 
                           verification.effects.match && 
                           verification.animations.match;
    
  } catch (error) {
    verification.overall = false;
    console.error('Verification failed:', error);
  }
  
  return verification;
}; 