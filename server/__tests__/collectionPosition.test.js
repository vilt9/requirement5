import { memoryDb } from '../config/database.js';
import {
  buildCollectionGrid,
  buildCollectionGridSource,
  buildCollectionPosition,
  GRID_MAX_PAGE_SIZE,
  GRID_PAGE_SIZE,
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

test('expands owned creators into collected and undiscovered set rows', () => {
  const signals = makeUser('signals');
  const anotherCreator = makeUser('elsewhere');
  const collector = makeUser('collector');
  memoryDb.upsertSet({
    id: 'signals_ghost-signals',
    owner_id: signals.id,
    label: 'Ghost Signals',
    info: null
  });
  memoryDb.upsertSet({
    id: 'signals_after-images',
    owner_id: signals.id,
    label: 'After Images',
    info: null
  });

  const owned = makeCard({
    id: 'ghost-owned',
    creatorId: signals.id,
    rarity: .91,
    setId: 'signals_ghost-signals'
  });
  makeCard({
    id: 'ghost-empty',
    creatorId: signals.id,
    rarity: .72,
    setId: 'signals_ghost-signals'
  });
  makeCard({
    id: 'after-empty',
    creatorId: signals.id,
    rarity: .63,
    setId: 'signals_after-images'
  });
  makeCard({
    id: 'unrelated',
    creatorId: anotherCreator.id,
    rarity: .82
  });
  memoryDb.createSave({ user_id: collector.id, card_id: owned.id });

  const result = buildCollectionGrid(collector.id);

  expect(result.global).toMatchObject({ total: 4, collected: 1 });
  expect(result.global.cards.find(slot => slot.owned)).toMatchObject({
    card: { id: owned.id }
  });
  expect(result.global.cards.filter(slot => !slot.owned).every(slot => !slot.card)).toBe(true);
  expect(result.creators).toHaveLength(1);
  expect(result.creators[0]).toMatchObject({
    label: 'signals',
    total: 3,
    collected: 1
  });
  expect(result.creators[0].sources).toEqual(expect.arrayContaining([
    expect.objectContaining({
      label: 'Ghost Signals',
      total: 2,
      collected: 1
    }),
    expect.objectContaining({
      label: 'After Images',
      total: 1,
      collected: 0
    })
  ]));
  expect(result.creators[0].sources.every(source => source.cards === undefined)).toBe(true);

  const source = buildCollectionGridSource(collector.id, {
    type: 'set',
    id: 'signals_ghost-signals'
  });
  expect(source.cards).toHaveLength(2);
  expect(source.cards.find(slot => slot.owned)).toMatchObject({
    card: { id: owned.id }
  });
});

test('logged-out grid keeps every card face empty', () => {
  const creator = makeUser('maker');
  makeCard({ id: 'blank-1', creatorId: creator.id, rarity: .9 });
  makeCard({ id: 'blank-2', creatorId: creator.id, rarity: .4 });

  const result = buildCollectionGrid();

  expect(result.global).toMatchObject({ total: 2, collected: 0 });
  expect(result.global.cards.every(slot => !slot.owned && !slot.card)).toBe(true);
  expect(result.creators).toEqual([]);
});

test('full grid uses one snapshot per collection and no per-card lookups', () => {
  const creator = makeUser('maker');
  const collector = makeUser('collector');
  const card = makeCard({ id: 'owned-grid-card', creatorId: creator.id, rarity: .7 });
  memoryDb.createSave({ user_id: collector.id, card_id: card.id });

  const allCards = jest.spyOn(memoryDb, 'getAllCards');
  const saves = jest.spyOn(memoryDb, 'getSavesByUser');
  const users = jest.spyOn(memoryDb, 'getAllUsers');
  const sets = jest.spyOn(memoryDb, 'getAllSets');
  const cardLookup = jest.spyOn(memoryDb, 'getCardById');
  const setLookup = jest.spyOn(memoryDb, 'getSetById');
  const creatorLookup = jest.spyOn(memoryDb, 'getUserById');

  buildCollectionGrid(collector.id);

  expect(allCards).toHaveBeenCalledTimes(1);
  expect(saves).toHaveBeenCalledTimes(1);
  expect(users).toHaveBeenCalledTimes(1);
  expect(sets).toHaveBeenCalledTimes(1);
  expect(cardLookup).not.toHaveBeenCalled();
  expect(setLookup).not.toHaveBeenCalled();
  expect(creatorLookup).not.toHaveBeenCalled();
});

test('pages large grids and enforces the response cap', () => {
  const creator = makeUser('scale');
  Array.from({ length: 450 }, (_, index) => makeCard({
    id: `scale-${String(index + 1).padStart(3, '0')}`,
    creatorId: creator.id,
    rarity: 1 - index / 1000
  }));

  const first = buildCollectionGrid(null, { limit: GRID_PAGE_SIZE });
  expect(first.global.cards).toHaveLength(GRID_PAGE_SIZE);
  expect(first.global.nextCursor).toBe(GRID_PAGE_SIZE);

  const second = buildCollectionGrid(null, {
    cursor: first.global.nextCursor,
    limit: 10_000
  });
  expect(second.global.cards).toHaveLength(GRID_MAX_PAGE_SIZE);
  expect(second.global.cards[0].position).toBe(GRID_PAGE_SIZE + 1);
  expect(second.global.nextCursor).toBeNull();
  expect(second.creators).toEqual([]);
});

test('rarity cache invalidates when card data changes', () => {
  const creator = makeUser('cache');
  makeCard({ id: 'cache-low', creatorId: creator.id, rarity: .2 });
  makeCard({ id: 'cache-high', creatorId: creator.id, rarity: .8 });

  const cards = jest.spyOn(memoryDb, 'getAllCards');
  buildCollectionGrid();
  buildCollectionGrid(null, { cursor: 1 });
  expect(cards).toHaveBeenCalledTimes(1);

  memoryDb.updateCard('cache-low', { rarity_score: .95 });
  const refreshed = buildCollectionGrid();
  expect(cards).toHaveBeenCalledTimes(2);
  expect(refreshed.global.cards[0].position).toBe(1);
  expect(refreshed.global.cards[0].rarity).toBe(.95);
});
