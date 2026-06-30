import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import Card from '../components/Card/Card';
import { useCommunity } from '../context/CommunityContext';
import { FaEye, FaHeart } from 'react-icons/fa';

const CommunityDiscovery = () => {
  const { 
    discoveredCard, 
    communityStats, 
    isLoading, 
    error,
    discoverRandomCard, 
    collectCard, 
    fetchCommunityStats 
  } = useCommunity();
  
  const [collectionFeedback, setCollectionFeedback] = useState(null);
  
  // Fetch community stats and discover first card on mount
  useEffect(() => {
    fetchCommunityStats();
    discoverRandomCard();
  }, [fetchCommunityStats, discoverRandomCard]);
  
  const handleGenerateCard = () => {
    setCollectionFeedback(null);
    discoverRandomCard();
  };
  
  const handleCollectCard = async () => {
    if (!discoveredCard) return;
    
    const result = await collectCard(discoveredCard.id);
    if (result.success) {
      setCollectionFeedback(result.message);
      setTimeout(() => setCollectionFeedback(null), 3000);
    } else {
      setCollectionFeedback(`Error: ${result.error}`);
      setTimeout(() => setCollectionFeedback(null), 3000);
    }
  };

  // Convert discovered card data to Card component format
  const convertToCardData = (discoveredCard) => {
    try {
      if (!discoveredCard || !discoveredCard.state_data || !discoveredCard.state_data.customCard) {
        return null;
      }

      const customCard = discoveredCard.state_data.customCard;
      
      return {
        ...customCard,
        imagePath: customCard.imagePath || 'default',
        customImageUrl: customCard.customImageUrl,
        customHoloImageUrl: customCard.customHoloImageUrl,
        backgroundColor: customCard.backgroundColor || '#1a1a1a',
        effectParams: customCard.effectParams || {},
        holoEffects: customCard.holoEffects || {},
        borderEffects: customCard.borderEffects || {},
        imageEffects: customCard.imageEffects || {},
        timeEffects: customCard.timeEffects || {},
        patternInfo: customCard.patternInfo || {},
        rarity: customCard.rarity || 'common'
      };
    } catch (err) {
      console.error('Error converting discovered card data:', err);
      return null;
    }
  };
  
  return (
    <Container>
      <div className="top-spacer"></div>
      
      {discoveredCard && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card cardData={convertToCardData(discoveredCard)} />
        </motion.div>
      )}
      
      <ButtonContainer>
        <GenerateButton onClick={handleGenerateCard} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Generate New Card'}
        </GenerateButton>
        
        <CollectButton 
          onClick={handleCollectCard}
          disabled={!discoveredCard}
        >
          <FaHeart style={{ marginRight: '8px' }} />
          Collect Card
        </CollectButton>
      </ButtonContainer>
      
      {collectionFeedback && (
        <FeedbackMessage>
          {collectionFeedback}
        </FeedbackMessage>
      )}
      
      <InfoPanel>
        {discoveredCard && (
          <>
            <InfoRow>
              <InfoLabel>Pattern Type:</InfoLabel>
              <InfoValue>{discoveredCard.state_data?.customCard?.patternInfo?.type || 'Standard'}</InfoValue>
            </InfoRow>
            
            <InfoRow>
              <InfoLabel>Rarity:</InfoLabel>
              <InfoValue>
                {discoveredCard.state_data?.customCard?.rarity >= 0.98 ? 'VMAX Rare' :
                  discoveredCard.state_data?.customCard?.rarity >= 0.9 ? 'Ultra Rare' :
                  discoveredCard.state_data?.customCard?.rarity >= 0.85 && discoveredCard.state_data?.customCard?.rarity < 0.9 ? 'WOWA Rare' :
                  discoveredCard.state_data?.customCard?.rarity >= 0.8 ? 'Galaxy Rare' :
                  discoveredCard.state_data?.customCard?.rarity >= 0.7 ? 'Holo Rare' :
                  'Common'} ({((discoveredCard.state_data?.customCard?.rarity || 0) * 100).toFixed(2)}%)
              </InfoValue>
            </InfoRow>
            
            <InfoRow className="secondary-info">
              <InfoLabel>Base Hue:</InfoLabel>
              <InfoValue>{Math.round(discoveredCard.state_data?.customCard?.backgroundColor?.baseHue || 0)}°</InfoValue>
            </InfoRow>

            <InfoRow className="secondary-info">
              <InfoLabel>Pattern Opacity:</InfoLabel>
              <InfoValue>{((discoveredCard.state_data?.customCard?.patternInfo?.opacity || 0) * 100).toFixed(1)}%</InfoValue>
            </InfoRow>
            
            {/* Holographic and Effect Parameters */}
            <InfoRow>
              <InfoLabel>Holo Effect:</InfoLabel>
              <InfoValue>{
                discoveredCard.state_data?.customCard?.rarity >= 0.98 ? 'VMAX Holographic' :
                discoveredCard.state_data?.customCard?.rarity >= 0.9 ? 'Ultra Rare Shine' :
                discoveredCard.state_data?.customCard?.rarity >= 0.85 && discoveredCard.state_data?.customCard?.rarity < 0.9 ? 'WOWA Holo' :
                discoveredCard.state_data?.customCard?.rarity >= 0.8 ? 'Galaxy Holographic' :
                discoveredCard.state_data?.customCard?.rarity >= 0.7 ? 'Standard Holographic' :
                'None'
              }</InfoValue>
            </InfoRow>
            
            {discoveredCard.state_data?.customCard?.rarity >= 0.7 && (
              <InfoRow className="secondary-info">
                <InfoLabel>Holo Space:</InfoLabel>
                <InfoValue>{discoveredCard.state_data?.customCard?.effectParams?.space || 'Standard'}</InfoValue>
              </InfoRow>
            )}
            
            {discoveredCard.state_data?.customCard?.rarity >= 0.8 && (
              <InfoRow className="secondary-info">
                <InfoLabel>Shine Colors:</InfoLabel>
                <InfoValue>Custom Blend</InfoValue>
              </InfoRow>
            )}
            
            {discoveredCard.state_data?.customCard?.rarity >= 0.9 && (
              <InfoRow className="secondary-info">
                <InfoLabel>Aberration:</InfoLabel>
                <InfoValue>
                  {(parseFloat(discoveredCard.state_data?.customCard?.effectParams?.aberrationIntensity || 0) * 100).toFixed(0)}%
                </InfoValue>
              </InfoRow>
            )}
            
            <InfoRow className="secondary-info">
              <InfoLabel>Image Mask:</InfoLabel>
              <InfoValue>
                {discoveredCard.state_data?.customCard?.imageEffects?.maskType || 'Vignette'} 
                ({(parseFloat(discoveredCard.state_data?.customCard?.imageEffects?.maskOpacity || 0.3) * 100).toFixed(0)}%)
              </InfoValue>
            </InfoRow>
            
            <InfoRow className="secondary-info">
              <InfoLabel>Shine Intensity:</InfoLabel>
              <InfoValue>
                {(parseFloat(discoveredCard.state_data?.customCard?.effectParams?.imageShineIntensity || 0.7) * 100).toFixed(0)}%
              </InfoValue>
            </InfoRow>
            
            <InfoRow>
              <InfoLabel>Current Patterns:</InfoLabel>
              <InfoValue>
                {discoveredCard.state_data?.customCard?.patternInfo?.patterns?.join(', ') || 'None'}
              </InfoValue>
            </InfoRow>
            
            <InfoRow>
              <InfoLabel>Time Sensitive Background:</InfoLabel>
              <InfoValue>
                {discoveredCard.state_data?.customCard?.hasTimeEffect 
                  ? (discoveredCard.state_data?.customCard?.timeEffects?.isNight 
                    ? `Night Boost (${(discoveredCard.state_data?.customCard?.timeEffects?.nightBoostFactor || 1).toFixed(2)}x)` 
                    : 'Day Mode')
                  : 'None'}
              </InfoValue>
            </InfoRow>
            
            <InfoRow className="secondary-info">
              <InfoLabel>Animation Speed:</InfoLabel>
              <InfoValue>{discoveredCard.state_data?.customCard?.animationSpeed || 'Normal'}</InfoValue>
            </InfoRow>
            
            <InfoRow className="secondary-info">
              <InfoLabel>Pixel Density:</InfoLabel>
              <InfoValue>{discoveredCard.state_data?.customCard?.pixelDensity || 5}px</InfoValue>
            </InfoRow>
            
            {/* Border Effects Information */}
            <InfoRow>
              <InfoLabel>Border Effects:</InfoLabel>
              <InfoValue>
                {(discoveredCard.state_data?.customCard?.borderEffects?.thickBorderEnabled && discoveredCard.state_data?.customCard?.borderEffects?.thinEdgeEnabled) ? 'Both Borders' :
                 discoveredCard.state_data?.customCard?.borderEffects?.thickBorderEnabled ? 'Thick Border' :
                 discoveredCard.state_data?.customCard?.borderEffects?.thinEdgeEnabled ? 'Thin Edge' : 'None'}
              </InfoValue>
            </InfoRow>
            
            {(discoveredCard.state_data?.customCard?.borderEffects?.thickBorderEnabled || discoveredCard.state_data?.customCard?.borderEffects?.thinEdgeEnabled) && (
              <>
                {discoveredCard.state_data?.customCard?.borderEffects?.thickBorderEnabled && (
                  <InfoRow className="secondary-info">
                    <InfoLabel>Thick Border:</InfoLabel>
                    <InfoValue style={{ 
                      color: discoveredCard.state_data?.customCard?.borderEffects?.borderColor ||
                             'rgba(255, 215, 0, 0.2)' 
                    }}>
                      {Math.round((discoveredCard.state_data?.customCard?.borderEffects?.borderOpacity || 0) * 100)}% Opacity
                    </InfoValue>
                  </InfoRow>
                )}
                
                {discoveredCard.state_data?.customCard?.borderEffects?.thinEdgeEnabled && (
                  <InfoRow className="secondary-info">
                    <InfoLabel>Edge Color:</InfoLabel>
                    <InfoValue style={{ 
                      color: discoveredCard.state_data?.customCard?.borderEffects?.thinEdgeColor ||
                             'rgba(255, 215, 0, 0.6)' 
                    }}>
                      Thin Edge Active
                    </InfoValue>
                  </InfoRow>
                )}
              </>
            )}

            {/* Community Card Information */}
            <InfoRow>
              <InfoLabel>Creator:</InfoLabel>
              <InfoValue>{discoveredCard.creator_id || 'Anonymous'}</InfoValue>
            </InfoRow>
            
            <InfoRow className="secondary-info">
              <InfoLabel>Collection Count:</InfoLabel>
              <InfoValue>{discoveredCard.collection_count || 0}</InfoValue>
            </InfoRow>
            
            <InfoRow className="secondary-info">
              <InfoLabel>Created:</InfoLabel>
              <InfoValue>{new Date(discoveredCard.created_at).toLocaleDateString()}</InfoValue>
            </InfoRow>
          </>
        )}
      </InfoPanel>
      
      <div className="bottom-spacer"></div>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  min-height: calc(100vh - 60px);
  padding: 20px;
  padding-top: 40px;
  
  .top-spacer {
    height: 2vh;
  }
  
  .bottom-spacer {
    height: 5vh;
  }
  
  @media (max-width: 768px) {
    padding-top: 20px;
    .top-spacer {
      height: 1vh;
    }
    .bottom-spacer {
      height: 3vh;
    }
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 12px;
  margin: 5px 0;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
  max-width: 450px;
  
  @media (max-width: 768px) {
    gap: 10px;
    margin: 2px 0;
  }
`;

const GenerateButton = styled.button`
  background: white;
  color: #1a1a1a;
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  font-family: monospace;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;
  margin: 15px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    opacity: 0.9;
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  @media (max-width: 768px) {
    padding: 6px 12px;
    font-size: 11px;
    margin: 1rem 0;
  }
`;

const CollectButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  color: #1a1a1a;
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  font-family: monospace;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;
  margin: 15px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    opacity: 0.9;
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    background: #6c757d;
    color: white;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
    opacity: 0.7;
  }
  
  @media (max-width: 768px) {
    padding: 6px 12px;
    font-size: 11px;
    margin: 1rem 0;
  }
`;

const FeedbackMessage = styled.div`
  background: rgba(40, 167, 69, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 500;
  font-family: monospace;
  font-size: 10px;
  margin: 10px 0;
  letter-spacing: 0.5px;
  text-align: center;
`;

const InfoPanel = styled.div`
  position: relative;
  color: white;
  font-family: monospace;
  font-size: 10px;
  background: rgba(0,0,0,0.7);
  padding: 10px;
  border-radius: 5px;
  z-index: 1000;
  width: 90%;
  max-width: 400px;
  margin: 5px auto;
  transition: opacity 0.2s ease;
  overflow-y: auto;
  max-height: 300px;
  
  &:hover {
    background: rgba(0,0,0,0.85);
  }
  
  @media (max-width: 768px) {
    padding: 8px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 5px;
    margin: 0 auto;
    max-height: 250px;
  }
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  pointer-events: auto;
  
  &.secondary-info {
    opacity: 0.8;
    font-size: 9px;
  }
  
  &:last-child {
    margin-bottom: 0;
    grid-column: 1 / -1;
    text-align: center;
  }
`;

const InfoLabel = styled.span`
  font-weight: 500;
  color: #ccc;
  font-family: monospace;
`;

const InfoValue = styled.span`
  font-weight: 500;
  color: white;
  font-family: monospace;
`;

export default CommunityDiscovery; 