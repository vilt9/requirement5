import Card from '../models/Card.js';
import { memoryDb } from '../config/database.js';

// Mock the memoryDb
jest.mock('../config/database.js', () => ({
  memoryDb: {
    nextId: 1,
    createCard: jest.fn(),
    getAllCards: jest.fn(),
    getCardById: jest.fn(),
    updateCard: jest.fn(),
    deleteCard: jest.fn(),
    searchCards: jest.fn(),
    getCommunityCards: jest.fn(),
    getRandomCommunityCard: jest.fn(),
    incrementCollectionCount: jest.fn(),
    getCommunityStats: jest.fn()
  }
}));

describe('Card Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    memoryDb.nextId = 1;
  });

  describe('create', () => {
    it('should create a card successfully', async () => {
      const cardData = {
        name: 'Test Card',
        stateData: { test: 'data' },
        creatorId: 'user123',
        isPublic: true,
        tags: ['test', 'sample']
      };

      // The store assigns the id; the model passes everything else through.
      const expectedCard = {
        name: 'Test Card',
        info: null,
        set_id: null,
        state_data: { test: 'data' },
        creator_id: 'user123',
        is_public: true,
        collection_count: 0,
        tags: ['test', 'sample'],
        created_at: expect.any(String),
        updated_at: expect.any(String)
      };

      memoryDb.createCard.mockReturnValue({ id: 'card_1', ...expectedCard });

      const result = await Card.create(cardData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 'card_1', ...expectedCard });
      expect(memoryDb.createCard).toHaveBeenCalledWith(expectedCard);
    });

    it('should create a card with default values', async () => {
      const cardData = { stateData: { test: 'data' } };

      const expectedCard = {
        id: 'card_1',
        name: 'Unnamed Card',
        info: null,
        set_id: null,
        state_data: { test: 'data' },
        creator_id: 'anonymous',
        is_public: true,
        collection_count: 0,
        tags: [],
        created_at: expect.any(String),
        updated_at: expect.any(String)
      };

      memoryDb.createCard.mockReturnValue(expectedCard);

      const result = await Card.create(cardData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedCard);
    });

    it('should handle creation errors', async () => {
      const cardData = { stateData: { test: 'data' } };
      const error = new Error('Database error');
      memoryDb.createCard.mockImplementation(() => { throw error; });

      const result = await Card.create(cardData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('findAll', () => {
    it('should return all cards successfully', async () => {
      const mockCards = [
        { id: 'card_1', name: 'Card 1' },
        { id: 'card_2', name: 'Card 2' }
      ];

      memoryDb.getAllCards.mockReturnValue(mockCards);

      const result = await Card.findAll();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCards);
      expect(memoryDb.getAllCards).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      memoryDb.getAllCards.mockImplementation(() => { throw error; });

      const result = await Card.findAll();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('findById', () => {
    it('should return a card by ID successfully', async () => {
      const mockCard = { id: 'card_1', name: 'Card 1' };
      memoryDb.getCardById.mockReturnValue(mockCard);

      const result = await Card.findById('card_1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCard);
      expect(memoryDb.getCardById).toHaveBeenCalledWith('card_1');
    });

    it('should return error when card not found', async () => {
      memoryDb.getCardById.mockReturnValue(null);

      const result = await Card.findById('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Card not found');
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      memoryDb.getCardById.mockImplementation(() => { throw error; });

      const result = await Card.findById('card_1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('update', () => {
    it('should update a card successfully', async () => {
      const existingCard = { id: 'card_1', name: 'Old Name' };
      const updateData = { name: 'New Name' };
      const updatedCard = { ...existingCard, ...updateData, updated_at: expect.any(String) };

      memoryDb.getCardById.mockReturnValue(existingCard);
      memoryDb.updateCard.mockReturnValue(updatedCard);

      const result = await Card.update('card_1', updateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedCard);
      expect(memoryDb.updateCard).toHaveBeenCalledWith('card_1', updatedCard);
    });

    it('should return error when card not found', async () => {
      memoryDb.getCardById.mockReturnValue(null);

      const result = await Card.update('nonexistent', { name: 'New Name' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Card not found');
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      memoryDb.getCardById.mockReturnValue({ id: 'card_1' });
      memoryDb.updateCard.mockImplementation(() => { throw error; });

      const result = await Card.update('card_1', { name: 'New Name' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('delete', () => {
    it('should delete a card successfully', async () => {
      const existingCard = { id: 'card_1', name: 'Card 1' };
      memoryDb.getCardById.mockReturnValue(existingCard);
      memoryDb.deleteCard.mockReturnValue(existingCard);

      const result = await Card.delete('card_1');

      expect(result.success).toBe(true);
      expect(result.data.message).toBe('Card deleted successfully');
      expect(memoryDb.deleteCard).toHaveBeenCalledWith('card_1');
    });

    it('should return error when card not found', async () => {
      memoryDb.getCardById.mockReturnValue(null);

      const result = await Card.delete('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Card not found');
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      memoryDb.getCardById.mockReturnValue({ id: 'card_1' });
      memoryDb.deleteCard.mockImplementation(() => { throw error; });

      const result = await Card.delete('card_1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('searchByState', () => {
    it('should search cards successfully', async () => {
      const mockCards = [{ id: 'card_1', name: 'Card 1' }];
      memoryDb.searchCards.mockReturnValue(mockCards);

      const result = await Card.searchByState('creator_id', 'user123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCards);
      expect(memoryDb.searchCards).toHaveBeenCalledWith('creator_id', 'user123');
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      memoryDb.searchCards.mockImplementation(() => { throw error; });

      const result = await Card.searchByState('creator_id', 'user123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('findByDateRange', () => {
    it('should find cards by date range successfully', async () => {
      const mockCards = [
        { id: 'card_1', created_at: '2025-01-01T00:00:00.000Z' },
        { id: 'card_2', created_at: '2025-01-02T00:00:00.000Z' }
      ];

      memoryDb.getAllCards.mockReturnValue(mockCards);

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-03');

      const result = await Card.findByDateRange(startDate, endDate);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      memoryDb.getAllCards.mockImplementation(() => { throw error; });

      const result = await Card.findByDateRange(new Date(), new Date());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('getCommunityCards', () => {
    it('should return community cards successfully', async () => {
      const mockCards = [
        { id: 'card_1', is_public: true },
        { id: 'card_2', is_public: false },
        { id: 'card_3', is_public: true }
      ];

      memoryDb.getAllCards.mockReturnValue(mockCards);

      const result = await Card.getCommunityCards();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data.every(card => card.is_public)).toBe(true);
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      memoryDb.getAllCards.mockImplementation(() => { throw error; });

      const result = await Card.getCommunityCards();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('getRandomCommunityCard', () => {
    it('should return a random community card successfully', async () => {
      const mockCards = [
        { id: 'card_1', is_public: true },
        { id: 'card_2', is_public: true }
      ];

      // Mock the getCommunityCards method
      jest.spyOn(Card, 'getCommunityCards').mockResolvedValue({
        success: true,
        data: mockCards
      });

      const result = await Card.getRandomCommunityCard();

      expect(result.success).toBe(true);
      expect(mockCards).toContain(result.data);
    });

    it('should return error when no community cards available', async () => {
      jest.spyOn(Card, 'getCommunityCards').mockResolvedValue({
        success: true,
        data: []
      });

      const result = await Card.getRandomCommunityCard();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No community cards available');
    });

    it('should handle errors', async () => {
      jest.spyOn(Card, 'getCommunityCards').mockResolvedValue({
        success: false,
        error: 'Database error'
      });

      const result = await Card.getRandomCommunityCard();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No community cards available');
    });
  });

  describe('incrementCollectionCount', () => {
    it('should increment collection count successfully', async () => {
      const existingCard = { id: 'card_1', collection_count: 5 };
      const updatedCard = { ...existingCard, collection_count: 6, updated_at: expect.any(String) };

      memoryDb.getCardById.mockReturnValue(existingCard);
      memoryDb.updateCard.mockReturnValue(updatedCard);

      const result = await Card.incrementCollectionCount('card_1');

      expect(result.success).toBe(true);
      expect(result.data.collection_count).toBe(6);
    });

    it('should return error when card not found', async () => {
      memoryDb.getCardById.mockReturnValue(null);

      const result = await Card.incrementCollectionCount('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Card not found');
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      memoryDb.getCardById.mockReturnValue({ id: 'card_1' });
      memoryDb.updateCard.mockImplementation(() => { throw error; });

      const result = await Card.incrementCollectionCount('card_1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('getCommunityStats', () => {
    it('should return community statistics successfully', async () => {
      const mockCards = [
        { id: 'card_1', is_public: true, creator_id: 'user1', created_at: new Date().toISOString(), collection_count: 5 },
        { id: 'card_2', is_public: true, creator_id: 'user2', created_at: new Date().toISOString(), collection_count: 3 },
        { id: 'card_3', is_public: false, creator_id: 'user3', created_at: new Date().toISOString(), collection_count: 1 }
      ];

      memoryDb.getAllCards.mockReturnValue(mockCards);

      const result = await Card.getCommunityStats();

      expect(result.success).toBe(true);
      expect(result.data.totalCards).toBe(2);
      expect(result.data.activeCreators).toBe(2);
      expect(result.data.totalCollections).toBe(8);
    });

    it('should handle errors', async () => {
      const error = new Error('Database error');
      memoryDb.getAllCards.mockImplementation(() => { throw error; });

      const result = await Card.getCommunityStats();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });
}); 