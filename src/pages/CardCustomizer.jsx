import { useState, useEffect, useRef } from 'react';
import localforage from 'localforage';
import styled from 'styled-components';
import { LuCircleArrowRight, LuRotateCcw } from 'react-icons/lu';
import Card from '../components/Card/Card';
import { useCards } from '../context/CardContext';
import HoloEffectToggles from '../components/CardCustomizer/HoloEffectToggles';
import ImageEffectControls from '../components/CardCustomizer/ImageEffectControls';
import EdgeHighlightControls from '../components/CardCustomizer/EdgeHighlightControls';
import CentralPanelControls from '../components/CardCustomizer/CentralPanelControls';
import BaseBackgroundControls from '../components/CardCustomizer/BaseBackgroundControls';
import StartStage from '../components/CardCustomizer/StartStage';
import ImagePicker from '../components/CardCustomizer/ImagePicker';
import PublishStage from '../components/CardCustomizer/PublishStage';
import CodingAgentGuide from '../components/CardCustomizer/CodingAgentGuide';
import { generateBaseBackground, generateCardAttributes } from '../utils/cardGenerator';
import { applyPreset } from '../utils/presets';
import { useAuth, tierForScore } from '../context/AuthContext';
import { Dim } from '../components/UI';
import sigImage from '../assets/img/r5c_signature.png';

// The creation flow runs in three stages: roll a base card (Start) → design →
// tag and publish. The stepper is free navigation, not a locked wizard —
// designing means going back and forth.
const STAGES = [
  { key: 'start', label: 'Start' },
  { key: 'design', label: 'Design' },
  { key: 'publish', label: 'Publish' },
];
const STAGE_KEYS = STAGES.map(s => s.key);

// Every rolled card wears the same signature image + default holo overlay —
// constant across rolls, so a card always reads as "an R5c card". Only the
// background and the rolled rarity change when you regenerate.
const DEFAULT_HOLO = { overlay: true, rareHolo: false, rareHoloGalaxy: false, wowaHolo: false, rareHoloVmax: false };

const rollBaseCard = () => ({
  ...generateCardAttributes(),
  tags: [],
  imagePath: 'custom_image',
  customImageUrl: sigImage,
  customHoloImageUrl: null,
  holoEffects: DEFAULT_HOLO
});

// Costs climb linearly with the reroll count (the gambling tax), plus a random
// fraction seeded off the card so the /t26 reads with the fractional flavour of
// the rest of the economy (2.37, not a flat 2) — stable per roll, fresh each
// reroll. The linear part only resets on a successful mint; Reset preserves it,
// so you can't dodge the price by resetting.
const round2 = (n) => Math.round(n * 100) / 100;

// Tiny deterministic hash → [0, 1). Same seed always yields the same fraction,
// so the shown price never jitters between renders.
const frac01 = (seed) => {
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
};

const regenPrice = (rolls, seed) => round2(1 + rolls + frac01(`${seed}:regen`));   // 1.xx, 2.xx, …
const createPrice = (rolls, seed) => round2(2 + rolls + frac01(`${seed}:create`)); // 2.xx, 3.xx, …

