import { extractCardState, extractMultipleCardStates, validateCardState } from '../utils/cardStateExtractor.js';

// Mock DOM environment for testing
const mockElement = {
  tagName: 'DIV',
  className: 'test-card',
  innerHTML: '<img alt="test" src="test.png" />',
  attributes: [
    { name: 'data-test', value: 'value' },
    { name: 'id', value: 'card-1' }
  ],
  querySelectorAll: jest.fn(),
  querySelector: jest.fn(),
  classList: {
    contains: jest.fn()
  },
  getAttribute: jest.fn((name) => {
    const attr = mockElement.attributes.find(a => a.name === name);
    return attr ? attr.value : null;
  })
};

// Mock computed styles
const mockComputedStyle = {
  length: 5,
  0: '--effect-intensity',
  1: '--h',
  2: '--s',
  3: '--l',
  4: '--space',
  getPropertyValue: jest.fn((prop) => {
    const values = {
      '--effect-intensity': '0.95',
      '--h': '58',
      '--s': '70',
      '--l': '50',
      '--space': '4',
      'transform': 'scale(1)',
      'opacity': '1',
      'filter': 'none',
      'backdrop-filter': 'none',
      'border-radius': '15px',
      'box-shadow': 'none',
      'background': 'linear-gradient(45deg, #ff0000, #00ff00)',
      'width': '300px',
      'height': '400px',
      'position': 'relative',
      'z-index': '1',
      'animation-name': 'none',
      'animation-duration': '0s',
      'animation-timing-function': 'ease',
      'scale': '1',
      'margin': '0px',
      'padding': '0px',
      'border': 'none',
      'background-image': 'none'
    };
    return values[prop] || '';
  })
};

// Mock window.getComputedStyle
Object.defineProperty(window, 'getComputedStyle', {
  value: jest.fn(() => mockComputedStyle)
});

// Mock canvas and context for image extraction
const mockCanvas = {
  width: 100,
  height: 100,
  getContext: jest.fn(() => ({
    drawImage: jest.fn()
  }))
};

const mockToDataURL = jest.fn(() => 'data:image/png;base64,test');

Object.defineProperty(window, 'HTMLCanvasElement', {
  value: class {
    constructor() {
      this.width = 100;
      this.height = 100;
      this.getContext = jest.fn(() => ({
        drawImage: jest.fn()
      }));
      this.toDataURL = jest.fn(() => 'data:image/png;base64,test');
      return this;
    }
  }
});

