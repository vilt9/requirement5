import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import styled from 'styled-components';
import Card from '../components/Card/Card';
import { useAuth } from '../context/AuthContext';
import { api, ApiError, apiBase } from '../utils/api';
import { poolCardToCardData, asOdds } from '../utils/poolCard';
import { scoreCard, generateCardAttributes } from '../utils/cardGenerator';
import { HOLO_NAMES } from '../utils/holoNames';
import { useScrollBloom } from '../utils/useScrollBloom';
import AboutR5c from '../components/AboutR5c';
import { Page, Panel, PillButton, Dim, TagList } from '../components/UI';
import { ensureTags } from '../utils/tags';

// Public card view at /card/:id. Anyone can look and press Generate to surface the
// next random card — the "discovered" path. Saving is the signup hook: it needs an
// account, and a discovered save (reached via Generate, a flag that lives in router
// state and so can't ride along a copied URL) is worth more than a linked save.
// Below the card we surface the underlying generation parameters — the things the
// customizer actually controls — because users care about every detail.
const ShareCard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, config, setBalance, refreshBalance } = useAuth();

  // Reached via the Generate button this session? Lives in router state, never the URL.
  const discovered = !!location.state?.discovered;

  const [card, setCard] = useState(null);
  const [rarities, setRarities] = useState(null); // every card's authentic rarity → percentile, pool composition
  const [status, setStatus] = useState('loading'); // loading | ok | notfound | error
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveResult, setSaveResult] = useState(null); // { value, provenance } | 'exists'
  const [saveError, setSaveError] = useState(null);
  const [tierIdx, setTierIdx] = useState(0); // synthetic save: user-chosen tier (slider)
  const scrolling = useScrollBloom(); // colour values bloom into their colour while scrolling
  const [rendering, setRendering] = useState(null); // 'gif' | 'mp4' while a moving image renders
  const [renderError, setRenderError] = useState(null);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setSaveResult(null);
    setSaveError(null);
    api(`/api/cards/${id}`)
      .then(record => { if (active) { setCard(record); setStatus('ok'); } })
      .catch(err => {
        if (!active) return;
        if (err?.status === 404 && /^[0-9a-f-]{10,64}$/i.test(id)) {
          // Not in the database → the uuid IS the card: generate it
          // deterministically from the id. Same URL, same card, for everyone.
          // It exists only as math until someone saves it.
          const customCard = generateCardAttributes({ seed: id });
          setCard({
            id,
            name: null,
            creator_id: null,
            tags: [],
            times_saved: 0,
            state_data: { customCard },
            synthetic: true
          });
          setStatus('ok');
        } else {
          setStatus(err?.status === 404 ? 'notfound' : 'error');
        }
      });
    return () => { active = false; };
  }, [id]);

  // The authentic rarity of every published card — drives this card's percentile,
  // pool share and draw weight, all from the same self-consistent distribution.
  useEffect(() => {
    let active = true;
    api('/api/cards/community/all')
      .then(cards => {
        if (active) setRarities(cards.map(c => scoreCard(c.state_data?.customCard)).filter(Number.isFinite));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — URL is in the address bar anyway */ }
  }, []);

  // Generate = go through the gate at '/': it credits the draw yield (or grows
  // the logged-out stash) and routes to a pool card or a fresh uuid.
  const generate = useCallback(() => navigate('/'), [navigate]);

  // Tiers commonest → rarest; the synthetic-save slider indexes into this.
  const orderedTiers = (config?.tiers || []).slice().sort((a, b) => a.scoreRange[0] - b.scoreRange[0]);
  const chosenTier = orderedTiers[Math.min(tierIdx, Math.max(0, orderedTiers.length - 1))] || null;

  const save = useCallback(async (tierKeyOverride, discoveredOverride) => {
    const synthetic = !!card?.synthetic;
    const tierKey = tierKeyOverride || chosenTier?.key || 'common';
    const isDiscovered = discoveredOverride ?? discovered;
    if (!user) {
      // The conversion moment: remember exactly what they wanted to save, send
      // them to create a free account, and finish the save when they're back.
      try {
        sessionStorage.setItem('r5c_pending_save', JSON.stringify({
          id, synthetic, tierKey, discovered: isDiscovered
        }));
      } catch { /* storage blocked — they can press Save again after login */ }
      navigate('/account', { state: { intent: 'save', returnTo: location.pathname, discovered } });
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      if (synthetic) {
        const result = await api('/api/cards/save-synthetic', {
          method: 'POST',
          body: {
            id,
            name: `Draw ${id.slice(0, 8)}`,
            tier: tierKey,
            stateData: { customCard: card.state_data.customCard }
          }
        });
        setBalance(result.balance);
        setCard({ ...result.card, synthetic: false });
        setSaveResult(result);
      } else {
        const result = await api(`/api/cards/${id}/save`, {
          method: 'POST',
          body: { provenance: isDiscovered ? 'discovered' : 'direct' }
        });
        setBalance(result.balance);
        setSaveResult(result);
      }
      refreshBalance();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setSaveResult('exists');
      else setSaveError(err?.message || 'Could not save this card.');
    }
    setBusy(false);
  }, [user, id, card, chosenTier, discovered, navigate, location.pathname, setBalance, refreshBalance]);

  // A synthetic card's slider starts on its natural tier (from its generated
  // rarity) — the user slides from there.
  useEffect(() => {
    if (!card?.synthetic || !config?.tiers) return;
    const r = scoreCard(card.state_data?.customCard);
    const sorted = config.tiers.slice().sort((a, b) => a.scoreRange[0] - b.scoreRange[0]);
    const idx = sorted.findIndex(t => r >= t.scoreRange[0] && r <= t.scoreRange[1]);
    setTierIdx(idx >= 0 ? idx : 0);
  }, [card, config]);

  // Finish a save that was interrupted by signup/login: the intent was parked
  // in sessionStorage before the redirect; the Account page sends them back.
  useEffect(() => {
    if (!user || status !== 'ok' || saveResult) return;
    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem('r5c_pending_save') || 'null'); } catch { /* ignore */ }
    if (!pending || pending.id !== id) return;
    sessionStorage.removeItem('r5c_pending_save');
    save(pending.tierKey, pending.discovered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status, id]);

  // Render the card to a moving image and download it. The server records the live
  // holographic tilt (first render takes a few seconds; repeats are cached).
  const download = useCallback(async (format) => {
    setRendering(format);
    setRenderError(null);
    try {
      const { url } = await api(`/api/cards/${id}/render?format=${format}`);
      const res = await fetch(/^https?:/.test(url) ? url : `${apiBase}${url}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${(card?.name || id).replace(/[^a-z0-9_-]+/gi, '_')}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setRenderError('Could not render this card. Try again.');
    }
    setRendering(null);
  }, [id, card]);

  if (status === 'loading') {
    return <Page><Column><Panel><Dim>Loading card…</Dim></Panel></Column></Page>;
  }
  if (status === 'notfound') {
    return (
      <Page>
        <Column>
          <Panel>
            <h2>Card not found</h2>
            <Dim>This card doesn’t exist or was removed.</Dim>
            <div style={{ marginTop: 10 }}>
              <PillButton onClick={() => navigate('/customize')}>Make your own card →</PillButton>
            </div>
          </Panel>
        </Column>
      </Page>
    );
  }
  if (status === 'error') {
    return <Page><Column><Panel><Dim>Something went wrong loading this card. Try refreshing.</Dim></Panel></Column></Page>;
  }

  const cardData = poolCardToCardData(card);
  const tags = ensureTags(card.tags);
  const synthetic = !!card.synthetic;
  const provenanceLabel = synthetic
    ? (chosenTier ? `−${chosenTier.saveCost} /t26` : null)
    : discovered ? 'Discovered Save' : 'Linked Save';

  const saved = saveResult && saveResult !== 'exists';
  const mainLabel = saveResult === 'exists' ? 'In collection ✓' : saved ? 'Saved ✓' : 'Save';
  const subLabel = saveResult ? null : provenanceLabel;

  // The underlying generation parameters — what the customizer controls.
  const cc = card.state_data?.customCard || {};
  const bg = cc.backgroundColor || {};
  const ep = cc.effectParams || {};
  const ie = cc.imageEffects || {};
  const be = cc.borderEffects || {};
  const num = (v, d = 2) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? Number(n.toFixed(d)) : null;
  };
  const activeHolo = Object.entries(cc.holoEffects || {}).filter(([, v]) => v).map(([k]) => HOLO_NAMES[k] || k);
  const holoLabel = cc.customHoloImageUrl
    ? (activeHolo.length ? `${HOLO_NAMES.overlay} + ${activeHolo.join(', ')}` : HOLO_NAMES.overlay)
    : (activeHolo.length ? activeHolo.join(', ') : 'None');
  const palette = [bg.cssVars?.['--color-1'], bg.cssVars?.['--color-2'], bg.cssVars?.['--color-3']].filter(Boolean);
  const borderParts = [be.thickBorderEnabled && 'thick', be.thinEdgeEnabled && 'thin edge'].filter(Boolean);
  const hasImage = cc.imagePath === 'custom_image' || cc.customImageUrl;
  const created = card.created_at ? new Date(card.created_at).toISOString().slice(0, 10) : null;

  // Authentic rarity (from the card's params) → tier, percentile, draw weight, pool share.
  // Pool composition is derived from every card's authentic rarity, so the tier shown
  // and the tier it's counted in always agree.
  const tierOf = (score) => (config?.tiers || []).find(t => score >= t.scoreRange[0] && score <= t.scoreRange[1])
    || config?.tiers?.find(t => t.key === 'common') || null;
  const rarity = scoreCard(cc);
  const tier = tierOf(rarity);
  const totalPublished = rarities ? rarities.length : null;
  const tierPeers = rarities && tier ? rarities.filter(r => tierOf(r)?.key === tier.key).length : null;
  const drawWeight = tier && tierPeers > 0 ? tier.probability / tierPeers : null;
  const poolShare = tierPeers != null && totalPublished > 0 ? tierPeers / totalPublished : null;
  const topPct = rarities && rarities.length
    ? Math.max(1, Math.round((1 - rarities.filter(r => r < rarity).length / rarities.length) * 100))
    : null;
  const klass = card.class || cc.class || null;

  return (
    <Page>
      <Hero>
        {cardData ? <Card cardData={cardData} /> : <Panel><Dim>This card has no renderable data.</Dim></Panel>}
      </Hero>

      <Column>
        <Meta>
          <div className="name">{card.name || (synthetic ? 'Unclaimed draw' : 'Untitled card')}</div>
          <div className="sub"><Dim>{synthetic
            ? 'lives only in this URL — save it to keep it'
            : card.creator_id === 'cloud' ? 'synthetic' : `by ${card.creator_id}`}</Dim></div>
          {tags.length > 0 && <div className="tags"><TagList tags={tags} /></div>}
        </Meta>

        {/* Synthetic saves let the saver pick how rare the card should be —
            the slider walks the tier ladder; rarer tiers cost more to save. */}
        {synthetic && !saveResult && orderedTiers.length > 0 && (
          <TierSlider className="tier-slider">
            <div className="row">
              <span className="k">Save as:</span>
              <b style={{ color: chosenTier?.color || 'var(--gold-bright)' }}>{chosenTier?.name}</b>
              <Dim>· {chosenTier?.saveCost} /t26{chosenTier?.odds ? ` · appears at 1 : ${chosenTier.odds.toLocaleString()}` : ''}</Dim>
            </div>
            <input
              type="range"
              min={0}
              max={orderedTiers.length - 1}
              step={1}
              value={Math.min(tierIdx, orderedTiers.length - 1)}
              onChange={(e) => setTierIdx(Number(e.target.value))}
            />
          </TierSlider>
        )}

        <Actions>
          <PillButton onClick={generate} disabled={busy}>
            {busy ? 'Working…' : 'Generate ⟳'}
          </PillButton>
          <SaveButton
            $secondary
            onClick={() => save()}
            disabled={busy || saveResult === 'exists' || !!saveResult}
          >
            <span className="main">{mainLabel}</span>
            {subLabel && <span className="sub">{subLabel}</span>}
          </SaveButton>
          <PillButton $secondary onClick={copyLink}>
            {copied ? 'Link copied ✓' : 'Copy link'}
          </PillButton>
        </Actions>

        {/* Server-side rendering needs the card in the database. */}
        {!synthetic && (
          <Actions>
            <PillButton $secondary onClick={() => download('gif')} disabled={!!rendering}>
              {rendering === 'gif' ? 'Rendering…' : 'Download GIF'}
            </PillButton>
            <PillButton $secondary onClick={() => download('mp4')} disabled={!!rendering}>
              {rendering === 'mp4' ? 'Rendering…' : 'Download MP4'}
            </PillButton>
          </Actions>
        )}
        {renderError && <Result $error>{renderError}</Result>}

        {saved && (
          <Result>
            Saved to your collection.{' '}
            <Link to="/collection">View collection →</Link>
          </Result>
        )}
        {saveError && <Result $error>{saveError}</Result>}

        <AboutBox>
          <summary>About Requirement5</summary>
          <div className="body"><AboutR5c /></div>
        </AboutBox>

        <Details>
          {/* Rarity & standing — rarity is computed from the card's own params */}
          <Detail label="Rarity">{num(rarity, 3)}</Detail>
          <Detail label="Percentile">{topPct != null ? `top ${topPct}%` : null}</Detail>
          {tier && orderedTiers.length > 0 && (
            <DetailRow>
              <span className="k">Tier: </span>
              {orderedTiers.map((t, i) => (
                <span key={t.key}>
                  <TierName $on={t.key === tier.key}>{t.name}</TierName>
                  {i < orderedTiers.length - 1 && <Dim> · </Dim>}
                </span>
              ))}
            </DetailRow>
          )}
          <Detail label="Class">{klass}</Detail>
          <Detail label="Draw weight">{drawWeight != null ? `${drawWeight.toExponential(2)} (${asOdds(drawWeight)})` : null}</Detail>
          <Detail label="Pool share">{poolShare != null ? `${(poolShare * 100).toFixed(1)}%` : null}</Detail>
          <Detail label="Creator dividend">{tier?.creatorDividend != null ? `${tier.creatorDividend} per save` : null}</Detail>

          <DetailDivider />
          {/* Background */}
          <Detail label="Background">{bg.type ? `${bg.type}${bg.isGradient ? ' · gradient' : ''}` : null}</Detail>
          <ColorDetail label="Base colour" colors={bg.hexColor || bg.color} active={scrolling} />
          <ColorDetail label="Palette" colors={palette} secondary active={scrolling} />

          <DetailDivider />
          {/* Pattern */}
          <Detail label="Pattern">{cc.patternInfo?.type}</Detail>
          <Detail label="Pattern opacity" secondary>{num(cc.patternInfo?.opacity)}</Detail>

          <DetailDivider />
          {/* Holographic */}
          <Detail label="Holo">{holoLabel}</Detail>
          <ColorDetail label="Shine" colors={[ep.shineColor1, ep.shineColor2, ep.shineColor3]} secondary active={scrolling} />
          <Detail label="Shine intensity" secondary>{num(ep.imageShineIntensity ?? ep.shineIntensity)}</Detail>
          <Detail label="Chromatic aberration" secondary>{num(ep.aberrationIntensity)}</Detail>
          <Detail label="Blend mode" secondary>{ep.customHoloBlendMode}</Detail>

          <DetailDivider />
          {/* Image */}
          <Detail label="Image">{hasImage ? 'Custom upload' : (cc.imagePath || 'none')}</Detail>
          <Detail label="Mask" secondary>{ie.maskType ? `${ie.maskType}${ie.maskOpacity != null ? ` · ${num(ie.maskOpacity)}` : ''}` : null}</Detail>
          <Detail label="Blur" secondary>{ie.blurAmount}</Detail>
          <ColorDetail label="Glow" colors={ie.glowColor} secondary active={scrolling} />
          <Detail label="Contrast / saturation" secondary>
            {(ie.contrast != null || ie.saturation != null) ? `${num(ie.contrast)} / ${num(ie.saturation)}` : null}
          </Detail>

          <DetailDivider />
          {/* Border */}
          <Detail label="Border">{borderParts.length ? borderParts.join(' + ') : 'none'}</Detail>
          <ColorDetail label="Border colour" colors={be.borderColor} secondary active={scrolling} />
          <ColorDetail label="Edge" colors={[be.edgeColor1, be.edgeColor2]} secondary active={scrolling} />

          <DetailDivider />
          {/* Motion + meta */}
          <Detail label="Animation speed" secondary>{num(cc.animationSpeed)}</Detail>
          <Detail label="Pixel density" secondary>{cc.pixelDensity}</Detail>
          <Detail label="Saved">{`${card.times_saved || 0} ${card.times_saved === 1 ? 'collection' : 'collections'}`}</Detail>
          <Detail label="Creator">{card.creator_id === 'cloud' ? 'synthetic' : card.creator_id}</Detail>
          <Detail label="Created" secondary>{created}</Detail>
        </Details>

        {!user && (
          <Note>
            <span className="k">Save:</span>{' '}
            <Dim>You will be asked to sign up/in to save.</Dim>
          </Note>
        )}
        {!saveResult && (
          <Note>
            {synthetic ? (
              <>
                <span className="k">Unclaimed:</span>{' '}
                <Dim>This card is generated from its URL — anyone with the link sees the
                same card. Saving claims it at the rarity you choose above.</Dim>
              </>
            ) : (
              <>
                <span className="k">{discovered ? 'Discovered Save:' : 'Linked Save:'}</span>{' '}
                <Dim>{discovered
                  ? 'A card you discover is worth full value.'
                  : 'A card saved from a shared link is worth less than one you discover.'}</Dim>
              </>
            )}
          </Note>
        )}
      </Column>
    </Page>
  );
};

// The card is a hero element — fine to centre it.
const Hero = styled.div`
  display: flex;
  justify-content: center;
  padding: 18px 12px 4px;
`;

// Text content reads left-aligned in a width-bounded column (centred as a block).
const Column = styled.div`
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
  padding: 8px 14px 64px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Meta = styled.div`
  .name { font-size: 13px; color: var(--amber-text); }
  .sub { margin-top: 2px; font-size: 13px; }
  .tags { margin-top: 6px; }
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: stretch;
  /* Buttons read in the same mono font as the rest of the page. */
  button { font-family: var(--font-mono); font-weight: 600; font-size: 13px; }
`;

// "Save" with a small provenance subtext beneath it.
const SaveButton = styled(PillButton)`
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  line-height: 1.1;
  padding: 6px 16px;
  gap: 1px;
  .main { font-size: 13px; }
  .sub { font-size: 11px; font-weight: 600; letter-spacing: 0; opacity: 0.85; }
`;

const Result = styled.div`
  line-height: 1.6;
  font-size: 13px;
  color: ${p => (p.$error ? '#ff8a8a' : 'var(--amber-text)')};
`;

// The rarity picker for saving a synthetic card: a chunky slider that walks
// the tier ladder, commonest to rarest.
const TierSlider = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;

  .row { display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
  .k { color: var(--amber-dim); }

  input[type=range] {
    -webkit-appearance: none;
    width: 100%;
    max-width: 320px;
    height: 32px;
    background: transparent;
    outline: none;

    &::-webkit-slider-runnable-track {
      height: 8px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.18);
    }
    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 24px;
      height: 24px;
      margin-top: -8px;
      border-radius: 50%;
      background: var(--gold);
      border: 2px solid rgba(0, 0, 0, 0.35);
      cursor: pointer;
    }
    &::-moz-range-track { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.18); }
    &::-moz-range-thumb { width: 24px; height: 24px; border-radius: 50%; background: var(--gold); border: 2px solid rgba(0,0,0,0.35); cursor: pointer; }
  }
`;

const Note = styled.div`
  line-height: 1.6;
  font-size: 13px;
`;

// Collapsed by default, but inviting — the lore behind R5c, one click away.
const AboutBox = styled.details`
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel);

  summary {
    cursor: pointer;
    padding: 10px 12px;
    color: var(--gold-bright);
    font-family: var(--font-mono);
    font-size: 13px;
    list-style: none;
    user-select: none;
  }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: '▸ '; color: var(--amber-dim); }
  &[open] summary::before { content: '▾ '; }

  .body { padding: 4px 14px 16px; }
