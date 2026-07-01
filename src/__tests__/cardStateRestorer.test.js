import { restoreCardState, restoreMultipleCardStates, verifyRestoration } from '../utils/cardStateRestorer.js';

// Mock DOM element for testing
const createMockElement = () => ({
  style: {
    setProperty: jest.fn(),
    transform: '',
    filter: '',
    backdropFilter: '',
    width: '',
    height: '',
    position: '',
    zIndex: '',
    animationName: '',
    animationDuration: '',
    animationTimingFunction: '',
    scale: '',
    margin: '',
    padding: '',
    borderRadius: '',
    border: '',
    backgroundImage: ''
  },
  classList: {
    add: jest.fn(),
    remove: jest.fn(),
    contains: jest.fn()
  },
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(),
  appendChild: jest.fn(),
  setAttribute: jest.fn(),
  offsetHeight: 100
});

// Mock computed styles for verification
const mockComputedStyle = {
  length: 3,
  0: '--effect-intensity',
  1: '--h',
  2: '--s',
  getPropertyValue: jest.fn((prop) => {
    const values = {
      '--effect-intensity': '0.95',
      '--h': '58',
      '--s': '70'
    };
    return values[prop] || '';
  })
};

// Mock window.getComputedStyle
Object.defineProperty(window, 'getComputedStyle', {
  value: jest.fn(() => mockComputedStyle)
});

