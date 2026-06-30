import { useState, useEffect } from 'react';

// Returns true while the page is actively scrolling, flipping back to false a
// short rest after it stops. Drives the "bloom on scroll" effect — values ease to
// their own colour (or white) while scrolling and fade back to text colour at rest.
//
// Capture phase + window: pages here scroll on <body> (the global overflow-x:hidden
// makes body its own scroller), so a plain window 'scroll' listener never fires.
// Capturing on window catches scroll from any descendant, including body.
export const useScrollBloom = (restMs = 180) => {
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    let restTimer;
    const onScroll = () => {
      setScrolling(true);
      clearTimeout(restTimer);
      restTimer = setTimeout(() => setScrolling(false), restMs);
    };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      clearTimeout(restTimer);
    };
  }, [restMs]);

  return scrolling;
};
