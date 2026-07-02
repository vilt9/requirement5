import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Page, Panel, Dim } from '../components/UI';

// The Generate action IS the root of the site. Every press mints a card URL:
// logged in, the server draw runs first (it pays the yield, and if the rolled
// tier has published cards one of them surfaces — that's how other people's
// cards get discovered); otherwise, or when the draw comes up synthetic, a
// fresh uuid is minted and /card/<uuid> generates the card FROM the uuid —
// deterministic, shareable, not stored until someone saves it. Logged-out
// presses grow a local stash that signup/login will claim.
const GenerateGate = () => {
  const navigate = useNavigate();
  const { user, loading, setBalance, refreshBalance, bumpStash } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (loading || ran.current) return; // wait for the session restore
    ran.current = true;
    let cancelled = false;

    const go = async () => {
      if (user) {
        try {
          const result = await api('/api/draw', { method: 'POST' });
          setBalance(result.balance);
          refreshBalance();
          // A populated pool would otherwise swallow every draw — mix in fresh
          // mints so generating stays generative: rare pool finds always show,
          // common pool finds show half the time.
          const showPool = result.source === 'pool' && result.card &&
            (result.tier?.key !== 'common' || Math.random() < 0.5);
          if (!cancelled && showPool) {
            navigate(`/card/${result.card.id}`, { replace: true, state: { discovered: true } });
            return;
          }
        } catch (error) {
          console.error('Draw failed, minting a synthetic card:', error);
        }
      } else {
        bumpStash(1);
      }
      if (!cancelled) navigate(`/card/${crypto.randomUUID()}`, { replace: true });
    };
    go();
    return () => { cancelled = true; };
  }, [loading, user, navigate, setBalance, refreshBalance, bumpStash]);

  return (
    <Page>
      <Panel><Dim>Drawing a card…</Dim></Panel>
    </Page>
  );
};

export default GenerateGate;