// Two ways to make a card: click through the stages here, or drive the r5c CLI
// from a terminal. Manual is the default; the agent mode swaps the stepper for
// a short how-to aimed at developers using coding agents.
const MODES = [
  { key: 'manual', label: 'Manual creation' },
  { key: 'agent', label: 'Coding agent creation' },
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
    updateCustomCard,
    presets, savePreset, deletePreset,
    imageLibrary, addToLibrary, removeFromLibrary
  } = useCards();
  const { config } = useAuth();
  const [customCard, setCustomCard] = useState(null);
  const [mode, setMode] = useState('manual');
  const [stage, setStage] = useState('start');
  // Reroll counter for this card — drives the escalating reroll price and
  // resets on mint / reset. Persisted in the draft so it survives a reload.
  const [rolls, setRolls] = useState(0);
  // The in-progress design is precious: publishing needs an account, and the
  // signup link navigates away from this page. Drafts persist to local storage
  // so the design survives the login round-trip (and reloads) — checked before
  // any random card is generated over it.
  const [draftChecked, setDraftChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('image');
  const [feedback, setFeedback] = useState(null);
  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [includeImages, setIncludeImages] = useState(false);
  // On phones the preview scrolls away while tuning sliders; when it leaves the
  // viewport we dock the card as a small fixed preview so feedback stays live.
  const previewRef = useRef(null);
  const [previewDocked, setPreviewDocked] = useState(false);
  useEffect(() => {
    const el = previewRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    // Dock when the preview is mostly scrolled away (a sliver of card is no
    // feedback), undock once most of it is back — the gap avoids flicker.
    const observer = new IntersectionObserver(
      ([entry]) => setPreviewDocked(prev => (prev
        ? entry.intersectionRatio < 0.55
        : entry.intersectionRatio < 0.35)),
      { threshold: [0, 0.35, 0.55, 1] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Restore a saved draft before anything else can seed the design — resuming
  // at the exact stage you left (a fresh roll navigated away from comes back to
  // Start, not mid-design).
  useEffect(() => {
    let cancelled = false;
    localforage.getItem('r5cCreateDraft')
      .then((draft) => {
        if (cancelled) return;
        if (draft?.customCard) {
          setCustomCard(draft.customCard);
          setStage(STAGE_KEYS.includes(draft.stage) ? draft.stage : 'start');
          setRolls(Number.isFinite(draft.rolls) ? draft.rolls : 0);
        }
        setDraftChecked(true);
      })
      .catch(() => { if (!cancelled) setDraftChecked(true); });
    return () => { cancelled = true; };
  }, []);

  // Save the draft (debounced) on every design change.
  useEffect(() => {
    if (!draftChecked || !customCard) return;
    const timer = setTimeout(() => {
      localforage.setItem('r5cCreateDraft', { customCard, stage, rolls, savedAt: Date.now() }).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [customCard, stage, rolls, draftChecked]);

  // No draft claimed the slot → start a fresh roll at the Start stage.
  useEffect(() => {
    if (!draftChecked || customCard) return;
    setCustomCard(rollBaseCard());
    setStage('start');
    setRolls(0);
  }, [draftChecked, customCard]);

  // The upload previews ARE the card's images — derived, never separately
  // stored. A fresh card starts with empty slots; a set loaded with images
  // fills them; the library is where past uploads live.
  const mainImagePreview = customCard?.customImageUrl || null;
  const holoImagePreview = customCard?.customHoloImageUrl || null;

  const flash = (text) => {
    setFeedback(text);
    setTimeout(() => setFeedback(null), 4000);
  };

  // ---- images (Start stage; also fed by the library) ----

  const applyMainImage = (imageDataUrl) => {
    if (!customCard) return;
    setCustomCard({
      ...customCard,
      customImageUrl: imageDataUrl,
      imagePath: 'custom_image' // marker so Card uses customImageUrl
    });
  };

  // The overlay holo image coexists with the four animated systems — it's the
  // fifth technique, not a replacement for them. Choosing an image switches
  // the Veil on; clearing it keeps Veil running as its gradient sheen (the
  // toggle is the off switch, not the image).
  const applyHoloImage = (imageDataUrl) => {
    if (!customCard) return;
    setCustomCard({
      ...customCard,
      customHoloImageUrl: imageDataUrl,
      holoEffects: imageDataUrl
        ? { ...(customCard.holoEffects || {}), overlay: true }
        : customCard.holoEffects
      // Rarity is locked by the roll — designing never moves it.
    });
    if (imageDataUrl) addToLibrary(imageDataUrl);
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

  // The reroll: a fresh background + effects AND a fresh rolled rarity. The
  // signature image (or whatever you've loaded) and the holo carry over — the
  // gamble is the backdrop and the rarity, not the picture.
  const handleRegenerate = () => {
    const fresh = generateCardAttributes();
    setCustomCard(prev => ({
      ...fresh,
      tags: prev?.tags || [],
      customImageUrl: prev?.customImageUrl || sigImage,
      imagePath: 'custom_image',
      customHoloImageUrl: prev?.customHoloImageUrl || null,
      holoEffects: prev?.holoEffects || DEFAULT_HOLO
    }));
    setRolls(n => n + 1);
  };

  // Reset (from the Design stage): drop back to the roll, keeping the current
  // card AND its accrued reroll count — a way back to rolling, not a way to
  // dodge the climbing price.
  const handleResetToStart = () => {
    setStage('start');
    setActiveTab('image');
    flash('Back to the roll — your card is kept.');
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
        <CardPreviewSection
          ref={previewRef}
          className={`card-preview-section${previewDocked ? ' preview-docked' : ''}`}
        >
          {/* The bar beside the card drives the preview: drag the dot to pose
              the card, the gold stretch is the shiny zone, ❚❚ pauses motion
              everywhere. Replaces the old touch on/off chip. */}
          {customCard && <Card cardData={customCard} scrub />}
          <PreviewTools className="preview-tools">
            <Dim className="hint">
              the bar beside the card drives it — drag the dot; the gold
              stretch is where the holo shows. ❚❚ pauses card motion.
            </Dim>
          </PreviewTools>
        </CardPreviewSection>

        <ControlsSection className="controls-section">
          {/* Creation mode: hand-build here, or use the CLI. Sits above the
              stage stepper because it decides whether the stepper shows at all. */}
          <ModeToggle className="customizer-mode">
            {MODES.map((m) => (
              <ModeButton
                key={m.key}
                type="button"
                className="customizer-mode-btn"
                data-mode={m.key}
                $active={mode === m.key}
                onClick={() => setMode(m.key)}
              >
                {m.label}
              </ModeButton>
            ))}
          </ModeToggle>

          {mode === 'agent' && (
            <StageBody>
              <CodingAgentGuide />
            </StageBody>
          )}

          {mode === 'manual' && <>
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
                rarity={customCard?.rarity}
                tierName={tierForScore(config, customCard?.rarity)?.name}
                rolls={rolls}
                regenCost={regenPrice(rolls, customCard?.id)}
                createCost={createPrice(rolls, customCard?.id)}
                onRegenerate={handleRegenerate}
                presets={presets}
                selectedPresetId={selectedPresetId}
                onLoadPreset={handleLoadPreset}
                onDeletePreset={async () => { await deletePreset(selectedPresetId); setSelectedPresetId(''); }}
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
                      slot="main"
                      label="base image"
                      note="The card's artwork. Everything on this tab tunes how it sits in the frame."
                      preview={mainImagePreview}
                      onFileChange={handleMainImageChange}
                      onUseLibraryImage={applyMainImage}
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
                      imageLibrary={imageLibrary}
                      addToLibrary={addToLibrary}
                      overlayImage={holoImagePreview}
                      onOverlaySelect={applyHoloImage}
                      onOverlayClear={() => applyHoloImage(null)}
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
                  </>
                )}
              </ControlsInner>

              <StageFooter className="controls-footer">
                {feedback && <Dim className="customizer-feedback">{feedback}</Dim>}
                <FooterActions>
                  <ResetButton type="button" className="stage-reset" onClick={handleResetToStart}>
                    <LuRotateCcw /> Reset
                  </ResetButton>
                  <NextButton type="button" className="stage-next" onClick={() => setStage('publish')}>
                    Publish <LuCircleArrowRight />
                  </NextButton>
                </FooterActions>
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
          </>}
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
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  gap: 4px;
  padding-top: 10px;

  /* Phones: once scrolled past, the card docks top-right as a small live
     preview. The .card-scene keeps its layout box via the section's
     min-height, so nothing jumps when it switches to fixed. */
  @media (max-width: 768px) {
    &.preview-docked {
      min-height: 400px;
    }
    &.preview-docked .card-scene {
      position: fixed;
      top: 8px;
      right: 8px;
      z-index: 1100;
      margin: 0;
      transform: scale(0.3);
      transform-origin: top right;
      pointer-events: none;
    }
  }
`;

const PreviewTools = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 340px;
  font-family: var(--font-mono);
  font-size: 10px;

  button {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 10px;
    padding: 3px 10px;
    border-radius: 10px;
    border: 1px solid var(--panel-border);
    background: var(--field-bg);
    color: var(--amber-dim);
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s, background 0.2s;

    .pin { opacity: 0.8; }
    &:hover { color: var(--white); border-color: var(--gold); }
    &.active {
      color: #140d03;
      background: var(--gold);
      border-color: var(--gold);
    }
  }

  .hint {
    font-size: 9px;
    line-height: 1.5;
    text-align: left;
  }
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

const ModeToggle = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  flex-shrink: 0;
`;

const ModeButton = styled.button`
  flex: 1;
  font-family: var(--font-mono);
  font-size: 12px;
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

// Design-stage footer buttons, kept together on the right — Reset sits to the
// left of Publish.
const FooterActions = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const NextButton = styled.button`
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  svg { font-size: 15px; }
  &:hover { background: var(--gold-bright); }
`;

const ResetButton = styled.button`
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 12px;
  padding: 7px 14px;
  border-radius: 20px;
  cursor: pointer;
  border: 1px solid var(--panel-border);
  background: transparent;
  color: var(--gold-bright);
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  svg { font-size: 14px; }
  &:hover { background: var(--panel-hover); border-color: var(--gold-bright); color: var(--white); }
`;

export default CardCustomizer;
