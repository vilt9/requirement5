import { memoryDb } from '../config/database.js';

export default class Card {
  static async create(cardData) {
    try {
      const card = {
        name: cardData.name || 'Unnamed Card',
        state_data: cardData.stateData || {},
        creator_id: cardData.creatorId || 'anonymous',
        is_public: cardData.isPublic !== false, // Default to public
        collection_count: 0,
        tags: cardData.tags || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = memoryDb.createCard(card);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error creating card:', error);
      return { success: false, error: error.message };
    }
  }

  static async findAll() {
    try {
      const cards = memoryDb.getAllCards();
      return { success: true, data: cards };
    } catch (error) {
      console.error('Error finding all cards:', error);
      return { success: false, error: error.message };
    }
  }

  static async findById(id) {
    try {
      const card = memoryDb.getCardById(id);
      if (!card) {
        return { success: false, error: 'Card not found' };
      }
      return { success: true, data: card };
    } catch (error) {
      console.error('Error finding card by id:', error);
      return { success: false, error: error.message };
    }
  }

  static async update(id, updateData) {
    try {
      const card = memoryDb.getCardById(id);
      if (!card) {
        return { success: false, error: 'Card not found' };
      }

      const updatedCard = {
        ...card,
        ...updateData,
        updated_at: new Date().toISOString()
      };

      const result = memoryDb.updateCard(id, updatedCard);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error updating card:', error);
      return { success: false, error: error.message };
    }
  }

  static async delete(id) {
    try {
      const card = memoryDb.getCardById(id);
      if (!card) {
        return { success: false, error: 'Card not found' };
      }

      memoryDb.deleteCard(id);
      return { success: true, data: { message: 'Card deleted successfully' } };
    } catch (error) {
      console.error('Error deleting card:', error);
      return { success: false, error: error.message };
    }
  }

  static async searchByState(property, value) {
    try {
      const cards = memoryDb.searchCards(property, value);
      return { success: true, data: cards };
    } catch (error) {
      console.error('Error searching cards:', error);
      return { success: false, error: error.message };
    }
  }

  static async findByDateRange(startDate, endDate) {
    try {
      const cards = memoryDb.getAllCards().filter(card => {
        const cardDate = new Date(card.created_at);
        return cardDate >= startDate && cardDate <= endDate;
      });
      return { success: true, data: cards };
    } catch (error) {
      console.error('Error finding cards by date range:', error);
      return { success: false, error: error.message };
    }
  }

  // New collection-related methods
  static async getCommunityCards() {
    try {
      const allCards = memoryDb.getAllCards();
      const publicCards = allCards.filter(card => card.is_public);
      return { success: true, data: publicCards };
    } catch (error) {
      console.error('Error getting community cards:', error);
      return { success: false, error: error.message };
    }
  }

  static async getRandomCommunityCard() {
    try {
      const communityCards = await this.getCommunityCards();
      if (!communityCards.success || communityCards.data.length === 0) {
        return { success: false, error: 'No community cards available' };
      }

      // Simple random selection for now, can be enhanced with weighted selection later
      const randomIndex = Math.floor(Math.random() * communityCards.data.length);
      const randomCard = communityCards.data[randomIndex];
      
      return { success: true, data: randomCard };
    } catch (error) {
      console.error('Error getting random community card:', error);
      return { success: false, error: error.message };
    }
  }

  static async incrementCollectionCount(cardId) {
    try {
      const card = memoryDb.getCardById(cardId);
      if (!card) {
        return { success: false, error: 'Card not found' };
      }

      const updatedCard = {
        ...card,
        collection_count: (card.collection_count || 0) + 1,
        updated_at: new Date().toISOString()
      };

      const result = memoryDb.updateCard(cardId, updatedCard);
      return { success: true, data: result };
    } catch (error) {
      console.error('Error incrementing collection count:', error);
      return { success: false, error: error.message };
    }
  }

  static async getCommunityStats() {
    try {
      const allCards = memoryDb.getAllCards();
      const publicCards = allCards.filter(card => card.is_public);
      
      const stats = {
        totalCards: publicCards.length,
        activeCreators: new Set(publicCards.map(card => card.creator_id)).size,
        recentActivity: publicCards.filter(card => {
          const cardDate = new Date(card.created_at);
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return cardDate >= oneDayAgo;
        }).length,
        totalCollections: publicCards.reduce((sum, card) => sum + (card.collection_count || 0), 0)
      };

      return { success: true, data: stats };
    } catch (error) {
      console.error('Error getting community stats:', error);
      return { success: false, error: error.message };
    }
  }

  static async clearDatabase() {
    try {
      const result = memoryDb.clearDatabase();
      if (result) {
        return { success: true, data: { message: 'Database cleared successfully' } };
      } else {
        return { success: false, error: 'Failed to clear database' };
      }
    } catch (error) {
      console.error('Error clearing database:', error);
      return { success: false, error: error.message };
    }
  }
} 