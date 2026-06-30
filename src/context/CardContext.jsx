import { createContext, useContext, useEffect, useState } from 'react';
import localforage from 'localforage';
import { generateCardAttributes } from '../utils/cardGenerator';
import { makePreset } from '../utils/presets';

// Initialize the card storage database
localforage.config({
  name: 'CardGenerator',
  storeName: 'saved_cards'
});

// Create context
const CardContext = createContext();

export function CardProvider({ children }) {
  const [currentCard, setCurrentCard] = useState(null);
  const [savedCards, setSavedCards] = useState([]);
  const [presets, setPresets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customImages, setCustomImages] = useState({});

  // Load saved cards + presets from storage on initial render
  useEffect(() => {
    const loadSavedCards = async () => {
      try {
        const cards = await localforage.getItem('cards') || [];
        setSavedCards(cards);
        const storedPresets = await localforage.getItem('presets') || [];
        setPresets(storedPresets);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading saved cards:', error);
        setIsLoading(false);
      }
    };

    loadSavedCards();
  }, []);

  // Generate a new card
  const generateNewCard = () => {
    const newCard = generateCardAttributes();
    setCurrentCard(newCard);
    return newCard;
  };
  
  // Update current card with custom attributes
  const updateCustomCard = (updatedCard) => {
    setCurrentCard(updatedCard);
    return updatedCard;
  };
  
  // Save a custom image to local storage
  const saveCustomImage = async (imageType, imageData) => {
    try {
      const updatedImages = {...customImages, [imageType]: imageData};
      setCustomImages(updatedImages);
      await localforage.setItem('customImages', updatedImages);
      return true;
    } catch (error) {
      console.error('Error saving custom image:', error);
      return false;
    }
  };
  
  // Get saved custom images
  const getCustomImages = async () => {
    try {
      const images = await localforage.getItem('customImages') || {};
      setCustomImages(images);
      return images;
    } catch (error) {
      console.error('Error loading custom images:', error);
      return {};
    }
  };

  // Save the current card
  const saveCard = async () => {
    if (!currentCard) return;
    
    try {
      // Add to savedCards state
      const updatedCards = [...savedCards, currentCard];
      setSavedCards(updatedCards);
      
      // Persist to storage
      await localforage.setItem('cards', updatedCards);
      
      return currentCard.id;
    } catch (error) {
      console.error('Error saving card:', error);
      return null;
    }
  };

  // Delete a saved card
  const deleteCard = async (cardId) => {
    try {
      const updatedCards = savedCards.filter(card => card.id !== cardId);
      setSavedCards(updatedCards);
      
      // Persist to storage
      await localforage.setItem('cards', updatedCards);
      
      return true;
    } catch (error) {
      console.error('Error deleting card:', error);
      return false;
    }
  };

  // --- Preset sets: named, reusable customizer defaults (client-side) ---

  // Save the current card's design + tags as a named preset. If a preset with the
  // same name exists, overwrite it (so "Save as…" with a known name updates it).
  const savePreset = async (name, card = currentCard, options = {}) => {
    if (!card) return null;
    try {
      const preset = makePreset(name, card, options);
      const others = presets.filter(p => p.name.toLowerCase() !== preset.name.toLowerCase());
      const updated = [...others, preset];
      setPresets(updated);
      await localforage.setItem('presets', updated);
      return preset;
    } catch (error) {
      console.error('Error saving preset:', error);
      return null;
    }
  };

  // Delete a preset by id.
  const deletePreset = async (presetId) => {
    try {
      const updated = presets.filter(p => p.id !== presetId);
      setPresets(updated);
      await localforage.setItem('presets', updated);
      return true;
    } catch (error) {
      console.error('Error deleting preset:', error);
      return false;
    }
  };

  // Load custom images on initial render
  useEffect(() => {
    getCustomImages();
  }, []);

  return (
    <CardContext.Provider 
      value={{
        currentCard,
        savedCards,
        presets,
        isLoading,
        customImages,
        generateNewCard,
        updateCustomCard,
        saveCard,
        deleteCard,
        savePreset,
        deletePreset,
        saveCustomImage,
        getCustomImages
      }}
    >
      {children}
    </CardContext.Provider>
  );
}

// Custom hook for using the card context
export const useCards = () => useContext(CardContext);
