import { useState, useEffect } from 'react';
import styled from 'styled-components';
import Card from '../components/Card/Card';
import { useCards } from '../context/CardContext';
import { api } from '../utils/api';
// Import our new components
import ControlSection from '../components/CardCustomizer/ControlSection';
import ImageUploader from '../components/CardCustomizer/ImageUploader';
import ParameterControl from '../components/CardCustomizer/ParameterControl';
import HoloEffectControls from '../components/CardCustomizer/HoloEffectControls';
import HoloEffectToggles from '../components/CardCustomizer/HoloEffectToggles';
import ImageEffectControls from '../components/CardCustomizer/ImageEffectControls';
import EdgeHighlightControls from '../components/CardCustomizer/EdgeHighlightControls';
import CentralPanelControls from '../components/CardCustomizer/CentralPanelControls';
import SaveCard from '../components/CardCustomizer/SaveCard';
import PublishPanel from '../components/PublishPanel';
import ColorPicker from '../components/CardCustomizer/ColorPicker';
import BlendModeSelector from '../components/CardCustomizer/BlendModeSelector';
import BaseBackgroundControls from '../components/CardCustomizer/BaseBackgroundControls';
import { generateBaseBackground } from '../utils/cardGenerator';
import { applyPreset } from '../utils/presets';
import { TagInput, Select, TextInput, PillButton, Dim } from '../components/UI';

// Each tab groups the controls for one part of the card, so it's clear what
// you're editing instead of scrolling one long list.
const TABS = [
  { key: 'image', label: 'Image' },
  { key: 'holo', label: 'Holographic' },
  { key: 'frame', label: 'Frame' },
  { key: 'background', label: 'Background' },
];

