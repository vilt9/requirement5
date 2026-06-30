import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../utils/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);   // economy config: tiers, costs, odds
  const [yieldRemaining, setYieldRemaining] = useState(null);
  const [loading, setLoading] = useState(true);

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
    const data = await api('/api/auth/signup', { method: 'POST', body: { username, password } });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const login = async (username, password) => {
    const data = await api('/api/auth/login', { method: 'POST', body: { username, password } });
    setToken(data.token);
    setUser(data.user);
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

  return (
    <AuthContext.Provider value={{
      user, config, yieldRemaining, loading,
      signup, login, logout, refreshBalance, setBalance
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
