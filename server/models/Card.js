import { memoryDb } from '../config/database.js';

export default class Card {
  static async create(cardData) {
    try {
      const card = {
        // Optional caller-chosen id (e.g. claiming a synthetic card's uuid);
        // the store generates one when absent.
        ...(cardData.id ? { id: cardData.id } : {}),
        name: cardData.name || 'Unnamed Card',
        // Optional creator blurb about the card, and the set it belongs to
        // (the namespaced set name — see server/utils/setName.js). Both null
        // when not given; set_id points at a row in `sets`.
        info: cardData.info ?? null,
        set_id: cardData.setId ?? null,
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
      return { success: true, data: memoryDb.withCreatorAndSet(card) };
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
      // memoryDb.getCommunityCards already excludes drafts and anything out of
      // circulation (flagged/removed); enrich each with creator + set for display.
      const publicCards = memoryDb.getCommunityCards()
        .map(card => memoryDb.withCreatorAndSet(card));
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
      // Delegate to the store so the "in circulation" rule (drafts + flagged +
      // removed excluded) is applied in exactly one place.
      return { success: true, data: memoryDb.getCommunityStats() };
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