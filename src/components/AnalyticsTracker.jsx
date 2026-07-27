import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../utils/api';
import { markGrowthEventOnce, readAttribution } from '../utils/attribution';

// Records one first-touch visit per tab/session and one account-intent event if
// that session reaches the account screen. Both calls are fire-and-forget and
// never interrupt the product.
const send = (type) => {
  api('/api/analytics/event', {
    method: 'POST',
    body: { type, attribution: readAttribution() }
  }).catch(() => {});
};

export default function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    if (markGrowthEventOnce('visit')) send('visit');
  }, []);

  useEffect(() => {
    if (location.pathname === '/account' && markGrowthEventOnce('account_intent')) {
      send('account_intent');
    }
  }, [location.pathname]);

  return null;
}
