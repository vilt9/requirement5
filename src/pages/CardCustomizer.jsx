import { useState, useEffect } from 'react';
import styled from 'styled-components';
import Card from '../components/Card/Card';
import { useCards } from '../context/CardContext';
import ControlSection from '../components/CardCustomizer/ControlSection';
import ParameterControl from '../components/CardCustomizer/ParameterControl';
import HoloEffectControls from '../components/CardCustomizer/HoloEffectControls';
import HoloEffectToggles from '../components/CardCustomizer/HoloEffectToggles';
import ImageEffectControls from '../components/CardCustomizer/ImageEffectControls';
import EdgeHighlightControls from '../components/CardCustomizer/EdgeHighlightControls';
import CentralPanelControls from '../components/CardCustomizer/CentralPanelControls';
import BaseBackgroundControls from '../components/CardCustomizer/BaseBackgroundControls';
import StartStage from '../components/CardCustomizer/StartStage';
import ImagePicker from '../components/CardCustomizer/ImagePicker';
import PublishStage from '../components/CardCustomizer/PublishStage';
import { generateBaseBackground, generateCardAttributes } from '../utils/cardGenerator';
import { applyPreset } from '../utils/presets';
import { Dim } from '../components/UI';

// The creation flow runs in three stages, mirroring how a card actually comes
// together: pick images → design → tag and publish. The stepper is free
// navigation, not a locked wizard — designing means going back and forth.
const STAGES = [
  { key: 'start', label: 'Start' },
  { key: 'design', label: 'Design' },
  { key: 'publish', label: 'Publish' },
];

// Design tabs, ordered by how obviously they change the card: the artwork
// itself, then the holo systems, then the backdrop, then the frame details.
const TABS = [
  { key: 'image', label: 'Image' },
  { key: 'holo', label: 'Holographic' },
  { key: 'background', label: 'Background' },
  { key: 'frame', label: 'Frame' },
];

const CardCustomizer = () => {
  const {
    currentCard, generateNewCard, updateCustomCard, saveCustomImage, customImages,
    presets, savePreset, deletePreset,
    imageLibrary, addToLibrary, removeFromLibrary
  } = useCards();
  const [customCard, setCustomCard] = useState(null);
  const [stage, setStage] = useState('start');
  const [activeTab, setActiveTab] = useState('image');
  const [mainImagePreview, setMainImagePreview] = useState(null);
  const [holoImagePreview, setHoloImagePreview] = useState(null);
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
      if (customImages.mainImage) setMainImagePreview(customImages.mainImage);
      if (customImages.holoImage) setHoloImagePreview(customImages.holoImage);
    }
  }, [customImages]);

  const flash = (text) => {
    setFeedback(text);
    setTimeout(() => setFeedback(null), 4000);
  };

  // ---- images (Start stage; also fed by the library) ----

  const applyMainImage = (imageDataUrl) => {
    setMainImagePreview(imageDataUrl);
    if (customCard) {
      setCustomCard({
        ...customCard,
        customImageUrl: imageDataUrl,
        imagePath: 'custom_image' // marker so Card uses customImageUrl
      });
      saveCustomImage('mainImage', imageDataUrl);
    }
  };

  const applyHoloImage = (imageDataUrl) => {
    setHoloImagePreview(imageDataUrl);
    if (customCard) {
      setCustomCard({
        ...customCard,
        customHoloImageUrl: imageDataUrl,
        // Force a high enough rarity to ensure the holo layer is visible.
        rarity: Math.max(customCard.rarity, 0.7),
        // A custom holo image replaces the CSS-based holo systems.
        holoEffects: {
          rareHolo: false,
          rareHoloGalaxy: false,
          wowaHolo: false,
          rareHoloVmax: false
        }
      });
      saveCustomImage('holoImage', imageDataUrl);
    }
  };

  const readFileAsDataUrl = (e, apply) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      apply(reader.result);
      addToLibrary(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleMainImageChange = (e) => readFileAsDataUrl(e, applyMainImage);
  const handleHoloImageChange = (e) => readFileAsDataUrl(e, applyHoloImage);

  const handleUseLibraryImage = (dataUrl, slot) => {
    if (slot === 'holo') applyHoloImage(dataUrl);
    else applyMainImage(dataUrl);
  };

  // Roll a fresh design (colours, background, effects) but keep the images —
  // starting over shouldn't cost you your uploads.
  const handleRandomizeDesign = () => {
    const fresh = generateCardAttributes();
    setCustomCard({
      ...fresh,
      tags: customCard?.tags || [],
      ...(mainImagePreview ? { customImageUrl: mainImagePreview, imagePath: 'custom_image' } : {}),
      ...(holoImagePreview ? { customHoloImageUrl: holoImagePreview } : {})
    });
    flash('Rolled a fresh design (images kept).');
  };

  // Roll a fresh coherent base background (palette + fade + texture) in one click.
  const handleRandomizeBackground = () => {
    if (!customCard) return;
    setCustomCard({ ...customCard, baseBackground: generateBaseBackground() });
  };

  // Tags edited in the publish stage; stored on the card so they travel with save/publish.
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
    flash(`Loaded set "${preset.name}"${preset.images ? ' (with images)' : ''}.`);
  };

  // Save the current design + tags as a named set (optionally with the images).
  const handleSavePreset = async () => {
    if (!customCard) return;
    const name = presetName.trim() || `Set ${(presets?.length || 0) + 1}`;
    const preset = await savePreset(name, customCard, { includeImages });
    if (preset) {
      setSelectedPresetId(preset.id);
      setPresetName('');
      flash(`Saved set "${preset.name}"${includeImages ? ' with images' : ''}.`);
    }
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

  const stageIndex = STAGES.findIndex(s => s.key === stage);

  return (
    <CustomizerContainer className="customizer-container">
      <CustomizerLayout className="customizer-layout">
        <CardPreviewSection className="card-preview-section">
          {customCard && <Card cardData={customCard} />}
        </CardPreviewSection>

        <ControlsSection className="controls-section">
          {/* The three-stage stepper. Click any stage; nothing is locked. */}
          <Stepper className="customizer-stepper">
            {STAGES.map((s, i) => (
              <StepButton
                key={s.key}
                type="button"
                className="customizer-stage"
                data-stage={s.key}
                $active={stage === s.key}
                $done={i < stageIndex}
                onClick={() => setStage(s.key)}
              >
                <span className="num">{i + 1}</span> {s.label}
              </StepButton>
            ))}
          </Stepper>

          {stage === 'start' && (
            <StageBody>
              <StartStage
                presets={presets}
                selectedPresetId={selectedPresetId}
                onLoadPreset={handleLoadPreset}
                onDeletePreset={async () => { await deletePreset(selectedPresetId); setSelectedPresetId(''); }}
                onRandomizeDesign={handleRandomizeDesign}
                onNext={() => setStage('design')}
              />
              {feedback && <Dim className="customizer-feedback">{feedback}</Dim>}
            </StageBody>
          )}

          {stage === 'design' && (
            <>
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
                  <>
                    <ImagePicker
                      mainImagePreview={mainImagePreview}
                      holoImagePreview={holoImagePreview}
                      onMainImageChange={handleMainImageChange}
                      onHoloImageChange={handleHoloImageChange}
                      onUseLibraryImage={handleUseLibraryImage}
                      imageLibrary={imageLibrary}
                      onRemoveLibraryImage={removeFromLibrary}
                    />
                    <ImageEffectControls
                      className="image-effect-controls"
                      customCard={customCard}
                      handleParamChange={handleParamChange}
                    />
                  </>
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
                    />
                  </>
                )}

                {activeTab === 'background' && (
                  <BaseBackgroundControls
                    customCard={customCard}
                    handleParamChange={handleParamChange}
                    onRandomize={handleRandomizeBackground}
                  />
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
              </ControlsInner>

              <StageFooter className="controls-footer">
                {feedback && <Dim className="customizer-feedback">{feedback}</Dim>}
                <NextButton type="button" className="stage-next" onClick={() => setStage('publish')}>
                  Next: publish →
                </NextButton>
              </StageFooter>
            </>
          )}

          {stage === 'publish' && (
            <StageBody className="controls-footer">
              <PublishStage
                customCard={customCard}
                onTagsChange={setTags}
                presetName={presetName}
                onPresetNameChange={setPresetName}
                includeImages={includeImages}
                onIncludeImagesChange={setIncludeImages}
                onSavePreset={handleSavePreset}
                feedback={feedback}
              />
            </StageBody>
          )}
        </ControlsSection>
      </CustomizerLayout>
    </CustomizerContainer>
  );
};