describe('Card State Extractor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock element
    mockElement.querySelectorAll.mockReturnValue([]);
    mockElement.classList.contains.mockReturnValue(false);
    
    // Reset computed style mock
    Object.values(mockComputedStyle).forEach(value => {
      if (typeof value === 'function') {
        value.mockClear();
      }
    });
  });

  describe('extractCardState', () => {
    it('should extract basic card state successfully', async () => {
      const state = await extractCardState(mockElement);
      
      expect(state).toBeDefined();
      expect(state.extractedAt).toBeDefined();
      expect(state.elementType).toBe('DIV');
      expect(state.className).toBe('test-card');
      expect(state.cssVariables).toBeDefined();
      expect(state.computedStyles).toBeDefined();
      expect(state.images).toBeDefined();
      expect(state.effects).toBeDefined();
      expect(state.animations).toBeDefined();
      expect(state.patterns).toBeDefined();
      expect(state.layout).toBeDefined();
      expect(state.innerHTML).toBeDefined();
      expect(state.attributes).toBeDefined();
    });

    it('should extract CSS variables correctly', async () => {
      const state = await extractCardState(mockElement);
      
      expect(state.cssVariables).toEqual({
        '--effect-intensity': '0.95',
        '--h': '58',
        '--s': '70',
        '--l': '50',
        '--space': '4'
      });
    });

    it('should extract computed styles correctly', async () => {
      const state = await extractCardState(mockElement);
      
      expect(state.computedStyles).toEqual({
        'transform': 'scale(1)',
        'opacity': '1',
        'border-radius': '15px',
        'background': 'linear-gradient(45deg, #ff0000, #00ff00)',
        'width': '300px',
        'height': '400px',
        'position': 'relative',
        'z-index': '1'
      });
    });

    it('should extract layout information correctly', async () => {
      const state = await extractCardState(mockElement);
      
      expect(state.layout).toEqual({
        'position': 'relative',
        'transform': 'scale(1)',
        'transformOrigin': '',
        'width': '300px',
        'height': '400px',
        'scale': '1',
        'margin': '0px',
        'padding': '0px',
        'borderRadius': '15px',
        'border': 'none'
      });
    });

    it('should extract attributes correctly', async () => {
      const state = await extractCardState(mockElement);
      
      expect(state.attributes).toEqual({
        'data-test': 'value',
        'id': 'card-1'
      });
    });

    it('should throw error when element is null', async () => {
      await expect(extractCardState(null)).rejects.toThrow('Card element is required for state extraction');
    });

    it('should throw error when element is undefined', async () => {
      await expect(extractCardState(undefined)).rejects.toThrow('Card element is required for state extraction');
    });
  });

  describe('extractMultipleCardStates', () => {
    it('should extract states from multiple elements', async () => {
      const elements = [mockElement, { ...mockElement, className: 'card-2' }];
      
      const states = await extractMultipleCardStates(elements);
      
      expect(states).toHaveLength(2);
      expect(states[0].className).toBe('test-card');
      expect(states[1].className).toBe('card-2');
    });

    it('should handle errors gracefully for individual elements', async () => {
      const elements = [mockElement, null, { ...mockElement, className: 'card-3' }];
      
      const states = await extractMultipleCardStates(elements);
      
      expect(states).toHaveLength(2); // Only successful extractions are returned
      expect(states[0].className).toBe('test-card');
      expect(states[1].className).toBe('card-3');
    });

    it('should return empty array for empty input', async () => {
      const states = await extractMultipleCardStates([]);
      
      expect(states).toEqual([]);
    });
  });

  describe('validateCardState', () => {
    it('should validate complete state successfully', () => {
      const validState = {
        cssVariables: { '--test': 'value' },
        computedStyles: { 'color': 'red' },
        images: { 'test': {} }
      };
      
      const validation = validateCardState(validState);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing CSS variables', () => {
      const invalidState = {
        computedStyles: { 'color': 'red' },
        images: { 'test': {} }
      };
      
      const validation = validateCardState(invalidState);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('CSS variables are missing');
    });

    it('should detect missing computed styles', () => {
      const invalidState = {
        cssVariables: { '--test': 'value' },
        images: { 'test': {} }
      };
      
      const validation = validateCardState(invalidState);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Computed styles are missing');
    });

    it('should detect missing images', () => {
      const invalidState = {
        cssVariables: { '--test': 'value' },
        computedStyles: { 'color': 'red' }
      };
      
      const validation = validateCardState(invalidState);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Image data is missing');
    });

    it('should detect empty CSS variables', () => {
      const invalidState = {
        cssVariables: {},
        computedStyles: { 'color': 'red' },
        images: { 'test': {} }
      };
      
      const validation = validateCardState(invalidState);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('No CSS variables were extracted');
    });
  });

  describe('Effect extraction', () => {
    it('should extract holo effects when present', async () => {
      const holoElement = {
        ...mockElement,
        className: 'holo-effect',
        querySelectorAll: jest.fn()
      };
      
      holoElement.querySelectorAll.mockReturnValue([holoElement]);
      
      const state = await extractCardState(holoElement);
      
      expect(state.effects.holo).toBeDefined();
      expect(state.effects.holo.enabled).toBe(true);
      expect(state.effects.holo.elements).toHaveLength(1);
    });

    it('should extract shine effects when present', async () => {
      const shineElement = {
        ...mockElement,
        className: 'shine-effect',
        querySelectorAll: jest.fn()
      };
      
      shineElement.querySelectorAll.mockReturnValue([shineElement]);
      
      const state = await extractCardState(shineElement);
      
      expect(state.effects.shine).toBeDefined();
      expect(state.effects.shine.enabled).toBe(true);
      expect(state.effects.shine.elements).toHaveLength(1);
    });
  });

  describe('Animation extraction', () => {
    it('should detect floating animation', async () => {
      mockElement.classList.contains.mockReturnValue(true);
      
      const state = await extractCardState(mockElement);
      
      expect(state.animations.floating).toBe(true);
    });
  });
}); 