`;

// Card details, in the plain label: value style of requirement5.com under a card.
const Details = styled.div`
  margin-top: 2px;
`;

const DetailRow = styled.div`
  font-size: 11px;
  line-height: 1.7;
  color: ${p => (p.$secondary ? 'var(--amber-dim)' : 'var(--amber-text)')};
  .k { color: var(--amber-dim); }
`;

const DetailDivider = styled.div`
  margin: 8px 0;
  border-top: 1px solid var(--panel-border);
`;

// One rung of the tier ladder. The card's own tier is highlighted in gold.
const TierName = styled.span`
  color: ${p => (p.$on ? 'var(--gold-bright)' : 'var(--amber-dim)')};
  font-weight: ${p => (p.$on ? 700 : 400)};
`;

// A colour value. At rest it's text colour; while scrolling it blooms into its own
// colour, then eases back — the transition does the fade in both directions.
const ColorText = styled.span`
  color: ${p => (p.$active ? p.$color : (p.$secondary ? 'var(--amber-dim)' : 'var(--amber-text)'))};
  transition: color 1.5s ease;
`;

// One "Label: value" row. Renders nothing when the value is missing.
const Detail = ({ label, children, secondary }) =>
  (children == null || children === '')
    ? null
    : <DetailRow $secondary={secondary}><span className="k">{label}: </span>{children}</DetailRow>;

// A detail row whose value is one or more colours. Each value blooms into its own
// colour while the page scrolls (see ColorText).
const ColorDetail = ({ label, colors, secondary, active }) => {
  const list = (Array.isArray(colors) ? colors : [colors]).filter(Boolean);
  if (!list.length) return null;
  return (
    <DetailRow $secondary={secondary}>
      <span className="k">{label}: </span>
      {list.map((c, i) => (
        <ColorText key={i} $color={c} $active={active} $secondary={secondary} style={{ marginRight: 8, whiteSpace: 'nowrap' }}>
          {c}
        </ColorText>
      ))}
    </DetailRow>
  );
};

export default ShareCard;
