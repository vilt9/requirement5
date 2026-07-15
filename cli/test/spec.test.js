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

test('name defaults when omitted', () => {
  assert.equal(buildPublishPayload({}, '/tmp').name, 'Untitled card');
});

test('a non-object spec is rejected', () => {
  assert.throws(() => buildPublishPayload('nope', '/tmp'), SpecError);
});

test('unknown top-level keys are rejected with a helpful message', () => {
  assert.throws(() => buildPublishPayload({ foo: 1 }, '/tmp'), /unknown top-level key/);
});

test('a bad tier is rejected', () => {
  assert.throws(() => buildPublishPayload({ tier: 'legendary' }, '/tmp'), /tier/);
});

test('non-string tags are rejected', () => {
  assert.throws(() => buildPublishPayload({ tags: [1, 2] }, '/tmp'), /tags/);
});

test('an invalid CSS blend mode is rejected', () => {
  assert.throws(
    () => buildPublishPayload({ card: { effectParams: { customHoloBlendMode: 'nope' } } }, '/tmp'),
    /blend mode/
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
