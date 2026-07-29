import { memoryDb } from '../config/database.js';
import {
  buildCollectionPosition,
  GLOBAL_POSITION_LIMIT,
  SOURCE_POSITION_LIMIT
} from '../services/collectionPosition.js';

const makeUser = (username) => memoryDb.createUser({
  id: `user-${username}`,
  username,
  email: `${username}@earth.test`
});

const makeCard = ({
  id,
  creatorId,
  rarity,
  setId = null,
  isPublic = true
}) => memoryDb.createCard({
  id,
  name: `Card ${id}`,
  creator_id: creatorId,
  rarity_score: rarity,
  set_id: setId,
  is_public: isPublic,
  state_data: { customCard: { rarity, backgroundColor: '#121212' } }
});

beforeEach(() => {
  memoryDb.clearDatabase();
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('builds an 18-card rarity neighbourhood and reveals only owned designs', () => {
  const creator = makeUser('maker');
  const collector = makeUser('collector');
  const cards = Array.from({ length: 30 }, (_, index) => makeCard({
    id: `card-${String(index + 1).padStart(2, '0')}`,
    creatorId: creator.id,
    rarity: 1 - index / 100
  }));
  const current = cards[14]; // rank 15
  memoryDb.createSave({ user_id: collector.id, card_id: cards[10].id });
  memoryDb.createSave({ user_id: collector.id, card_id: current.id });
  memoryDb.createSave({ user_id: collector.id, card_id: cards[18].id });

  const result = buildCollectionPosition(current, collector.id);

  expect(result.global.rank).toBe(15);
  expect(result.global.total).toBe(30);
  expect(result.global.cards).toHaveLength(GLOBAL_POSITION_LIMIT);
  expect(result.global.cards.filter(slot => slot.owned)).toHaveLength(3);
  expect(result.global.cards.find(slot => slot.current)).toMatchObject({
    position: 15,
    owned: true,
    card: { id: current.id }
  });
  expect(result.global.cards.find(slot => !slot.owned).card).toBeUndefined();
});

test('set progress is counted across the full set while the response stays bounded', () => {
  const creator = makeUser('signals');
  const collector = makeUser('collector');
  const setId = 'signals_ghost-signals';
  memoryDb.upsertSet({
    id: setId,
    owner_id: creator.id,
    label: 'Ghost Signals',
    info: null
  });
  const cards = Array.from({ length: 12 }, (_, index) => makeCard({
    id: `signal-${String(index + 1).padStart(2, '0')}`,
    creatorId: creator.id,
    rarity: .95 - index / 100,
    setId
  }));
  const current = cards[5];
  memoryDb.createSave({ user_id: collector.id, card_id: cards[1].id });
  memoryDb.createSave({ user_id: collector.id, card_id: current.id });
  memoryDb.createSave({ user_id: collector.id, card_id: cards[10].id });

  const result = buildCollectionPosition(current, collector.id);

  expect(result.source).toMatchObject({
    type: 'set',
    id: setId,
    label: 'Ghost Signals',
    total: 12,
    collected: 3
  });
  expect(result.source.cards).toHaveLength(SOURCE_POSITION_LIMIT);
  expect(result.source.cards.some(slot => slot.current)).toBe(true);
});

test('a card without a set falls back to its creator; cloud cards have no source row', () => {
  const creator = makeUser('marea');
  const collector = makeUser('collector');
  const first = makeCard({ id: 'marea-1', creatorId: creator.id, rarity: .7 });
  const current = makeCard({ id: 'marea-2', creatorId: creator.id, rarity: .6 });
  memoryDb.createSave({ user_id: collector.id, card_id: current.id });

  expect(buildCollectionPosition(current, collector.id).source).toMatchObject({
    type: 'creator',
    label: 'marea',
    total: 2,
    collected: 1
  });

  const cloud = makeCard({
    id: 'cloud-1',
    creatorId: 'cloud',
    rarity: .8,
    isPublic: false
  });
  memoryDb.createSave({ user_id: collector.id, card_id: cloud.id });
  expect(buildCollectionPosition(cloud, collector.id).source).toBeNull();
  expect(first.id).toBe('marea-1');
});

test('uses fixed snapshots and never performs a card lookup inside the result loops', () => {
  const creator = makeUser('maker');
  const collector = makeUser('collector');
  const cards = Array.from({ length: 24 }, (_, index) => makeCard({
    id: `bounded-${String(index + 1).padStart(2, '0')}`,
    creatorId: creator.id,
    rarity: .99 - index / 100
  }));
  const current = cards[12];
  memoryDb.createSave({ user_id: collector.id, card_id: current.id });

  const allCards = jest.spyOn(memoryDb, 'getAllCards');
  const saves = jest.spyOn(memoryDb, 'getSavesByUser');
  const cardLookup = jest.spyOn(memoryDb, 'getCardById');
  const enrichment = jest.spyOn(memoryDb, 'withCreatorAndSet');
  const creatorLookup = jest.spyOn(memoryDb, 'getUserById');

  buildCollectionPosition(current, collector.id);

  expect(allCards).toHaveBeenCalledTimes(1);
  expect(saves).toHaveBeenCalledTimes(1);
  expect(creatorLookup).toHaveBeenCalledTimes(1);
  expect(cardLookup).not.toHaveBeenCalled();
  expect(enrichment).not.toHaveBeenCalled();
});