describe('Card State Restorer', () => {
  let mockElement;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockElement = createMockElement();
    
    // Reset computed style mock
    Object.values(mockComputedStyle).forEach(value => {
      if (typeof value === 'function') {
        value.mockClear();
      }
    });
  });

  describe('restoreCardState', () => {
    it('should restore CSS variables successfully', () => {
      const savedState = {
        cssVariables: {
          '--effect-intensity': '0.95',
          '--h': '58',
          '--s': '70'
        }
      };
      
      restoreCardState(mockElement, savedState);
      
      expect(mockElement.style.setProperty).toHaveBeenCalledWith('--effect-intensity', '0.95');
      expect(mockElement.style.setProperty).toHaveBeenCalledWith('--h', '58');
      expect(mockElement.style.setProperty).toHaveBeenCalledWith('--s', '70');
    });

    it('should restore computed styles successfully', () => {
      const savedState = {
        computedStyles: {
          'transform': 'scale(1.2)',
          'opacity': '0.8',
          'filter': 'blur(2px)',
          'backdrop-filter': 'blur(5px)'
        }
      };
      
      restoreCardState(mockElement, savedState);
      
      expect(mockElement.style.transform).toBe('scale(1.2)');
      expect(mockElement.style.opacity).toBe('0.8');
      expect(mockElement.style.filter).toBe('blur(2px)');
      expect(mockElement.style.backdropFilter).toBe('blur(5px)');
    });

    it('should restore images successfully', () => {
      const savedState = {
        images: {
          'test-image': {
            src: 'data:image/png;base64,test',
            alt: 'test-image',
            className: 'test-class',
            style: 'width: 100px; height: 100px;',
            width: '100px',
            height: '100px'
          }
        }
      };
      
      // Mock querySelector to return null (image doesn't exist)
      mockElement.querySelector.mockReturnValue(null);
      
      restoreCardState(mockElement, savedState);
      
      expect(mockElement.appendChild).toHaveBeenCalled();
    });

    it('should restore holo effects successfully', () => {
      const savedState = {
        effects: {
          holo: {
            enabled: true,
            elements: [{
              className: 'holo-effect',
              cssVariables: { '--holo-intensity': '0.8' },
              computedStyles: { 'opacity': '0.9' }
            }]
          }
        }
      };
      
      const mockHoloElement = createMockElement();
      mockElement.querySelector.mockReturnValue(mockHoloElement);
      
      restoreCardState(mockElement, savedState);
      
      expect(mockHoloElement.style.setProperty).toHaveBeenCalledWith('--holo-intensity', '0.8');
    });

    it('should restore shine effects successfully', () => {
      const savedState = {
        effects: {
          shine: {
            enabled: true,
            elements: [{
              className: 'shine-effect',
              cssVariables: { '--shine-color': 'rgba(255,255,255,0.5)' },
              computedStyles: { 'opacity': '0.7' }
            }]
          }
        }
      };
      
      const mockShineElement = createMockElement();
      mockElement.querySelector.mockReturnValue(mockShineElement);
      
      restoreCardState(mockElement, savedState);
      
      expect(mockShineElement.style.setProperty).toHaveBeenCalledWith('--shine-color', 'rgba(255,255,255,0.5)');
    });

    it('should restore floating animation successfully', () => {
      const savedState = {
        animations: {
          floating: true
        }
      };
      
      restoreCardState(mockElement, savedState);
      
      expect(mockElement.classList.add).toHaveBeenCalledWith('floating');
    });

    it('should restore CSS animations successfully', () => {
      const savedState = {
        animations: {
          cssAnimations: {
            name: 'fade-in',
            duration: '2s',
            timingFunction: 'ease-in-out'
          }
        }
      };
      
      restoreCardState(mockElement, savedState);
      
      expect(mockElement.style.animationName).toBe('fade-in');
      expect(mockElement.style.animationDuration).toBe('2s');
      expect(mockElement.style.animationTimingFunction).toBe('ease-in-out');
    });

    it('should restore patterns successfully', () => {
      const savedState = {
        patterns: {
          backgroundImage: 'linear-gradient(45deg, #ff0000, #00ff00)'
        }
      };
      
      restoreCardState(mockElement, savedState);
      
      expect(mockElement.style.backgroundImage).toBe('linear-gradient(45deg, #ff0000, #00ff00)');
    });

    it('should restore layout properties successfully', () => {
      const savedState = {
        layout: {
          position: 'absolute',
          transform: 'rotate(45deg)',
          transformOrigin: 'center',
          width: '400px',
          height: '500px',
          scale: '1.5',
          margin: '20px',
          padding: '10px',
          borderRadius: '25px',
          border: '2px solid #333'
        }
      };
      
      restoreCardState(mockElement, savedState);
      
      expect(mockElement.style.position).toBe('absolute');
      expect(mockElement.style.transform).toBe('rotate(45deg)');
      expect(mockElement.style.transformOrigin).toBe('center');
      expect(mockElement.style.width).toBe('400px');
      expect(mockElement.style.height).toBe('500px');
      expect(mockElement.style.scale).toBe('1.5');
      expect(mockElement.style.margin).toBe('20px');
      expect(mockElement.style.padding).toBe('10px');
      expect(mockElement.style.borderRadius).toBe('25px');
      expect(mockElement.style.border).toBe('2px solid #333');
    });

    it('should restore attributes successfully', () => {
      const savedState = {
        attributes: {
          'data-test': 'value',
          'id': 'restored-card'
        }
      };
      
      restoreCardState(mockElement, savedState);
      
      expect(mockElement.setAttribute).toHaveBeenCalledWith('data-test', 'value');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('id', 'restored-card');
    });

    it('should throw error when element is null', () => {
      const savedState = { cssVariables: {} };
      
      expect(() => restoreCardState(null, savedState)).toThrow('Card element is required for state restoration');
    });

    it('should throw error when saved state is null', () => {
      expect(() => restoreCardState(mockElement, null)).toThrow('Saved state is required for restoration');
    });

    it('should handle missing CSS variables gracefully', () => {
      const savedState = {
        computedStyles: { 'color': 'red' }
      };
      
      // Should not throw error
      expect(() => restoreCardState(mockElement, savedState)).not.toThrow();
    });

    it('should force reflow after restoration', () => {
      const savedState = { cssVariables: { '--test': 'value' } };
      
      restoreCardState(mockElement, savedState);
      
      // Should access offsetHeight to force reflow
      expect(mockElement.offsetHeight).toBe(100);
    });
  });

  describe('restoreMultipleCardStates', () => {
    it('should restore states to multiple elements successfully', () => {
      const elements = [createMockElement(), createMockElement()];
      const savedStates = [
        { cssVariables: { '--test1': 'value1' } },
        { cssVariables: { '--test2': 'value2' } }
      ];
      
      const results = restoreMultipleCardStates(elements, savedStates);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[0].error).toBeNull();
      expect(results[1].error).toBeNull();
    });

    it('should handle missing saved states gracefully', () => {
      const elements = [createMockElement(), createMockElement()];
      const savedStates = [{ cssVariables: { '--test': 'value' } }];
      
      const results = restoreMultipleCardStates(elements, savedStates);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('No saved state available');
    });

    it('should handle restoration errors gracefully', () => {
      const elements = [createMockElement()];
      const savedStates = [{ cssVariables: { '--test': 'value' } }];
      
      // Mock setProperty to throw error
      elements[0].style.setProperty.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const results = restoreMultipleCardStates(elements, savedStates);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('State restoration failed: Test error');
    });

    it('should throw error for invalid inputs', () => {
      expect(() => restoreMultipleCardStates('invalid', [])).toThrow('Both cardElements and savedStates must be arrays');
      expect(() => restoreMultipleCardStates([], 'invalid')).toThrow('Both cardElements and savedStates must be arrays');
    });
  });

  describe('verifyRestoration', () => {
    it('should verify successful restoration', () => {
      const originalElement = createMockElement();
      const restoredElement = createMockElement();
      
      const verification = verifyRestoration(originalElement, restoredElement);
      
      expect(verification.overall).toBe(true);
      expect(verification.cssVariables.match).toBe(true);
      expect(verification.computedStyles.match).toBe(true);
      expect(verification.images.match).toBe(true);
      expect(verification.effects.match).toBe(true);
      expect(verification.animations.match).toBe(true);
    });

    it('should detect CSS variable differences', () => {
      const originalElement = createMockElement();
      const restoredElement = createMockElement();
      
      // Mock different CSS variable values
      const mockOriginalCSS = {
        length: 1,
        0: '--test',
        getPropertyValue: jest.fn(() => 'original-value')
      };
      
      const mockRestoredCSS = {
        length: 1,
        0: '--test',
        getPropertyValue: jest.fn(() => 'restored-value')
      };
      
      window.getComputedStyle
        .mockReturnValueOnce(mockOriginalCSS)
        .mockReturnValueOnce(mockRestoredCSS);
      
      const verification = verifyRestoration(originalElement, restoredElement);
      
      expect(verification.cssVariables.match).toBe(false);
      expect(verification.cssVariables.differences).toHaveLength(1);
      expect(verification.cssVariables.differences[0].property).toBe('--test');
      expect(verification.cssVariables.differences[0].original).toBe('original-value');
      expect(verification.cssVariables.differences[0].restored).toBe('restored-value');
    });

    it('should handle verification errors gracefully', () => {
      const originalElement = createMockElement();
      const restoredElement = createMockElement();
      
      // Mock getComputedStyle to throw error
      window.getComputedStyle.mockImplementation(() => {
        throw new Error('Verification error');
      });
      
      const verification = verifyRestoration(originalElement, restoredElement);
      
      expect(verification.overall).toBe(false);
    });
  });
}); 