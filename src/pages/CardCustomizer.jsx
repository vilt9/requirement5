import { useState, useEffect, useRef, useCallback } from 'react';
import localforage from 'localforage';
import styled from 'styled-components';
import { LuCircleArrowRight } from 'react-icons/lu';
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
import { useSearchParams } from 'react-router-dom';
import { useAuth, tierForScore } from '../context/AuthContext';
import { api } from '../utils/api';
import { cardArtworkUrl, resolveImageUrl } from '../utils/poolCard';
import { regenCostFor, createCostFor } from '../utils/economyRandom';
import { Dim, Select, PillButton } from '../components/UI';

// The creation flow runs in three stages: roll a base card (Start) → design →
// tag and publish. The stepper is free navigation, not a locked wizard —
// designing means going back and forth.
const STAGES = [
  { key: 'start', label: 'Start' },
  { key: 'design', label: 'Design' },
  { key: 'publish', label: 'Publish' },
];
const STAGE_KEYS = STAGES.map(s => s.key);

// Every rolled card wears the same default holo overlay (the R5 holo image) —
// constant across rolls, so a card always reads as "an R5c card". A fresh card
// starts with no main image; you add your own. Only the background and the
// rolled rarity change when you regenerate.
const DEFAULT_HOLO = { overlay: true, rareHolo: false, rareHoloGalaxy: false, wowaHolo: false, rareHoloVmax: false };

// The default Veil image every rolled card wears until you upload your own.
const DEFAULT_HOLO_IMAGE = '/r5c_card_back.png';

// Build a base card's visuals. When a rarity is given (the server roll), the
// look is generated to match it; otherwise a client rarity is drawn (logged
// out, where rarity is honour-system until login).
const rollBaseCard = (rarity) => ({
  ...generateCardAttributes(rarity != null ? { rarityRange: [rarity, rarity] } : {}),
  tags: [],
  imagePath: 'custom_image',
  customImageUrl: null,
  customHoloImageUrl: DEFAULT_HOLO_IMAGE,
  holoEffects: DEFAULT_HOLO,
  ...(rarity != null ? { rarity } : {})
});

