import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { FaTrash, FaEye, FaDatabase, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import Card from '../components/Card/Card';

const TestSavedCards = () => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch all saved cards from the server
  const fetchCards = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('http://localhost:4000/api/cards');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setCards(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch cards');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching cards:', err);
    } finally {
      setLoading(false);
    }
  };

  // Delete all cards
  const deleteAllCards = async () => {
    if (!window.confirm('Are you sure you want to delete ALL saved cards? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);

      // Delete each card individually
      const deletePromises = cards.map(card => 
        fetch(`http://localhost:4000/api/cards/${card.id}`, {
          method: 'DELETE'
        })
      );

      await Promise.all(deletePromises);
      
      // Clear the cards from state
      setCards([]);
      
      // Show success message
      alert('All cards deleted successfully!');
    } catch (err) {
      setError('Failed to delete all cards: ' + err.message);
      console.error('Error deleting cards:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Load cards on component mount
  useEffect(() => {
    fetchCards();
  }, []);

  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Convert saved card data to Card component format
  const convertToCardData = (savedCard) => {
    try {
      // Backend returns stateData (camelCase), not state_data (snake_case)
      const stateData = savedCard.stateData || savedCard.state_data;
      if (!stateData || !stateData.customCard) {
        console.warn('Invalid card data structure:', savedCard);
        return null;
      }

      // Extract the customCard data which contains all the visual properties
      const customCard = stateData.customCard;
      
      // Return the card data in the format expected by the Card component
      return {
        ...customCard,
        // Ensure we have all the necessary properties with proper fallbacks
        imagePath: customCard.imagePath || 'wolf_toys_1', // Use a valid default image
        customImageUrl: customCard.customImageUrl || null,
        customHoloImageUrl: customCard.customHoloImageUrl || null,
        backgroundColor: customCard.backgroundColor || '#1a1a1a',
        effectParams: customCard.effectParams || {},
        holoEffects: customCard.holoEffects || {},
        borderEffects: customCard.borderEffects || {},
        imageEffects: customCard.imageEffects || {},
        timeEffects: customCard.timeEffects || {},
        patternInfo: customCard.patternInfo || { type: 'Standard', opacity: 0.5, patterns: [] },
        rarity: customCard.rarity || 0.5,
        // Add missing required properties
        hasTimeEffect: customCard.hasTimeEffect || false,
        animationSpeed: customCard.animationSpeed || 'Normal',
        pixelDensity: customCard.pixelDensity || 5
      };
    } catch (err) {
      console.error('Error converting card data:', err);
      return null;
    }
  };

  if (loading) {
    return (
      <Container>
        <Header>
          <h1><FaDatabase /> Saved Cards</h1>
          <p>View all your saved card customizations</p>
        </Header>
        
        <LoadingState>
          <div className="spinner"></div>
          <p>Loading saved cards...</p>
        </LoadingState>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <h1><FaDatabase /> Saved Cards</h1>
        <p>View all your saved card customizations with full visual effects</p>
        
        <StatsBar>
          <StatItem>
            <strong>Total Cards:</strong> {cards.length}
          </StatItem>
          <StatItem>
            <strong>Database:</strong> localhost:4000 (Real Cards)
          </StatItem>
        </StatsBar>
      </Header>

      {error && (
        <ErrorBanner>
          <FaExclamationTriangle />
          <span>{error}</span>
          <button onClick={fetchCards}>Retry</button>
        </ErrorBanner>
      )}

      <ActionsBar>
        <RefreshButton onClick={fetchCards} disabled={loading}>
          Refresh Cards
        </RefreshButton>
        
        {cards.length > 0 && (
          <DeleteAllButton onClick={deleteAllCards} disabled={deleting}>
            <FaTrash />
            {deleting ? 'Deleting...' : 'Delete All Cards'}
          </DeleteAllButton>
        )}
      </ActionsBar>

      {cards.length === 0 ? (
        <EmptyState>
          <FaDatabase size={48} />
          <h3>No saved cards yet</h3>
          <p>Customize a card on the Customize page and click Save to see it here!</p>
          <button onClick={fetchCards}>Check Again</button>
        </EmptyState>
      ) : (
        <CardsGrid>
          {cards.map((savedCard) => {
            const cardData = convertToCardData(savedCard);
            
            if (!cardData) {
              return (
                <CardItem key={savedCard.id}>
                  <CardHeader>
                    <CardName>{savedCard.name || 'Unnamed Card'}</CardName>
                    <CardId>ID: {savedCard.id.slice(0, 8)}...</CardId>
                  </CardHeader>
                  
                  <CardPreview>
                    <p>⚠️ Invalid card data - cannot render</p>
                    <p>Data Size: {savedCard.stateData ? JSON.stringify(savedCard.stateData).length : 0} chars</p>
                  </CardPreview>
                  
                  <CardMeta>
                    <MetaItem>
                      <strong>Created:</strong> {formatDate(savedCard.created_at)}
                    </MetaItem>
                    <MetaItem>
                      <strong>Updated:</strong> {formatDate(savedCard.updated_at)}
                    </MetaItem>
                  </CardMeta>
                  
                  <CardActions>
                    <DeleteButton onClick={() => {
                      if (window.confirm(`Delete "${savedCard.name || 'Unnamed Card'}"?`)) {
                        fetch(`http://localhost:4000/api/cards/${savedCard.id}`, {
                          method: 'DELETE'
                        }).then(() => {
                          setCards(cards.filter(c => c.id !== savedCard.id));
                        }).catch(err => {
                          setError('Failed to delete card: ' + err.message);
                        });
                      }
                    }}>
                      <FaTrash /> Delete
                    </DeleteButton>
                  </CardActions>
                </CardItem>
              );
            }

            return (
              <CardItem key={savedCard.id}>
                <CardHeader>
                  <CardName>{savedCard.name || 'Unnamed Card'}</CardName>
                  <CardId>ID: {savedCard.id.slice(0, 8)}...</CardId>
                </CardHeader>
                
                <CardRenderSection>
                  <Card 
                    cardData={cardData} 
                    isInteractive={true} // Enable mouse effects for saved cards view
                  />
                </CardRenderSection>
                
                <CardMeta>
                  <MetaItem>
                    <strong>Created:</strong> {formatDate(savedCard.created_at)}
                  </MetaItem>
                  <MetaItem>
                    <strong>Updated:</strong> {formatDate(savedCard.updated_at)}
                  </MetaItem>
                  <MetaItem>
                    <strong>Data Size:</strong> {savedCard.stateData ? JSON.stringify(savedCard.stateData).length : 0} chars
                  </MetaItem>
                </CardMeta>
                
                <CardActions>
                  <ViewButton>
                    <FaEye /> View Details
                  </ViewButton>
                  <DeleteButton onClick={() => {
                    if (window.confirm(`Delete "${savedCard.name || 'Unnamed Card'}"?`)) {
                      fetch(`http://localhost:4000/api/cards/${savedCard.id}`, {
                        method: 'DELETE'
                      }).then(() => {
                        setCards(cards.filter(c => c.id !== savedCard.id));
                      }).catch(err => {
                        setError('Failed to delete card: ' + err.message);
                      });
                    }
                  }}>
                    <FaTrash /> Delete
                  </DeleteButton>
                </CardActions>
              </CardItem>
            );
          })}
        </CardsGrid>
      )}
    </Container>
  );
};

const Container = styled.div`
  padding: 80px 24px 24px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 32px;
  
  h1 {
    color: white;
    font-size: 2.5rem;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  
  p {
    color: rgba(255, 255, 255, 0.8);
    font-size: 1.1rem;
    margin-bottom: 24px;
  }
`;

const StatsBar = styled.div`
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-top: 16px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
  }
`;

const StatItem = styled.div`
  background: rgba(255, 255, 255, 0.1);
  padding: 12px 20px;
  border-radius: 8px;
  color: white;
  backdrop-filter: blur(10px);
`;

const ErrorBanner = styled.div`
  background: rgba(220, 53, 69, 0.9);
  color: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  backdrop-filter: blur(10px);
  
  button {
    margin-left: auto;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    
    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
`;

const ActionsBar = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  justify-content: center;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
  }
`;

const RefreshButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const DeleteAllButton = styled.button`
  background: rgba(220, 53, 69, 0.8);
  border: 1px solid rgba(220, 53, 69, 0.3);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover:not(:disabled) {
    background: rgba(220, 53, 69, 0.9);
    border-color: rgba(220, 53, 69, 0.5);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  color: white;
  padding: 60px 20px;
  
  svg {
    opacity: 0.6;
    margin-bottom: 16px;
  }
  
  h3 {
    font-size: 1.5rem;
    margin-bottom: 8px;
  }
  
  p {
    opacity: 0.8;
    margin-bottom: 24px;
  }
  
  button {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }
`;

const LoadingState = styled.div`
  text-align: center;
  color: white;
  padding: 60px 20px;
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top: 4px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const CardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 32px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 24px;
  }
`;

const CardItem = styled.div`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
  }
`;

const CardHeader = styled.div`
  margin-bottom: 20px;
  text-align: center;
`;

const CardName = styled.h3`
  color: white;
  font-size: 1.3rem;
  margin-bottom: 8px;
`;

const CardId = styled.div`
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  font-family: monospace;
`;

const CardRenderSection = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  
  /* Ensure the card renders at a good size for interaction */
  transform: scale(0.85);
  transform-origin: center;
  
  /* Add some space around the card for hover effects */
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  @media (max-width: 768px) {
    transform: scale(0.75);
    min-height: 280px;
  }
`;

const CardPreview = styled.div`
  background: rgba(0, 0, 0, 0.2);
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
  text-align: center;
`;

const CardMeta = styled.div`
  margin-bottom: 20px;
`;

const MetaItem = styled.div`
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
  margin-bottom: 6px;
  text-align: center;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const CardActions = styled.div`
  display: flex;
  gap: 12px;
`;

const ViewButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 10px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const DeleteButton = styled.button`
  background: rgba(220, 53, 69, 0.6);
  border: 1px solid rgba(220, 53, 69, 0.3);
  color: white;
  padding: 10px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  
  &:hover {
    background: rgba(220, 53, 69, 0.8);
  }
`;

export default TestSavedCards;