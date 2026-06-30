import { createContext, useContext, useState, useCallback } from 'react';

const CommunityContext = createContext();

export const useCommunity = () => {
  const context = useContext(CommunityContext);
  if (!context) {
    throw new Error('useCommunity must be used within a CommunityProvider');
  }
  return context;
};

export const CommunityProvider = ({ children }) => {
  const [discoveredCard, setDiscoveredCard] = useState(null);
  const [communityStats, setCommunityStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Discover a random community card
  const discoverRandomCard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:4000/api/cards/community/random');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setDiscoveredCard(data.data);
      } else {
        throw new Error(data.error || 'Failed to discover card');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error discovering random card:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Collect the currently discovered card
  const collectCard = useCallback(async (cardId) => {
    if (!cardId) return;
    
    try {
      const response = await fetch(`http://localhost:4000/api/cards/${cardId}/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        // Update the discovered card with new collection count
        setDiscoveredCard(prev => prev ? {
          ...prev,
          collection_count: (prev.collection_count || 0) + 1
        } : null);
        
        // Refresh community stats
        fetchCommunityStats();
        
        return { success: true, message: 'Card collected successfully!' };
      } else {
        throw new Error(data.error || 'Failed to collect card');
      }
    } catch (err) {
      console.error('Error collecting card:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // Fetch community statistics
  const fetchCommunityStats = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:4000/api/cards/community/stats');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setCommunityStats(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch community stats');
      }
    } catch (err) {
      console.error('Error fetching community stats:', err);
      setError(err.message);
    }
  }, []);

  // Clear the discovered card
  const clearDiscoveredCard = useCallback(() => {
    setDiscoveredCard(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = {
    discoveredCard,
    communityStats,
    isLoading,
    error,
    discoverRandomCard,
    collectCard,
    fetchCommunityStats,
    clearDiscoveredCard,
    clearError
  };

  return (
    <CommunityContext.Provider value={value}>
      {children}
    </CommunityContext.Provider>
  );
}; 