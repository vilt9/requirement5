import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Page, Panel, Dim } from '../components/UI';

// The Generate action IS the root of the site. Every visit pops the next card
// from the prefetch queue (AuthContext keeps it topped up: logged-in draws run
// in the background paying the yield and surfacing published cards; logged-out
// mints locally and grows the stash) and routes straight to its URL — no
// waiting on the network, ever.
const GenerateGate = () => {
  const navigate = useNavigate();
  const { loading, nextCard } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (loading || ran.current) return; // wait for the session restore
    ran.current = true;
    const entry = nextCard();
    navigate(`/card/${entry.id}`, {
      replace: true,
      state: { discovered: entry.discovered, earned: entry.earned }
    });
  }, [loading, nextCard, navigate]);

  return (
    <Page>
      <Panel><Dim>Drawing a card…</Dim></Panel>
    </Page>
  );
};

export default GenerateGate;
