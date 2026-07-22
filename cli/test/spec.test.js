// Spec → publish-payload expansion and validation. Image refs use http URLs so
// the tests never touch the filesystem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublishPayload, TEMPLATES, SpecError } from '../lib/spec.js';

const IMG = 'https://example.com/art.png';

test('a minimal spec expands into a coherent payload', () => {
  const p = buildPublishPayload({ name: 'Hi', image: IMG }, '/tmp');
  assert.equal(p.name, 'Hi');
  assert.ok(p.stateData.customCard, 'customCard present');
  assert.equal(p.stateData.customCard.imagePath, 'custom_image');
  assert.equal(p.stateData.customCard.customImageUrl, IMG);
});

test('name is required — a published card must have one', () => {
  assert.throws(() => buildPublishPayload({ image: IMG }, '/tmp'), /"name" is required/);
  assert.throws(() => buildPublishPayload({ name: '   ', image: IMG }, '/tmp'), /"name" is required/);
});

test('card info and set fields survive into the payload', () => {
  const p = buildPublishPayload(
    { name: 'Hi', info: 'a blurb', setName: 'Deep Sea', setInfo: 'from the trench', image: IMG },
    '/tmp'
  );
  assert.equal(p.info, 'a blurb');
  // The typed label goes over the wire as-is — the SERVER namespaces it.
  assert.equal(p.setName, 'Deep Sea');
  assert.equal(p.setInfo, 'from the trench');
});

test('omitted metadata keys stay absent, so they never clear server-side values', () => {
  const p = buildPublishPayload({ name: 'Hi', image: IMG }, '/tmp');
  assert.ok(!('info' in p), 'info absent');
  assert.ok(!('setName' in p), 'setName absent');
  assert.ok(!('setInfo' in p), 'setInfo absent');
});

test('setInfo without setName is rejected', () => {
  assert.throws(() => buildPublishPayload({ name: 'Hi', setInfo: 'orphan', image: IMG }, '/tmp'), /needs a "setName"/);
});

test('over-long info and setName are rejected', () => {
  assert.throws(() => buildPublishPayload({ name: 'Hi', info: 'x'.repeat(281), image: IMG }, '/tmp'), /"info" must be 280/);
  assert.throws(() => buildPublishPayload({ name: 'Hi', setName: 'x'.repeat(49), image: IMG }, '/tmp'), /"setName" must be 48/);
});

test('a non-object spec is rejected', () => {
  assert.throws(() => buildPublishPayload('nope', '/tmp'), SpecError);
});

test('unknown top-level keys are rejected with a helpful message', () => {
  assert.throws(() => buildPublishPayload({ name: 'Hi', foo: 1 }, '/tmp'), /unknown top-level key/);
});

test('a bad tier is rejected', () => {
  assert.throws(() => buildPublishPayload({ name: 'Hi', tier: 'legendary' }, '/tmp'), /tier/);
});

test('non-string tags are rejected', () => {
  assert.throws(() => buildPublishPayload({ name: 'Hi', tags: [1, 2] }, '/tmp'), /tags/);
});

test('an invalid CSS blend mode is rejected', () => {
  assert.throws(
    () => buildPublishPayload({ name: 'Hi', card: { effectParams: { customHoloBlendMode: 'nope' } } }, '/tmp'),
    /blend mode/
  );
});

test('holo reveal choreography survives into the card payload', () => {
  const p = buildPublishPayload({
    name: 'Hi',
    card: {
      effectParams: {
        holoRevealMode: 'wipe',
        holoRevealDuration: 0.8,
        holoRevealEasing: 'elastic',
        holoRevealDirection: 'up',
        holoRevealSoftness: 24
      }
    }
  }, '/tmp');
  const reveal = p.stateData.customCard.effectParams;
  assert.deepEqual({
    holoRevealMode: reveal.holoRevealMode,
    holoRevealDuration: reveal.holoRevealDuration,
    holoRevealEasing: reveal.holoRevealEasing,
    holoRevealDirection: reveal.holoRevealDirection,
    holoRevealSoftness: reveal.holoRevealSoftness
  }, {
    holoRevealMode: 'wipe',
    holoRevealDuration: 0.8,
    holoRevealEasing: 'elastic',
    holoRevealDirection: 'up',
    holoRevealSoftness: 24
  });
});

test('invalid holo reveal choreography is rejected', () => {
  assert.throws(
    () => buildPublishPayload({ name: 'Hi', card: { effectParams: { holoRevealMode: 'explode' } } }, '/tmp'),
    /holoRevealMode/
  );
  assert.throws(
    () => buildPublishPayload({ name: 'Hi', card: { effectParams: { holoRevealDuration: 8 } } }, '/tmp'),
    /holoRevealDuration/
  );
});

test('both shipped templates are valid specs', () => {
  for (const [name, tpl] of Object.entries(TEMPLATES)) {
    const spec = { ...tpl, image: IMG };
    if (spec.holoImage) spec.holoImage = IMG;
    const p = buildPublishPayload(spec, '/tmp');
    assert.ok(p.stateData.customCard, `${name} template builds`);
  }
});
