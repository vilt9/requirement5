import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api, getToken, setToken } from '../utils/api';
import { prefetchedCards } from '../utils/drawQueue';
import { drawYieldFor } from '../utils/economyRandom';

const AuthContext = createContext();

// Logged-out generates earn into a local stash (plain localStorage so it's
// synchronous and survives reloads). Logging in or signing up claims it: the
// count rides along on the auth request and the server credits it, capped.
const STASH_KEY = 'r5c_stash';
const readStash = () => {
  const n = parseFloat(localStorage.getItem(STASH_KEY));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const round6 = (n) => Math.round(n * 1e6) / 1e6;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);   // economy config: tiers, costs, odds
  const [yieldRemaining, setYieldRemaining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stash, setStash] = useState(readStash);

  // The last generate's earn, surfaced as a subtle tick next to the nav
  // balance (re-keyed by seq so every generate re-animates).
  const [earnFlash, setEarnFlash] = useState(null);
  const earnSeqRef = useRef(0);
  const flashEarn = useCallback((amount) => {
    if (!(amount > 0)) return;
    earnSeqRef.current += 1;
    setEarnFlash({ amount, seq: earnSeqRef.current });
  }, []);

  // The same tick, in the other direction: a spend shows a red −amount under the
  // balance (used by the create flow's reroll charge).
  const flashSpend = useCallback((amount) => {
    if (!(amount > 0)) return;
    earnSeqRef.current += 1;
    setEarnFlash({ amount: -amount, seq: earnSeqRef.current });
  }, []);

  const bumpStash = useCallback((amount = 1) => {
    setStash(current => {
      const next = round6(current + amount);
      try { localStorage.setItem(STASH_KEY, String(next)); } catch { /* private mode */ }
      return next;
    });
  }, []);

  const clearStash = useCallback(() => {
    setStash(0);
    try { localStorage.removeItem(STASH_KEY); } catch { /* private mode */ }
  }, []);

  // Economy config is public and drives every band/odds/cost render.
  useEffect(() => {
    api('/api/economy/config')
      .then(setConfig)
      .catch(error => console.error('Could not load economy config:', error));
  }, []);

  const refreshBalance = useCallback(async () => {
    try {
      const data = await api('/api/economy/balance');
      setUser(current => (current ? { ...current, balance: data.balance } : current));
      setYieldRemaining(data.yieldRemainingToday);
    } catch (error) {
      console.error('Could not refresh balance:', error);
    }
  }, []);

  // Restore the session on mount.
  useEffect(() => {
    const restore = async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await api('/api/auth/me');
        setUser(me);
        const balance = await api('/api/economy/balance');
        setYieldRemaining(balance.yieldRemainingToday);
      } catch {
        setToken(null);
      }
      setLoading(false);
    };
    restore();
  }, []);

  const signup = async (username, password) => {
    const data = await api('/api/auth/signup', {
      method: 'POST',
      body: { username, password, stash: readStash() }
    });
    setToken(data.token);
    setUser(data.user);
    clearStash();
    return data.user;
  };

  const login = async (username, password) => {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: { username, password, stash: readStash() }
    });
    setToken(data.token);
    setUser(data.user);
    clearStash();
    return data.user;
  };

  // Redeem a claim link for a "gift" account: sets the artist's password on the
  // server and logs them straight in, exactly like signup/login.
  const claim = async (token, password) => {
    const data = await api('/api/auth/claim', {
      method: 'POST',
      body: { token, password }
    });
    setToken(data.token);
    setUser(data.user);
    clearStash();
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setYieldRemaining(null);
  };

  // Endpoints that return a fresh balance can push it straight in.
  const setBalance = useCallback((balance) => {
    setUser(current => (current ? { ...current, balance } : current));
  }, []);

  // --- The generate queue: the next cards, drawn ahead of time -------------
  // Tapping Generate should be instant. Logged in, the server draw (which
  // pays the yield and can surface a published card) runs in the BACKGROUND
  // to keep a small queue topped up; each tap pops a ready entry. Logged out
  // there's nothing to wait for — uuids are minted locally.
  const queueRef = useRef([]);
  const refillingRef = useRef(false);
  const userRef = useRef(null);
  userRef.current = user;

  // Every entry carries `earned` — the /t26 the draw paid — so the card page
  // can flash it. Yields are seeded from the card's uuid (same maths client
  // and server), so the shown amount is the ledger's amount.
  const mintFresh = useCallback(() => {
    const id = crypto.randomUUID();
    prefetchedCards.set(id, 'synthetic');
    return { id, discovered: false, earned: drawYieldFor(id) };
  }, []);

  const refill = useCallback(async () => {
    if (refillingRef.current) return;
    refillingRef.current = true;
    try {
      while (userRef.current && queueRef.current.length < 2) {
        // Mint the synthetic uuid up front and send it as the yield seed; if
        // the draw lands on a pool card instead, the server seeds from that
        // card's id. Either way result.yield is what was actually credited.
        const seed = crypto.randomUUID();
        const result = await api('/api/draw', { method: 'POST', body: { seed } });
        setBalance(result.balance);
        const earned = result.yield?.credited ?? 0;
        // Rare pool finds always surface; common pool finds only half the
        // time, so generating stays generative even with a populated pool.
        const showPool = result.source === 'pool' && result.card &&
          (result.tier?.key !== 'common' || Math.random() < 0.5);
        if (showPool) {
          prefetchedCards.set(result.card.id, result.card);
          queueRef.current.push({ id: result.card.id, discovered: true, earned });
        } else {
          prefetchedCards.set(seed, 'synthetic');
          queueRef.current.push({ id: seed, discovered: false, earned });
        }
      }
    } catch (error) {
      console.error('Draw prefetch failed:', error);
    } finally {
      refillingRef.current = false;
    }
  }, [setBalance]);

  // Fresh session or auth change: the old queue's provenance is stale.
  // Keyed on the user's ID, not the object — refill updates the balance,
  // which recreates the user object, and keying on identity would loop
  // draw → new user object → reset → draw... until the daily cap drained.
  const userId = user?.id || null;
  useEffect(() => {
    queueRef.current = [];
    if (userId) refill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Pop the next card to show. Never waits: an empty queue mints a fresh
  // uuid on the spot (its card generates from the seed, no network needed).
  const nextCard = useCallback(() => {
    if (!user) {
      const entry = mintFresh();
      bumpStash(entry.earned); // the stash grows by the card's own seeded yield
      flashEarn(entry.earned);
      return entry;
    }
    const entry = queueRef.current.shift() || mintFresh();
    refill();
    flashEarn(entry.earned);
    return entry;
  }, [user, refill, bumpStash, mintFresh, flashEarn]);

  return (
    <AuthContext.Provider value={{
      user, config, yieldRemaining, loading,
      signup, login, claim, logout, refreshBalance, setBalance,
      stash, bumpStash, nextCard, earnFlash, flashSpend
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Tier helpers driven by the server config.
export const tierByKey = (config, key) =>
  config?.tiers?.find(t => t.key === key) || null;

export const tierForScore = (config, score) => {
  if (!config?.tiers) return null;
  const s = Math.max(0, Math.min(1, Number(score) || 0));
  return config.tiers.find(t => s >= t.scoreRange[0] && s <= t.scoreRange[1]) || null;
};