// Costs (regenCostFor / createCostFor) live in utils/economyRandom.js so the
// price the page shows is exactly the price the server charges. They climb
// linearly with the reroll count plus a seeded fraction; the count only resets
// on a fresh card / successful mint — Reset preserves it, so you can't dodge the
// price by resetting.

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
  const { config, user, loading, setBalance, flashSpend } = useAuth();
  // /create?draft=<id> resumes an existing private draft in the design stage.
  const [searchParams] = useSearchParams();
  const editDraftId = searchParams.get('draft');
  const [customCard, setCustomCard] = useState(null);
  const [mode, setMode] = useState('manual');
  const [stage, setStage] = useState('start');
  // Reroll counter for this card — drives the escalating reroll price and
  // resets on mint / reset. Persisted in the draft so it survives a reload.
  const [rolls, setRolls] = useState(0);
  // True once a reroll has happened while logged OUT (free). Logging in then
  // discards the card — you can't fish a rare roll for free and bank it.
  const [anonRolls, setAnonRolls] = useState(false);
  // True once the create fee has been paid for THIS card, so stepping back and
  // forth to Design never double-charges. Cleared on a new roll. (Logged-out
  // only — logged in, the roll's `committed` flag is authoritative.)
  const [paidCreate, setPaidCreate] = useState(false);
  // The server-owned rarity gamble (logged in), mapped from /api/cards/create/*:
  // { rarityScore, rerolls, committed, tier } + its { reroll, create } prices.
  // Null when logged out. `draftId` is the private draft once confirm-start runs.
  const [roll, setRoll] = useState(null);
  const [prices, setPrices] = useState(null);
  const [draftId, setDraftId] = useState(null);

  // Map a begin/regenerate response into the { roll, prices } shape the UI uses.
  const syncRarity = (data, committed = false) => {
    setRoll({
      rarityScore: data.rarityValue,
      rerolls: data.regenerations,
      committed,
      tier: data.tier
    });
    setPrices({ reroll: data.prices.regenerate, create: data.prices.confirmStart });
    setCustomCard(prev => (prev ? { ...prev, rarity: data.rarityValue } : prev));
  };

  // Start (or fetch) the active gamble and sync the card's rarity to it.
  const fetchRoll = useCallback(async () => {
    try {
      const data = await api('/api/cards/create/begin', { method: 'POST' });
      syncRarity(data);
    } catch (error) {
      console.error('Could not start the rarity gamble:', error);
    }
  }, []);
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

  // Resume an existing private draft (/create?draft=<id>): load its design into
  // the customizer at the design stage. The draft already has its locked rarity
  // and was paid for at confirm-start, so we skip the roll/Start stage.
  useEffect(() => {
    if (!editDraftId || loading) return;
    let cancelled = false;
    (async () => {
      if (!user) { if (!cancelled) setDraftChecked(true); return; }
      try {
        const card = await api(`/api/cards/${editDraftId}`);
        if (cancelled) return;
        const cc = card?.state_data?.customCard;
        if (card && card.creator_id === user.id && !card.is_public && cc) {
          setCustomCard({ ...cc, rarity: card.rarity_score });
          setDraftId(card.id);
          setRoll({ rarityScore: card.rarity_score, rerolls: 0, committed: true, tier: tierForScore(config, card.rarity_score) });
          setPaidCreate(true);
          setStage('design');
        } else {
          flash('That draft could not be opened for editing.');
        }
      } catch { /* fall through to a normal fresh start */ }
      if (!cancelled) setDraftChecked(true);
    })();
    return () => { cancelled = true; };
  }, [editDraftId, user, loading, config]);

  // Restore a saved draft before anything else can seed the design — resuming
  // at the exact stage you left (a fresh roll navigated away from comes back to
  // Start, not mid-design). Skipped when resuming a specific draft by id.
  useEffect(() => {
    if (editDraftId) return;
    let cancelled = false;
    localforage.getItem('r5cCreateDraft')
      .then((draft) => {
        if (cancelled) return;
        if (draft?.customCard) {
          setCustomCard(draft.customCard);
          setStage(STAGE_KEYS.includes(draft.stage) ? draft.stage : 'start');
          setRolls(Number.isFinite(draft.rolls) ? draft.rolls : 0);
          setAnonRolls(!!draft.anonRolls);
          setPaidCreate(!!draft.paidCreate);
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
      localforage.setItem('r5cCreateDraft', { customCard, stage, rolls, anonRolls, paidCreate, savedAt: Date.now() }).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [customCard, stage, rolls, anonRolls, paidCreate, draftChecked]);

  // Persist the design to the SERVER draft too (debounced), so it can be resumed
  // from the collection on any device — not just this browser. Only while a
  // private draft is open (pre-publish); handlePublished clears draftId.
  useEffect(() => {
    if (!user || !draftId || !customCard) return;
    const timer = setTimeout(() => {
      api(`/api/cards/${draftId}`, {
        method: 'PUT',
        body: { stateData: { customCard, timestamp: new Date().toISOString(), version: '1.0' }, tags: customCard?.tags || [] }
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [user, draftId, customCard]);

  // No draft claimed the slot → start a fresh roll at the Start stage.
  useEffect(() => {
    if (editDraftId || !draftChecked || customCard) return;
    setCustomCard(rollBaseCard());
    setStage('start');
    setRolls(0);
    setAnonRolls(false);
    setPaidCreate(false);
  }, [draftChecked, customCard]);

  // Logged-out fishing can't be banked: once a card that was rerolled while
  // logged out belongs to a signed-in user (they logged in, here or via the
  // account round-trip), discard it and start on a clean, paid-for roll. Waits
  // for auth to settle so a normal logged-in reload isn't caught.
  useEffect(() => {
    if (loading || !draftChecked) return;
    if (user && anonRolls) {
      localforage.removeItem('r5cCreateDraft').catch(() => {});
      setCustomCard(rollBaseCard());
      setRolls(0);
      setAnonRolls(false);
      setPaidCreate(false);
      setRoll(null); // force a fresh server roll
      setDraftId(null);
      setStage('start');
      setSelectedPresetId('');
      flash('Logged in — fresh Rarity Value. Regenerations made while logged out don’t carry over.');
    }
  }, [user, anonRolls, loading, draftChecked]);

  // Logged in with no active roll loaded → pull one from the server (the source
  // of truth for rarity). Logged out clears it (client-side rolls apply).
  useEffect(() => {
    if (editDraftId || loading || !draftChecked || !customCard) return;
    if (!user) { setRoll(null); setPrices(null); setDraftId(null); return; }
    if (!roll) fetchRoll();
  }, [editDraftId, user, loading, draftChecked, customCard, roll, fetchRoll]);

  // The upload previews ARE the card's images — derived, never separately
  // stored. A fresh card starts with empty slots; a template loaded with images
  // fills them; the library is where past uploads live.
  const mainImagePreview = cardArtworkUrl(customCard);
  const holoImagePreview = resolveImageUrl(customCard?.customHoloImageUrl) || null;

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

  // The reroll: a fresh background + effects AND a fresh rolled rarity. Your
  // main image (whatever you've loaded) and the holo carry over — the gamble is
  // the backdrop and the rarity, not the picture.
  //
  // Logged in, the reroll costs /t26: charge the server first (it computes the
  // price from the reroll count + seed), and a failed / unaffordable charge
  // aborts the reroll. Logged out it's free — but marked, so logging in wipes it.
  // Regenerate the card's look; force `rarity` when the server hands one back so
  // the preview matches the rolled value.
  const doReroll = (rarity) => {
    const fresh = generateCardAttributes(rarity != null ? { rarityRange: [rarity, rarity] } : {});
    setCustomCard(prev => ({
      ...fresh,
      tags: prev?.tags || [],
      customImageUrl: prev?.customImageUrl || null,
      imagePath: 'custom_image',
      customHoloImageUrl: prev?.customHoloImageUrl || DEFAULT_HOLO_IMAGE,
      holoEffects: prev?.holoEffects || DEFAULT_HOLO,
      ...(rarity != null ? { rarity } : {})
    }));
    setPaidCreate(false); // a new card → the create fee applies again
  };

  const handleRegenerate = async () => {
    if (user) {
      // Server owns the rarity: regenerate draws a fresh one and charges the fee.
      try {
        const data = await api('/api/cards/create/regenerate-rarity', { method: 'POST' });
        syncRarity(data);
        setBalance(data.balance);
        flashSpend(data.charged);
        doReroll(data.rarityValue);
      } catch (error) {
        flash(error?.status === 402
          ? (error.message || 'Debt limit reached — pay down /t26 first.')
          : 'Could not regenerate — try again.');
      }
      return;
    }
    // Logged out: free client reroll, marked so login wipes it.
    setAnonRolls(true);
    setRolls(n => n + 1);
    doReroll();
  };

  // Start: commit this rolled card into the design flow. Costs the (gently
  // climbing) create fee once per card, when logged in — charged once, so
  // stepping back to Start and forward again doesn't double-bill. Logged out
  // it's free (publishing needs an account, and logging in restarts the roll).
  const handleStart = async () => {
    if (user) {
      // confirm-start (pay the create fee) unless already committed. It locks
      // the rarity onto a private draft and returns its id — idempotent, so
      // stepping back and forth never double-charges.
      if (!roll?.committed) {
        try {
          // Seed the draft with the current design so it can be resumed from the
          // collection (the server draft holds the state, not just the browser).
          const data = await api('/api/cards/create/confirm-start', {
            method: 'POST',
            body: { stateData: { customCard, timestamp: new Date().toISOString(), version: '1.0' }, tags: customCard?.tags || [] }
          });
          setDraftId(data.draft.id);
          setRoll(prev => (prev ? { ...prev, committed: true } : prev));
          setBalance(data.balance);
          flashSpend(data.createFee);
        } catch (error) {
          flash(error?.status === 402
            ? (error.message || 'Debt limit reached — pay down /t26 first.')
            : 'Could not charge the create fee — try again.');
          return;
        }
      }
    }
    setStage('design');
  };

  // A published card consumes its gamble — clear the draft and drop the stale
  // roll so the next card pulls a fresh one.
  const handlePublished = () => {
    localforage.removeItem('r5cCreateDraft').catch(() => {});
    setRoll(null);
    setPrices(null);
    setDraftId(null);
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

  // --- Base templates (device-local design presets) ---
  // Apply a saved template's design + default tags onto the current card (keeps the image).
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

  // Save the current design + tags as a named template (optionally with the images).
  const handleSavePreset = async () => {
    if (!customCard) return;
    const name = presetName.trim() || `Template ${(presets?.length || 0) + 1}`;
    const preset = await savePreset(name, customCard, { includeImages });
    if (preset) {
      setSelectedPresetId(preset.id);
      setPresetName('');
      flash(`Saved template "${preset.name}"${includeImages ? ' with images' : ''}.`);
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
      if (
        parent === 'holoEffects' && child === 'rareHoloGalaxy' &&
        updatedValue === true && !updatedCard.rareHoloGalaxyParams
      ) {
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
      if (
        parent === 'holoEffects' && child === 'rareHolo' &&
        updatedValue === true && !updatedCard.rareHoloParams
      ) {
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

      if (
        parent === 'holoEffects' && child === 'wowaHolo' &&
        updatedValue === true && !updatedCard.wowaHoloParams
      ) {
        updatedCard.wowaHoloParams = {
          space: 4,
          angle: 45,
          brightness: 0.6,
          contrast: 1.2
        };
      }

      if (
        parent === 'holoEffects' && child === 'rareHoloVmax' &&
        updatedValue === true && !updatedCard.rareHoloVmaxParams
      ) {
        updatedCard.rareHoloVmaxParams = {
          space: 6,
          angle: 133,
          brightness: 0.5,
          contrast: 2
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
                rarity={user ? roll?.rarityScore : customCard?.rarity}
                tierName={user ? roll?.tier?.name : tierForScore(config, customCard?.rarity)?.name}
                tierColor={tierForScore(config, user ? roll?.rarityScore : customCard?.rarity)?.color}
                dividendRate={config?.pricing?.dividendRate ?? 0.7}
                rolls={user ? (roll?.rerolls ?? 0) : rolls}
                regenCost={user ? (prices?.reroll ?? 0) : regenCostFor(rolls, customCard?.id)}
                createCost={user ? (prices?.create ?? 0) : createCostFor(rolls, customCard?.id)}
                loggedIn={!!user}
                paidCreate={user ? !!roll?.committed : paidCreate}
                onRegenerate={handleRegenerate}
                onNext={handleStart}
              />
              {feedback && <Dim className="customizer-feedback">{feedback}</Dim>}
            </StageBody>
          )}

          {stage === 'design' && (
            <>
              {/* Load a saved base template — tucked into an expandable so it
                  sits quietly above the design tabs without crowding them.
                  Loading one swaps the design but never the Rarity Value. */}
              <LoadSet className="load-set">
                <summary>Load a base template</summary>
                <div className="body">
                  <Dim>
                    Load one of your base templates to build on — this swaps the
                    design in, but never changes your Rarity Value.
                  </Dim>
                  <div className="row">
                    <Select
                      className="preset-select"
                      value={selectedPresetId}
                      onChange={(e) => handleLoadPreset(e.target.value)}
                    >
                      <option value="">Load a template…</option>
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                    {selectedPresetId && (
                      <PillButton
                        $secondary
                        type="button"
                        className="preset-delete"
                        onClick={async () => { await deletePreset(selectedPresetId); setSelectedPresetId(''); }}
                        title="Delete this template"
                      >✕</PillButton>
                    )}
                  </div>
                  {presets.length === 0 && (
                    <Dim style={{ fontStyle: 'italic' }}>
                      No templates yet — they appear here once you save a design at the publish step.
                    </Dim>
                  )}
                </div>
              </LoadSet>

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
                draftId={draftId}
                onPublished={handlePublished}
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

// Collapsed-by-default loader for saved base templates — sits between the stepper
// and the design tabs. Native <details>, so no extra open/close state.
const LoadSet = styled.details`
  flex-shrink: 0;
  margin-bottom: 12px;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  background: var(--field-bg);

  > summary {
    list-style: none;
    cursor: pointer;
    padding: 8px 12px;
    font-size: 12px;
    color: var(--gold-bright);
    user-select: none;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  > summary::-webkit-details-marker { display: none; }
  > summary::before {
    content: '▸';
    font-size: 10px;
    transition: transform 0.15s ease;
  }
  &[open] > summary::before { transform: rotate(90deg); }

  .body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 12px 12px;
    font-size: 12px;
    line-height: 1.5;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
    .preset-select { flex: 1; }
    button { white-space: nowrap; }
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

export default CardCustomizer;