const CardCustomizer = () => {
  const {
    currentCard, generateNewCard, saveCard, updateCustomCard, saveCustomImage, customImages,
    presets, savePreset, deletePreset
  } = useCards();
  const [customCard, setCustomCard] = useState(null);
  const [activeTab, setActiveTab] = useState('image');
  const [mainImageFile, setMainImageFile] = useState(null);
  const [holoImageFile, setHoloImageFile] = useState(null);
  const [mainImagePreview, setMainImagePreview] = useState(null);
  const [holoImagePreview, setHoloImagePreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [includeImages, setIncludeImages] = useState(false);
  
  // Initialize with a card if none exists
  useEffect(() => {
    if (!currentCard) {
      generateNewCard();
    } else {
      // Ensure the customCard has all the necessary properties
      const initializedCard = {
        ...currentCard,
        customHoloImageUrl: currentCard.customHoloImageUrl || null,
        tags: Array.isArray(currentCard.tags) ? currentCard.tags : [],
        // Seed a base background for older cards saved before this field existed.
        baseBackground: currentCard.baseBackground
          || generateBaseBackground(currentCard.backgroundColor?.baseHue),
        holoEffects: currentCard.holoEffects || {
          rareHolo: false,
          rareHoloGalaxy: false,
          wowaHolo: false,
          rareHoloVmax: false
        }
      };
      setCustomCard(initializedCard);
    }
  }, [currentCard]);
  
  // Load custom images if they exist
  useEffect(() => {
    if (customImages) {
      if (customImages.mainImage) {
        setMainImagePreview(customImages.mainImage);
      }
      if (customImages.holoImage) {
        setHoloImagePreview(customImages.holoImage);
      }
    }
  }, [customImages]);
  
  // Handle main image file selection
  const handleMainImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setMainImageFile(file);
    
    // Create a preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageDataUrl = reader.result;
      setMainImagePreview(imageDataUrl);
      
      // Update card with new image
      if (customCard) {
        // For custom images, we need to use a special format that Card component will recognize
        // Instead of setting imagePath directly, we'll create a custom image object
        // that the Card component can handle properly
        const updatedCard = { 
          ...customCard, 
          customImageUrl: imageDataUrl, // Add the data URL directly to the card
          imagePath: 'custom_image' // Set a marker so the Card component can use the customImageUrl
        };
        setCustomCard(updatedCard);
        saveCustomImage('mainImage', imageDataUrl);
      }
    };
    reader.readAsDataURL(file);
  };
  
  // Handle parameter changes with sliders or direct input
  // Roll a fresh coherent base background (palette + fade + texture) in one click.
  const handleRandomizeBackground = () => {
    if (!customCard) return;
    setCustomCard({ ...customCard, baseBackground: generateBaseBackground() });
  };

  // Tags edited in the footer; stored on the card so they travel with save/publish.
  const setTags = (tags) => {
    if (!customCard) return;
    setCustomCard({ ...customCard, tags });
  };

  // --- Preset sets ---
  // Apply a saved set's design + default tags onto the current card (keeps the image).
  const handleLoadPreset = (presetId) => {
    setSelectedPresetId(presetId);
    if (!presetId || !customCard) return;
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;
    const next = applyPreset(customCard, preset);
    setCustomCard(next);
    updateCustomCard(next);
    // If the set carried images, reflect them in the upload previews too.
    if (preset.images?.customImageUrl) setMainImagePreview(preset.images.customImageUrl);
    if (preset.images?.customHoloImageUrl) setHoloImagePreview(preset.images.customHoloImageUrl);
    setFeedback(`Loaded set "${preset.name}"${preset.images ? ' (with images)' : ''}.`);
    setTimeout(() => setFeedback(null), 4000);
  };

  // Save the current design + tags as a named set (optionally with the images).
  const handleSavePreset = async () => {
    if (!customCard) return;
    const name = presetName.trim() || `Set ${(presets?.length || 0) + 1}`;
    const preset = await savePreset(name, customCard, { includeImages });
    if (preset) {
      setSelectedPresetId(preset.id);
      setPresetName('');
      setFeedback(`Saved set "${preset.name}"${includeImages ? ' with images' : ''}.`);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Delete the currently selected set.
  const handleDeletePreset = async () => {
    if (!selectedPresetId) return;
    await deletePreset(selectedPresetId);
    setSelectedPresetId('');
  };

  const handleParamChange = (param, value, isNumeric = true) => {
    if (!customCard) return;
    
    
    let updatedValue = value;
    if (isNumeric) {
      updatedValue = parseFloat(value);
      if (isNaN(updatedValue)) return;
    }
    
    // Create a deep copy of the card to avoid reference issues
    const updatedCard = JSON.parse(JSON.stringify(customCard));
    
    // Handle nested properties like effectParams.shineIntensity
    if (param.includes('.')) {
      const [parent, child] = param.split('.');
      if (!updatedCard[parent]) updatedCard[parent] = {};
      updatedCard[parent][child] = updatedValue;
      
      // If we're turning ON a holo effect, initialize its default parameters
      if (parent === 'holoEffects' && child === 'rareHoloGalaxy' && updatedValue === true) {
        updatedCard.rareHoloGalaxyParams = {
          space: 4,
          brightness: 0.75,
          contrast: 1.2,
          saturation: 1.5,
          blendMode: 'color-dodge', // How uploaded image blends with galaxy colors
          gradientSize: 400, // Size of the rainbow gradient (width %)
          gradientHeight: 900, // Height of the rainbow gradient (%)
          smoothTransitions: 0.0, // Smooth color transitions (0=hard stops, 1=max smooth)
          colors: [
            'rgb(219, 204, 86)',
            'rgb(121, 199, 58)',
            'rgb(58, 192, 183)',
            'rgb(71, 98, 207)',
            'rgb(170, 69, 209)',
            'rgb(255, 90, 180)',
            'rgb(255, 90, 180)',
            'rgb(170, 69, 209)',
            'rgb(71, 98, 207)',
            'rgb(58, 192, 183)',
            'rgb(121, 199, 58)',
            'rgb(219, 204, 86)'
          ]
        };
      }
      
      // If we're turning ON Rare Holo effect, initialize its default parameters
      if (parent === 'holoEffects' && child === 'rareHolo' && updatedValue === true) {
        updatedCard.rareHoloParams = {
          space: 1.5,
          hue: 21,
          saturation: 70,
          lightness: 50,
          intensity: 'subtle', // Default to subtle mode
          filterStrength: 1.0, // Filter intensity multiplier
          mouseSpeed: 1.0, // Mouse response speed
          blendMode: 'soft-light', // Blend mode for the effect
          colors: [
            'rgb(255, 0, 0)',     // Red
            'rgb(255, 127, 0)',   // Orange
            'rgb(255, 255, 0)',   // Yellow
            'rgb(127, 255, 0)',   // Lime
            'rgb(0, 255, 0)',     // Green
            'rgb(0, 255, 127)',   // Spring Green
            'rgb(0, 255, 255)',   // Cyan
            'rgb(0, 127, 255)',   // Azure
            'rgb(0, 0, 255)',     // Blue
            'rgb(127, 0, 255)',   // Violet
            'rgb(255, 0, 255)',   // Magenta
            'rgb(255, 0, 127)'    // Rose
          ]
        };
      }
    } else {
      updatedCard[param] = updatedValue;
    }
    
    setCustomCard(updatedCard);
  };
  
  // Handle holo image upload
  const handleHoloImageUpload = (e) => {
    
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    
    
    // Create a preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const holoImageDataUrl = reader.result;
      setHoloImagePreview(holoImageDataUrl);
      
      // Update card with new holo image
      if (customCard) {
        // Add the custom holo image to the card data
        const updatedCard = { 
          ...customCard, 
          customHoloImageUrl: holoImageDataUrl,
          // Force a high enough rarity to ensure holographic effect is visible
          rarity: Math.max(customCard.rarity, 0.7),
          // IMPORTANT: Disable ALL CSS-based holo effects when using custom image
                  holoEffects: {
          rareHolo: false,
          rareHoloGalaxy: false,
          wowaHolo: false,
          rareHoloVmax: false
        }
        };
        
        
        setCustomCard(updatedCard);
        saveCustomImage('holoImage', holoImageDataUrl);
      }
    };
    reader.readAsDataURL(file);
  };
  
  // Handle saving the custom card
  const handleSaveCard = async () => {
    if (!customCard) return;
    
    setIsSaving(true);
    setFeedback(null);
    
    try {
      // First, update the card in context
      updateCustomCard(customCard);
      
      // Save to local storage (existing functionality)
      await saveCard();
      
      // Now save to backend API
      const cardName = `Custom Card ${new Date().toLocaleString()}`;
      
      // Create the card data for the backend
      const cardData = {
        name: cardName,
        tags: customCard.tags || [],
        stateData: {
          // Include the custom card data
          customCard: customCard,
          // Include any additional state we want to preserve
          timestamp: new Date().toISOString(),
          version: '1.0'
        }
      };
      
      // Send to backend
      await api('/api/cards', { method: 'POST', body: cardData });
      setFeedback('Card saved successfully to server!');

    } catch (error) {
      console.error('Error saving card:', error);
      setFeedback(`Error saving card: ${error.message}`);
    } finally {
      setIsSaving(false);
      
      // Clear feedback after 5 seconds
      setTimeout(() => setFeedback(null), 5000);
    }
  };
  
  return (
    <CustomizerContainer className="customizer-container">
      <h1 className="customizer-title">Card Customizer</h1>
      <CustomizerLayout className="customizer-layout">
        <CardPreviewSection className="card-preview-section">
          {customCard && (
            <>
              <Card cardData={customCard} />
            </>
          )}
        </CardPreviewSection>
        
        <ControlsSection className="controls-section">
          {/* Preset sets: load a saved starting point, or save the current look as one. */}
          <PresetBar className="preset-bar">
            <Select
              className="preset-select"
              value={selectedPresetId}
              onChange={(e) => handleLoadPreset(e.target.value)}
            >
              <option value="">Load a set…</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            {selectedPresetId && (
              <PillButton
                $secondary
                type="button"
                className="preset-delete"
                onClick={handleDeletePreset}
                title="Delete this set"
              >✕</PillButton>
            )}
            <TextInput
              className="preset-name"
              placeholder="name this set"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); }}
            />
            <ImgToggle className="preset-include-images" title="Also store the base & holo images in this set">
              <input
                type="checkbox"
                checked={includeImages}
                onChange={(e) => setIncludeImages(e.target.checked)}
              />
              include images
            </ImgToggle>
            <PillButton type="button" className="preset-save" onClick={handleSavePreset}>
              Save set
            </PillButton>
          </PresetBar>
          <PresetNote className="preset-note">
            A "set" saves the current base settings — colours, effects, background and
            default tags — as a reusable preset/default to start new cards from. Tick
            "include images" to also store the uploaded base and holo images so you can
            reuse them.
          </PresetNote>

          {/* Tabs: pick which part of the card to customize. */}
          <TabBar className="customizer-tabs">
            {TABS.map((tab) => (
              <TabButton
                key={tab.key}
                type="button"
                className="customizer-tab"
                data-tab={tab.key}
                $active={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </TabButton>
            ))}
          </TabBar>

          <ControlsInner className="controls-inner">
            {activeTab === 'image' && (
              <ImageEffectControls
                className="image-effect-controls"
                customCard={customCard}
                handleParamChange={handleParamChange}
                handleMainImageChange={handleMainImageChange}
                mainImagePreview={mainImagePreview}
              />
            )}

            {activeTab === 'holo' && (
              <>
                <HoloEffectToggles
                  className="holo-effect-toggles"
                  customCard={customCard}
                  handleParamChange={handleParamChange}
                />
                <HoloEffectControls
                  customCard={customCard}
                  handleParamChange={handleParamChange}
                  handleHoloImageUpload={handleHoloImageUpload}
                  holoImagePreview={holoImagePreview}
                />
              </>
            )}

            {activeTab === 'frame' && (
              <>
                <EdgeHighlightControls
                  customCard={customCard}
                  handleParamChange={handleParamChange}
                />
                <CentralPanelControls
                  customCard={customCard}
                  handleParamChange={handleParamChange}
                />
                <ControlSection title="Border Image" className="additional-card-settings">
                  <ControlsGrid>
                    <ParameterControl
                      className="border-image-opacity-control"
                      label="Border Image Opacity"
                      param="borderEffects.imageOpacity"
                      value={customCard?.borderEffects?.imageOpacity ?? 0.5}
                      onChange={handleParamChange}
                    />
                  </ControlsGrid>
                </ControlSection>
              </>
            )}

            {activeTab === 'background' && (
              <BaseBackgroundControls
                customCard={customCard}
                handleParamChange={handleParamChange}
                onRandomize={handleRandomizeBackground}
              />
            )}
          </ControlsInner>

          {/* Save + publish stay available from every tab. */}
          <ControlsFooter className="controls-footer">
            <TagSection className="tag-section">
              <TagLabel>Tags</TagLabel>
              <Dim style={{ fontSize: 10 }}>Saved with the card; shown across the pool and your collection.</Dim>
              <TagInput value={customCard?.tags || []} onChange={setTags} />
            </TagSection>
            <SaveCard
              className="save-card-button"
              handleSaveCard={handleSaveCard}
              isSaving={isSaving}
              feedback={feedback}
            />
            <PublishPanel customCard={customCard} />
          </ControlsFooter>
        </ControlsSection>
      </CustomizerLayout>
    </CustomizerContainer>
  );
};

