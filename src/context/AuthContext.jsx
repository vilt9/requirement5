import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api, getToken, setToken } from '../utils/api';
import { prefetchedCards } from '../utils/drawQueue';

const AuthContext = createContext();

// Logged-out generates earn into a local stash (plain localStorage so it's
// synchronous and survives reloads). Logging in or signing up claims it: the
// count rides along on the auth request and the server credits it, capped.
const STASH_KEY = 'r5c_stash';
const readStash = () => {
  const n = parseInt(localStorage.getItem(STASH_KEY), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);   // economy config: tiers, costs, odds
  const [yieldRemaining, setYieldRemaining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stash, setStash] = useState(readStash);

  const bumpStash = useCallback((amount = 1) => {
    setStash(current => {
      const next = current + amount;
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

  const mintFresh = useCallback(() => {
    const id = crypto.randomUUID();
    prefetchedCards.set(id, 'synthetic');
    return { id, discovered: false };
  }, []);

  const refill = useCallback(async () => {
    if (refillingRef.current) return;
    refillingRef.current = true;
    try {
      while (userRef.current && queueRef.current.length < 2) {
        const result = await api('/api/draw', { method: 'POST' });
        setBalance(result.balance);
        // Rare pool finds always surface; common pool finds only half the
        // time, so generating stays generative even with a populated pool.
        const showPool = result.source === 'pool' && result.card &&
          (result.tier?.key !== 'common' || Math.random() < 0.5);
        if (showPool) {
          prefetchedCards.set(result.card.id, result.card);
          queueRef.current.push({ id: result.card.id, discovered: true });
        } else {
          queueRef.current.push(mintFresh());
        }
      }
    } catch (error) {
      console.error('Draw prefetch failed:', error);
    } finally {
      refillingRef.current = false;
    }
  }, [setBalance, mintFresh]);

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
      bumpStash(1);
      return mintFresh();
    }
    const entry = queueRef.current.shift();
    refill();
    return entry || mintFresh();
  }, [user, refill, bumpStash, mintFresh]);

  return (
    <AuthContext.Provider value={{
      user, config, yieldRemaining, loading,
      signup, login, logout, refreshBalance, setBalance,
      stash, bumpStash, nextCard
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
