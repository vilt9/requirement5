// Headless capture surface. Renders ONLY the card, centred on black, with no app
// chrome — this is the page Playwright loads (server/services/capture.js) to record
// the holographic tilt as a GIF/MP4. The render driver dispatches synthetic mouse
// moves onto the real .card-scene, so what we record is exactly the live effect.
//
// Contract with the capture driver:
//   #capture-frame  — fixed-size box the screenshot is clipped to.
//   window.__captureReady === true once the card + its image have settled.
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Card from '../components/Card/Card';
import { api } from '../utils/api';
import { poolCardToCardData } from '../utils/poolCard';
import { generateCardAttributes } from '../utils/cardGenerator';

const CaptureCard = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const includeUrl = searchParams.get('includeUrl') !== '0';
  const [cardData, setCardData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    api(`/api/cards/${id}`)
      .then(record => { if (active) setCardData(poolCardToCardData(record)); })
      .catch(err => {
        if (!active) return;
        // Unclaimed uuid: the card exists only as math — render it from its seed,
        // exactly like the share page does. Downloads work before a card is saved.
        if (err?.status === 404 && /^[0-9a-f-]{10,64}$/i.test(id)) {
          setCardData(poolCardToCardData({
            state_data: { customCard: generateCardAttributes({ seed: id }) }
          }));
        } else {
          setError(true);
          window.__captureReady = true;
        }
      });
    return () => { active = false; };
  }, [id]);

  // Signal readiness once the card is mounted, its images have decoded and fonts
  // are loaded. The driver waits on window.__captureReady before capturing.
  useEffect(() => {
    if (!cardData) return;
    let cancelled = false;

    const imagesReady = () => {
      const imgs = Array.from(document.querySelectorAll('#capture-frame img'));
      return imgs.every(img => img.complete && img.naturalWidth > 0);
    };

    const start = Date.now();
    const tick = () => {
      if (cancelled) return;
      // settle: images decoded + a short paint buffer, capped so a missing image
      // never hangs the render.
      if ((imagesReady() && Date.now() - start > 350) || Date.now() - start > 4000) {
        window.__captureReady = true;
        return;
      }
      requestAnimationFrame(tick);
    };
    Promise.resolve(document.fonts ? document.fonts.ready : null).finally(() => tick());

    return () => { cancelled = true; };
  }, [cardData]);

  return (
    <div
      id="capture-frame"
      style={{
        position: 'fixed',
        inset: 0,
        margin: 'auto',
        width: 380,
        height: 520,
        display: 'grid',
        placeItems: 'center',
        background: '#000',
        zIndex: 99999,
        overflow: 'hidden'
      }}
    >
      {cardData && !error ? <Card cardData={cardData} /> : null}

      {/* End card. Held at opacity 0 (so its fonts preload); the capture driver
          fades it in after the card fades out, so every clip closes on the wordmark.
          Centred is intentional here — this is a title/lockup, not running text. */}
      <div
        id="capture-outro"
        data-include-url={includeUrl ? 'true' : 'false'}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          background: '#000',
          opacity: 0,
          pointerEvents: 'none',
          textAlign: 'center',
          zIndex: 2
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* The badge is black-on-white art; invert it to sit white-on-black. The
              near-white ground (≈253) inverts to ≈2 — a hair off pure black — so a
              touch of contrast snaps that ground to #000 (seamless) and crisps the mark. */}
          <img
            src="/r5c_logo.png"
            alt="R5c"
            width={200}
            height={200}
            style={{ filter: 'invert(1) contrast(1.12)', display: 'block' }}
          />
          {includeUrl && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--amber-text)', marginTop: 10 }}>
              requirement5.com
            </div>
          )}
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginTop: 18 }}>Join the Resistance</div>
        </div>
      </div>
    </div>
  );
};

export default CaptureCard;