// Only keep the minimal styled components we need for layout
const CustomizerContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 20px;
  
  h1 {
    font-family: var(--font-sans);
    margin-bottom: 20px;
    font-size: 24px;
    color: var(--white);
  }
`;

const CustomizerLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  width: 100%;
  max-width: 1200px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const CardPreviewSection = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const ControlsSection = styled.div`
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 16px 20px 20px;
  color: var(--amber-text);
  font-family: var(--font-mono);
  position: relative;
  max-height: 600px;
  display: flex;
  flex-direction: column;
`;

const PresetBar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
  flex-shrink: 0;

  .preset-select { flex: 1; min-width: 120px; }
  .preset-name { flex: 1; min-width: 120px; }
  .preset-delete { padding: 6px 10px; }
  .preset-save { white-space: nowrap; }
`;

const ImgToggle = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  font-size: 11px;
  color: var(--amber-text);
  cursor: pointer;

  input { accent-color: var(--gold); cursor: pointer; }
`;

const PresetNote = styled.p`
  margin: 0 0 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--panel-border);
  font-size: 10px;
  line-height: 1.45;
  color: var(--amber-dim);
  flex-shrink: 0;
`;

const TagSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
`;

const TagLabel = styled.div`
  font-family: var(--font-sans);
  font-weight: 600;
  color: var(--white);
  letter-spacing: -0.01em;
`;

const TabBar = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
  flex-shrink: 0;
`;

const TabButton = styled.button`
  flex: 1;
  font-family: var(--font-sans);
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  font-size: 11px;
  letter-spacing: -0.01em;
  padding: 8px 6px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid ${({ $active }) => ($active ? 'var(--gold)' : 'var(--panel-border)')};
  background: ${({ $active }) => ($active ? 'var(--panel-hover)' : 'var(--field-bg)')};
  color: ${({ $active }) => ($active ? 'var(--gold-bright)' : 'var(--amber-dim)')};
  transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease;

  &:hover {
    color: var(--white);
    border-color: var(--gold);
  }
`;

const ControlsInner = styled.div`
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding-right: 10px; /* Add some padding for the scrollbar */
`;

const ControlsFooter = styled.div`
  flex-shrink: 0;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--panel-border);
`;

const ControlsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;
  
  @media (min-width: 500px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export default CardCustomizer;
