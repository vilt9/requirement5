import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import styled from 'styled-components';
import { LuCircleArrowRight, LuLink, LuSearchCheck } from 'react-icons/lu';
import Card from '../components/Card/Card';
import { useAuth } from '../context/AuthContext';
import { api, ApiError, apiBase } from '../utils/api';
import { poolCardToCardData } from '../utils/poolCard';
import { generateCardAttributes } from '../utils/cardGenerator';
import { saveCostFor, savePriceFor, fmtT26 } from '../utils/economyRandom';
import { scrubTo } from '../utils/cardMotion';
import { prefetchedCards } from '../utils/drawQueue';
import { HOLO_NAMES } from '../utils/holoNames';
import { useScrollBloom } from '../utils/useScrollBloom';
import AboutR5c from '../components/AboutR5c';
import { Page, Panel, PillButton, Dim, TagList, Select, TextArea, ErrorText } from '../components/UI';
import { ensureTags } from '../utils/tags';

// Public card view at /card/:id. Anyone can look and press Generate to surface the
// next random card — the "discovered" path. Saving is the signup hook: it needs an
// account, and a discovered save (reached via Generate, a flag that lives in router
// state and so can't ride along a copied URL) is worth more than a linked save.
// Below the card we surface the underlying generation parameters — the things the
// customizer actually controls — because users care about every detail.
const ShareCard = () => {
  // With a :username in the URL this is a collector's copy of the card —
  // same page, plus whose collection it's in and what they paid for it.
  const { id, username } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, config, setBalance, refreshBalance, nextCard, flashSpend } = useAuth();

  // Reached via the Generate button this session? Lives in router state, never
  // the URL. `earned` is the /t26 the generate paid — flashed on arrival.
  const discovered = !!location.state?.discovered;
  const earned = location.state?.earned ?? null;

  const [card, setCard] = useState(null);
  const [rarities, setRarities] = useState(null); // every card's authentic rarity → percentile, pool composition
  const [status, setStatus] = useState('loading'); // loading | ok | notfound | error
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveResult, setSaveResult] = useState(null); // { value, provenance } | 'exists'
  const [saveError, setSaveError] = useState(null);
  const scrolling = useScrollBloom(); // colour values bloom into their colour while scrolling
  const [rendering, setRendering] = useState(null); // 'gif' | 'mp4' while a moving image renders
  const [renderError, setRenderError] = useState(null);

  // Reporting a card. Open the form, pick a reason, submit — the server takes
  // the card out of circulation immediately and queues it for admin review.
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('nudity');
  const [reportDetail, setReportDetail] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [reportError, setReportError] = useState(null);

  // A generated card starts its run at the TOP of the track: flat for a
  // breath, then straight into the shiny zone — the fastest read on whether
  // this card's holo is a keeper or the next Generate beckons. `earned` rides
  // along on every Generate navigation (and never on a shared link), the same
  // "arrived via Generate" signal as `discovered` — both mark the discovered path.
  //
  // The rewind waits for the card's art: resetting the moment navigation
  // lands replays the flat→shiny reveal against the PREVIOUS card's pixels
  // (the new image is still downloading), and by the time it swaps in the
  // shiny window has passed. So decode the images first, then rewind — art
  // and reveal arrive together (the Card fades its image in on load). The
  // wait is capped so a dead URL can't strand the loop; art-less cards
  // render from pure math and rewind immediately. Keyed on the art itself,
  // not the card object: saving a card swaps the record but not the pixels,
  // and that must not yank the loop back to the top.
  const rewoundArtRef = useRef(null);
  useEffect(() => {
    if (earned == null || !card) return undefined;
    const data = poolCardToCardData(card);
    const urls = [
      data?.imagePath === 'custom_image' && data?.customImageUrl
        ? data.customImageUrl
        : (data?.imagePath ? `/assets/card_images/${data.imagePath}` : null),
      data?.customHoloImageUrl,
      data?.rareHoloParams?.backgroundImage,
      data?.rareHoloGalaxyParams?.backgroundImage,
      data?.wowaHoloParams?.backgroundImage,
      data?.rareHoloVmaxParams?.backgroundImage
    ].filter(u => typeof u === 'string' && u);
    const artKey = `${id}|${urls.join('|')}`;
    if (rewoundArtRef.current === artKey) return undefined;

    let active = true;
    const settled = (url) => new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = url;
    });
    const cap = new Promise((resolve) => { setTimeout(resolve, 2500); });
    Promise.race([Promise.all(urls.map(settled)), cap]).then(() => {
      if (!active) return;
      rewoundArtRef.current = artKey;
      scrubTo(0);
    });
    return () => { active = false; };
  }, [id, earned, card]);

  // provisional = we're showing the uuid-seeded card while the server tells us
  // whether a stored card owns this id. Fresh mints skip that check entirely.
  const [provisional, setProvisional] = useState(false);

  // The owner's save record when viewing /<username>/card/<id> — what this
  // collector paid, and when. Silently absent if they never saved it.
  const [ownerSave, setOwnerSave] = useState(null);
  useEffect(() => {
    setOwnerSave(null);
    if (!username) return undefined;
    let active = true;
    api(`/api/cards/${id}/save-of/${encodeURIComponent(username)}`)
      .then(data => { if (active) setOwnerSave(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [id, username]);

  const synthFromSeed = (seed) => ({
    id: seed,
    name: null,
    creator_id: null,
    tags: [],
    times_saved: 0,
    state_data: { customCard: generateCardAttributes({ seed }) },
    synthetic: true
  });

  useEffect(() => {
    let active = true;
    setSaveResult(null);
    setSaveError(null);

    // Prefetched by the generate queue? Render with zero waiting. Consumed
    // once — a revisit re-checks the server (the card may be saved by then).
    const cached = prefetchedCards.get(id);
    if (cached) {
      prefetchedCards.delete(id);
      setCard(cached === 'synthetic' ? synthFromSeed(id) : cached);
      setProvisional(false);
      setStatus('ok');
      return;
    }

    const uuidish = /^[0-9a-f-]{10,64}$/i.test(id);
    if (uuidish) {
      // The uuid IS the card: render the seeded version IMMEDIATELY (no dead
      // loading state), and let the fetch below either confirm it (404 — it
      // exists only as math) or cross-fade to the stored card that claimed it.
      setCard(synthFromSeed(id));
      setProvisional(true);
      setStatus('ok');
    } else {
      setCard(null);
      setStatus('loading');
    }

    api(`/api/cards/${id}`)
      .then(record => { if (active) { setCard(record); setProvisional(false); setStatus('ok'); } })
      .catch(err => {
        if (!active) return;
        if (uuidish && err?.status === 404) {
          setProvisional(false); // the seeded render was right — unclaimed
        } else if (uuidish) {
          setProvisional(false); // network hiccup: the seeded card still shows
        } else {
          setStatus(err?.status === 404 ? 'notfound' : 'error');
        }
      });
    return () => { active = false; };
  }, [id]);

  // The authentic rarity of every published card — drives this card's percentile,
  // pool share and draw weight. We use the STORED rarity_score (the server roll),
  // the same number this card is measured by, so the comparison is like-for-like.
  // (Re-deriving a score from each card's look collapses to ~0 for most cards, so
  // the percentile is only meaningful against the authentic scores.)
  useEffect(() => {
    let active = true;
    api('/api/cards/community/all')
      .then(cards => {
        if (active) setRarities(cards.map(c => c.rarity_score).filter(n => typeof n === 'number'));
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

  // Generate pops the next prefetched card — instant, no gate page. Pushed
  // (not replaced) so Back walks through the cards you've seen.
  const generate = useCallback(() => {
    const entry = nextCard();
    // Reached via Generate ⇒ a discovered save (whatever the card's source).
    navigate(`/card/${entry.id}`, {
      state: { discovered: true, earned: entry.earned }
    });
  }, [nextCard, navigate]);

  // Tiers commonest → rarest (the ladder shown in the details).
  const orderedTiers = (config?.tiers || []).slice().sort((a, b) => a.scoreRange[0] - b.scoreRange[0]);

  const save = useCallback(async (discoveredOverride) => {
    const synthetic = !!card?.synthetic;
    const isDiscovered = discoveredOverride ?? discovered;
    if (!user) {
      // The conversion moment: remember exactly what they wanted to save, send
      // them to create a free account, and finish the save when they're back.
      try {
        sessionStorage.setItem('r5c_pending_save', JSON.stringify({
          id, synthetic, discovered: isDiscovered
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
            stateData: { customCard: card.state_data.customCard }
          }
        });
        setBalance(result.balance);
        setCard({ ...result.card, synthetic: false });
        setSaveResult(result);
        flashSpend(result.cost); // deduction ticks by the nav balance, like reroll
      } else {
        const result = await api(`/api/cards/${id}/save`, {
          method: 'POST',
          body: { provenance: isDiscovered ? 'discovered' : 'linked' }
        });
        setBalance(result.balance);
        setSaveResult(result);
        flashSpend(result.cost);
      }
      refreshBalance();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setSaveResult('exists');
      else setSaveError(err?.message || 'Could not save this card.');
    }
    setBusy(false);
  }, [user, id, card, discovered, navigate, location.pathname, setBalance, refreshBalance, flashSpend]);

  // Finish a save that was interrupted by signup/login: the intent was parked
  // in sessionStorage before the redirect; the Account page sends them back.
  useEffect(() => {
    if (!user || status !== 'ok' || saveResult) return;
    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem('r5c_pending_save') || 'null'); } catch { /* ignore */ }
    if (!pending || pending.id !== id) return;
    sessionStorage.removeItem('r5c_pending_save');
    save(pending.discovered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, status, id]);

  // Render the card to a moving image and download it. The server records the live
  // holographic tilt (first render takes a few seconds; repeats are cached). The
  // file itself comes through our own /download endpoint: the object store is a
  // different origin without CORS, so a browser-side fetch of the render URL fails —
  // and blob-anchor downloads are flaky on mobile Safari anyway. Navigating an
  // anchor at an attachment response downloads everywhere without leaving the page.
  const download = useCallback(async (format) => {
    setRendering(format);
    setRenderError(null);
    try {
      await api(`/api/cards/${id}/render?format=${format}`); // waits for the render to exist
      const a = document.createElement('a');
      a.href = `${apiBase}/api/cards/${id}/render/download?format=${format}`;
      a.download = `${(card?.name || id).replace(/[^a-z0-9_-]+/gi, '_')}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setRenderError('Could not render this card. Try again.');
    }
    setRendering(null);
  }, [id, card]);

  const submitReport = useCallback(async () => {
    setReportBusy(true);
    setReportError(null);
    try {
      await api(`/api/cards/${id}/report`, {
        method: 'POST',
        body: { reason: reportReason, detail: reportDetail.trim() || undefined }
      });
      setReportDone(true);
      setReportOpen(false);
    } catch (err) {
      setReportError(err?.message || 'Could not send this report. Please try again.');
    }
    setReportBusy(false);
  }, [id, reportReason, reportDetail]);

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
              <PillButton onClick={() => navigate('/create')}>Make your own card →</PillButton>
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
  const veilOn = !!cc.holoEffects?.overlay;
  const activeHolo = Object.entries(cc.holoEffects || {})
    .filter(([k, v]) => v && k !== 'overlay')
    .map(([k]) => HOLO_NAMES[k] || k);
  const holoLabel = veilOn
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
  // Rarity is the server roll (stored on the card), not something recomputed
  // from the look — you can't design your way to a better score. For an unsaved
  // synthetic draw it's the card's OWN generated rarity (the same value the
  // server will charge against), so the price shown is exactly what's charged.
  const rarity = typeof card.rarity_score === 'number'
    ? card.rarity_score
    : (Number.isFinite(Number(cc.rarity)) ? Math.max(0, Math.min(1, Number(cc.rarity))) : 0.35);
  const tier = tierOf(rarity);
  // Price tracks that rarity as a wide distribution, seeded from the id. The
  // server computes the identical number. `cardPrice` is the base (discovered)
  // price; a save reached via a shared link pays the surcharged `myPrice`.
  const cardPrice = saveCostFor(id, rarity);               // discovered (base) price
  const myProvenance = discovered ? 'discovered' : 'linked';
  const linkedPrice = savePriceFor(id, 'linked', rarity);  // base × surcharge
  const myPrice = savePriceFor(id, myProvenance, rarity);

  const saved = saveResult && saveResult !== 'exists';
  const mainLabel = saveResult === 'exists' ? 'In collection ✓' : saved ? 'Saved ✓' : (discovered ? 'D-Save' : 'L-Save');
  const subLabel = saveResult ? null : `−${fmtT26(myPrice)} /t26`;
  const totalPublished = rarities ? rarities.length : null;
  const tierPeers = rarities && tier ? rarities.filter(r => tierOf(r)?.key === tier.key).length : null;
  const poolShare = tierPeers != null && totalPublished > 0 ? tierPeers / totalPublished : null;
  const topPct = rarities && rarities.length
    ? Math.max(1, Math.round((1 - rarities.filter(r => r < rarity).length / rarities.length) * 100))
    : null;
  const klass = card.class || cc.class || null;

  // Creator: cards store a uuid, but the enriched record carries the username.
  // Link it to that creator's collection; the set (if any) links to its wall.
  const creatorName = card.creator_id === 'cloud' ? 'synthetic' : (card.creator_username || null);
  const creatorLink = card.creator_username ? `/${card.creator_username}/collection` : null;
  const ownerLinked = ownerSave && (ownerSave.provenance === 'linked' || ownerSave.provenance === 'direct');

  return (
    <Page>
      <Hero>
        {cardData
          ? (
            // Keyed on identity: swapping provisional→stored (or card→card)
            // remounts with a soft fade instead of a hard cut.
            <FadeSwap key={`${id}:${synthetic ? 'synth' : 'stored'}`}>
              <Card cardData={cardData} scrub />
            </FadeSwap>
          )
          : <Panel><Dim>This card has no renderable data.</Dim></Panel>}
      </Hero>

      <Column>
        {/* The card's name, creator and provenance used to sit here, above the
            dock — but their height varies card to card, which bounced the
            Generate button up and down on desktop. They now live in their own
            table below (see CardInfo), so the dock keeps a fixed position. */}

        {/* Generate + Save live in a fixed dock at the bottom of the screen —
            always visible, so the next card is one tap away from anywhere. The
            rarity of the card you just pulled rides at the top of the dock, so
            how rare it is reads instantly without scrolling to the details. */}
        <FixedDock className="card-actions">
          <RarityReadout style={{ '--tier': tier?.color || 'var(--amber-text)' }}>
            <span className="label">Rarity</span>
            <span className="val">{num(rarity, 3)}</span>
            {tier && <span className="tier">{tier.name}</span>}
          </RarityReadout>
          <div className="buttons">
            <SaveButton onClick={generate} disabled={busy}>
              <span className="main">{busy ? 'Working…' : 'Generate'} <LuCircleArrowRight aria-hidden /></span>
              <span className="sub">{earned != null ? `+${fmtT26(earned)} /t26` : '+ /t26'}</span>
            </SaveButton>
            <SaveButton
              $secondary
              onClick={() => save()}
              disabled={busy || provisional || saveResult === 'exists' || !!saveResult}
            >
              <span className="main">
                {mainLabel}
                {!saveResult && (myProvenance === 'linked'
                  ? <LuLink aria-hidden />
                  : <LuSearchCheck aria-hidden />)}
              </span>
              {subLabel && <span className="sub">{subLabel}</span>}
            </SaveButton>
          </div>
        </FixedDock>

        {/* Card name + creator, front and central right under the buttons.
            Collapsed by default; opening it reveals the full identity table
            (prices, set, tags). Synthetic draws have no identity, so it's
            skipped for them. */}
        {!synthetic && (
          <CardIdentity>
            <summary>
              <span className="stack">
                <span className="name">{card.name || 'Untitled card'}</span>
                {creatorName && <span className="by">{creatorName}</span>}
              </span>
            </summary>
            <div className="body">
              <Detail label="Name">{card.name || 'Untitled card'}</Detail>
              {card.info && <DetailRow $secondary>{card.info}</DetailRow>}
              {creatorName && (
                <DetailRow>
                  <span className="k">Creator: </span>
                  {creatorLink ? <Link to={creatorLink}>{creatorName}</Link> : creatorName}
                </DetailRow>
              )}
              {card.set && (
                <>
                  <DetailRow>
                    <span className="k">Set: </span>
                    <Link to={`/set/${encodeURIComponent(card.set.id)}`}>{card.set.label}</Link>
                  </DetailRow>
                  {card.set.info && <DetailRow $secondary>{card.set.info}</DetailRow>}
                </>
              )}
              {ownerSave && (
                <DetailRow>
                  <span className="k">Saved by: </span>
                  <Link to={`/${ownerSave.username}/collection`}>{ownerSave.username}</Link>
                  {ownerSave.cost != null && <> — {fmtT26(ownerSave.cost)} /t26</>}
                  {' '}<SaveTag $linked={ownerLinked}>{ownerLinked ? 'L-Save' : 'D-Save'}</SaveTag>
                  {ownerSave.saved_at && <> · {new Date(ownerSave.saved_at).toISOString().slice(0, 10)}</>}
                </DetailRow>
              )}
              <DetailRow>
                <span className="k">Discovered save price: </span>
                {fmtT26(cardPrice)} /t26
              </DetailRow>
              <DetailRow>
                <span className="k">Linked save price: </span>
                −{fmtT26(linkedPrice)} /t26
              </DetailRow>
              {tags.length > 0 && (
                <DetailRow className="tags-row">
                  <span className="k">Tags: </span>
                  <TagList tags={tags} onTagClick={(t) => navigate(`/tag/${encodeURIComponent(t)}`)} />
                </DetailRow>
              )}
              <DetailDivider />
              <SaveExplainer>
                <div><b>D-Save</b> — <i>discovered</i>:<br />A card you generated yourself. You pay the base price.</div>
                <div><b>L-Save</b> — <i>linked</i>:<br />A card you were sent a link to. You pay a surcharge.</div>
                {!saved && !saveResult && (
                  <div style={{ marginTop: 8 }}>Save this card now and it's recorded as a{discovered ? '' : 'n'} <b>{discovered ? 'D' : 'L'}-Save</b>.</div>
                )}
              </SaveExplainer>
            </div>
          </CardIdentity>
        )}

        <AboutBox>
          <summary>About Requirement5</summary>
          <div className="body"><AboutR5c /></div>
        </AboutBox>

        {/* Secondary actions stay in the page flow. Unclaimed cards render
            from their seed, so downloads work before a card is ever saved. */}
        <Actions>
          <PillButton $secondary onClick={copyLink}>
            {copied ? 'Link copied ✓' : 'Copy link'}
          </PillButton>
          <PillButton $secondary onClick={() => download('gif')} disabled={!!rendering}>
            {rendering === 'gif' ? 'Rendering…' : 'Download GIF'}
          </PillButton>
          <PillButton $secondary onClick={() => download('mp4')} disabled={!!rendering}>
            {rendering === 'mp4' ? 'Rendering…' : 'Download MP4'}
          </PillButton>
        </Actions>
        {renderError && <Result $error>{renderError}</Result>}

        {/* Report / flag. Only for real stored cards (a synthetic draw that
            nobody has saved isn't in the pool to report). Submitting takes the
            card out of circulation immediately, pending admin review. */}
        {!synthetic && !provisional && (
          <ReportArea>
            {reportDone ? (
              <Dim>Thanks — this card has been sent for review and taken out of circulation.</Dim>
            ) : reportOpen ? (
              <div className="form">
                <div className="title">Report this card</div>
                <Select value={reportReason} onChange={e => setReportReason(e.target.value)}>
                  <option value="nudity">Nudity or sexual content</option>
                  <option value="violence">Violence or gore</option>
                  <option value="copyright">Copyright / stolen artwork</option>
                  <option value="hate">Hate or harassment</option>
                  <option value="illegal">Other illegal content</option>
                  <option value="spam">Spam</option>
                  <option value="other">Something else</option>
                </Select>
                <TextArea
                  placeholder="Add any detail (optional)"
                  value={reportDetail}
                  onChange={e => setReportDetail(e.target.value)}
                />
                {reportError && <ErrorText>{reportError}</ErrorText>}
                <div className="buttons">
                  <PillButton onClick={submitReport} disabled={reportBusy}>
                    {reportBusy ? 'Sending…' : 'Submit report'}
                  </PillButton>
                  <PillButton $secondary onClick={() => setReportOpen(false)} disabled={reportBusy}>
                    Cancel
                  </PillButton>
                </div>
              </div>
            ) : (
              <button type="button" className="trigger" onClick={() => setReportOpen(true)}>
                ⚑ Report this card
              </button>
            )}
          </ReportArea>
        )}

        {saved && (
          <Result>
            Saved to your collection.{' '}
            <Link to="/collection">View collection →</Link>
          </Result>
        )}
        {saveError && <Result $error>{saveError}</Result>}

        {user && user.balance < 0 && (
          <TopUpNote>
            Your account is {fmtT26(user.balance)} in debt.{' '}
            {fmtT26(user.balance - (config?.debtFloor ?? -1000))} /t26 until you reach
            the debt ceiling. <Link to="/account">Learn about purchasing /t26</Link>.
          </TopUpNote>
        )}

        <Details>
          {/* Rarity & standing — the server roll; drives the tier and the price. */}
          <Detail label="Rarity Value">{num(rarity, 3)}</Detail>
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
          <Detail label="Pool share">{poolShare != null ? `${(poolShare * 100).toFixed(1)}%` : null}</Detail>
          <Detail label="Price">{`${fmtT26(cardPrice)} /t26`}</Detail>
          <Detail label="Creator dividend">{config?.pricing?.dividendRate != null
            ? `${fmtT26(cardPrice * config.pricing.dividendRate)} per save` : null}</Detail>

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
          <Detail label="Created" secondary>{created}</Detail>
        </Details>

        {!user && (
          <Note>
            <span className="k">Save:</span>{' '}
            <Dim>You will be asked to sign up/in to save.</Dim>
          </Note>
        )}
        {!saveResult && !provisional && !synthetic && (
          <Note>
            <span className="k">{discovered ? 'Discovered Save:' : 'Linked Save:'}</span>{' '}
            <Dim>{discovered
              ? 'A card you discover is worth full value.'
              : 'A card saved from a shared link is worth less than one you discover.'}</Dim>
          </Note>
        )}
      </Column>
    </Page>
  );
};

// The card is a hero element — fine to centre it.
const Hero = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  padding: 18px 12px 4px;

  /* Phones: vertical space is precious — the card starts almost at the top. */
  @media (max-width: 640px) {
    padding: 4px 10px 2px;
  }
`;

// Soft entrance when a card (or its resolved identity) arrives.
const FadeSwap = styled.div`
  animation: cardIn 0.45s ease;
  @keyframes cardIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

// Text content reads left-aligned in a width-bounded column (centred as a block).
const Column = styled.div`
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
  padding: 8px 14px 28px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 12px;

  /* Phones lift Generate/Save into a fixed dock — clear space so it never
     covers the last of the page. */
  @media (max-width: 640px) {
    padding-bottom: 96px;
  }
`;

// A small inline chip marking a save as discovered (base price) or linked
// (surcharge). Sits next to an InfoTip that explains the difference.
const SaveTag = styled.span`
  font-weight: 600;
  color: ${p => (p.$linked ? 'var(--gold-bright)' : 'var(--amber-text)')};
  margin-right: 3px;
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: stretch;
  /* Buttons read in the same mono font as the rest of the page. */
  button { font-family: var(--font-mono); font-weight: 600; font-size: 13px; }
`;

// Generate + Save. On desktop they sit inline, directly under the card, in the
// normal page flow. On phones — where vertical space is scarce and chaining
// generates matters — they lift into a fixed dock at the bottom of the screen,
// always a thumb away, with a translucent panel and a gentle glow.
const FixedDock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  .buttons {
    display: flex;
    gap: 10px;
    align-items: stretch;
  }
  button {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 13px;
    position: relative;
  }

  @media (max-width: 640px) {
    position: fixed;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 40;
    padding: 8px 10px;
    border-radius: 12px;
    background: rgba(8, 6, 3, 0.85);
    backdrop-filter: blur(6px);
    border: 1px solid var(--panel-border);

    /* A slow, gentle glow — enough to draw the eye, never enough to nag.
       The shadow is painted ONCE on a pseudo-layer and pulsed via opacity
       (compositor-only); animating box-shadow itself repainted the dock on
       every frame of the 3.2s loop, forever. */
    button::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      box-shadow: 0 0 10px 1px rgba(232, 180, 85, 0.3);
      opacity: 0;
      pointer-events: none;
      animation: dockPulse 3.2s ease-in-out infinite;
    }
    button:disabled::after { animation: none; opacity: 0; }

    @keyframes dockPulse {
      0%, 100% { opacity: 0; }
      50%      { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      button::after { animation: none; opacity: 0; }
    }
  }
`;

// The pulled card's rarity, sat at the top of the dock so it's the first thing
// read after a Generate. The value and tier name take the tier's own colour, so
// a Singular glows pink and a Common stays muted — an instant "how rare is this".
const RarityReadout = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 1px 4px;
  .label {
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--amber-dim);
  }
  .val {
    font-size: 13px;
    font-weight: 400;
    line-height: 1;
    color: var(--tier);
    font-variant-numeric: tabular-nums;
  }
  .tier { font-size: 12px; font-weight: 400; color: var(--tier); }

  @media (max-width: 640px) {
    justify-content: center;
    padding: 0 2px 2px;
  }
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
  .main { font-size: 13px; display: inline-flex; align-items: center; gap: 5px; }
  .main svg { font-size: 15px; margin-top: -4px; }
  .sub { font-size: 11px; font-weight: 600; letter-spacing: 0; opacity: 0.85; }
`;

const Result = styled.div`
  line-height: 1.6;
  font-size: 13px;
  color: ${p => (p.$error ? '#ff8a8a' : 'var(--amber-text)')};
`;

// The report control: a quiet trigger that opens into a small reason form.
const ReportArea = styled.div`
  .trigger {
    background: none;
    border: none;
    padding: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--amber-dim);
    cursor: pointer;
    &:hover { color: #ff8a8a; text-decoration: underline; }
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    background: var(--panel);
  }
  .title { font-size: 13px; color: var(--gold-bright); }
  .buttons { display: flex; gap: 8px; }
`;

const Note = styled.div`
  line-height: 1.6;
  font-size: 13px;
`;

// The D-Save vs L-Save explainer, sitting just above the price tables (and below
// the debt note). Replaces the old (i) tooltips that used to sit beside the rows.
const SaveExplainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--amber-dim);

  b { color: var(--amber-text); }
  i { color: var(--gold-bright); }
`;

// Collapsed by default, but inviting — the lore behind R5c, one click away.
// Shown under the About box only when the viewer's own balance is negative — a
// small note of remaining debt headroom with an underlined link to the account
// page's purchase options.
const TopUpNote = styled.p`
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--amber-dim);

  a {
    color: var(--gold-bright);
    text-decoration: underline;
  }
`;

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

// The card's name + creator, front and central right under the dock. The name
// is the always-visible summary; opening it drops down the identity table
// (creator, set, save prices, tags). Same collapsible look as the About box.
const CardIdentity = styled.details`
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel);

  summary {
    cursor: pointer;
    padding: 10px 12px;
    font-family: var(--font-mono);
    list-style: none;
    user-select: none;
    display: flex;
    align-items: baseline;
    gap: 7px;
  }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: '▸'; color: var(--amber-dim); }
  &[open] summary::before { content: '▾'; }

  /* Name over creator, each on its own line, so a very long card name wraps
     cleanly instead of colliding with the username. */
  .stack { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .name { font-size: 14px; color: var(--gold-bright); overflow-wrap: anywhere; }
  .by { font-size: 12px; color: var(--amber-dim); overflow-wrap: anywhere; }

  .body {
    padding: 4px 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
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

  /* Keep the "Tags:" label on the same line as its chips, wrapping as needed. */
  &.tags-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
  }
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