// Page chrome in the same register as the card pages: left-aligned,
// 13px mono, amber on black. No heading — the card preview is the header.
const CustomizerContainer = styled.div`
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 15px 64px;

  @media (max-width: 640px) {
    padding: 4px 6px 40px;
  }
`;

const CustomizerLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  width: 100%;

  @media (max-width: 768px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
`;

const CardPreviewSection = styled.div`
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 10px;
`;

const ControlsSection = styled.div`
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 14px 16px 16px;
  color: var(--amber-text);
  font-family: var(--font-mono);
  position: relative;
  max-height: 640px;
  display: flex;
  flex-direction: column;
  /* Body copy reads left-aligned (the app root centers text globally). */
  text-align: left;

  /* Phones: one page scroll, no nested scrollbox, slimmer padding. */
  @media (max-width: 768px) {
    max-height: none;
    padding: 10px;
  }
`;

const Stepper = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
  flex-shrink: 0;
`;

const StepButton = styled.button`
  flex: 1;
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 8px 6px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid ${({ $active }) => ($active ? 'var(--gold)' : 'var(--panel-border)')};
  background: ${({ $active }) => ($active ? 'var(--panel-hover)' : 'var(--field-bg)')};
  color: ${({ $active, $done }) => ($active ? 'var(--gold-bright)' : $done ? 'var(--amber-text)' : 'var(--amber-dim)')};
  transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease;

  .num {
    display: inline-block;
    margin-right: 3px;
    opacity: 0.7;
  }

  &:hover {
    color: var(--white);
    border-color: var(--gold);
  }
`;

const StageBody = styled.div`
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding-right: 10px;

  @media (max-width: 768px) {
    overflow-y: visible;
    padding-right: 0;
  }
`;

const TabBar = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
  flex-shrink: 0;
`;

const TabButton = styled.button`
  flex: 1;
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 7px 6px;
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

  @media (max-width: 768px) {
    overflow-y: visible;
    padding-right: 0;
  }
`;

const StageFooter = styled.div`
  flex-shrink: 0;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--panel-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const NextButton = styled.button`
  margin-left: auto;
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 12px;
  padding: 7px 16px;
  border-radius: 20px;
  cursor: pointer;
  border: 1px solid var(--gold);
  background: var(--gold);
  color: #140d03;
  transition: background 0.15s;
  &:hover { background: var(--gold-bright); }
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
