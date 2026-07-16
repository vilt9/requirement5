import { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Panel, PillButton, TextInput, TextArea, Select, Divider, Dim, ErrorText, TagInput } from './UI';
import { formatTag, parseTags } from '../utils/tags';

// Publish the card being customized into the pool. The rarity (and so the tier)
// is NOT chosen here — it's the value the server assigned at the Start stage.
//
// A card may join a named SET (a creator's own grouping of their published
// cards — not to be confused with the Design stage's base templates, which are
// device-local looks). The server namespaces the set name by username and owns
// the canonical form, so this panel only ever sends the typed label.
const PublishPanel = ({ customCard, draftId, onPublished, onTagsChange }) => {
  const { user, setBalance } = useAuth();
  const [name, setName] = useState('');
  const [cardInfo, setCardInfo] = useState('');
  const [setLabel, setSetLabel] = useState('');
  const [setBlurb, setSetBlurb] = useState('');
  const [mySets, setMySets] = useState([]);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [published, setPublished] = useState(null); // the created card record
  const [error, setError] = useState(null);

  // The sets this creator already has, for the picker.
  useEffect(() => {
    if (!user) return;
    let live = true;
    api('/api/cards/sets/mine')
      .then(data => { if (live) setMySets(data.sets || []); })
      .catch(() => {}); // a missing picker shouldn't block publishing
    return () => { live = false; };
  }, [user]);

  // Every tag already in the pool, with its card count, so you can reuse a live
  // tag instead of typing a near-duplicate from memory. Public, no auth needed.
  useEffect(() => {
    let live = true;
    api('/api/cards/tags')
      .then(data => { if (live) setTagSuggestions(data.tags || []); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const tags = useMemo(() => (Array.isArray(customCard?.tags) ? customCard.tags : []), [customCard]);

  // Clicking a suggestion toggles it onto (or off) the card. parseTags keeps the
  // result normalized and deduped, matching what the free-text box produces.
  const toggleTag = (tag) => {
    if (!onTagsChange) return;
    onTagsChange(tags.includes(tag) ? tags.filter(t => t !== tag) : parseTags([...tags, tag]));
  };

  // Mirror the server's normalizer so the preview matches what gets stored.
  // The server remains the authority — this is a preview, not validation.
  const previewSetName = useMemo(() => {
    const label = setLabel
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9.-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '');
    return label ? `${String(user?.username || '').toLowerCase()}_${label}` : '';
  }, [setLabel, user]);

  // Picking a set you already have carries its info across, so you don't retype
  // it. Typing a brand-new name leaves the info box alone.
  const chooseExistingSet = (storedName) => {
    const existing = mySets.find(s => s.name === storedName);
    if (!existing) return;
    setSetLabel(existing.label);
    setSetBlurb(existing.info || '');
  };

  const trimmedName = name.trim();
  const canPublish = !!customCard && !!trimmedName && !busy;

  const publish = async () => {
    if (!customCard || !trimmedName) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      // The create fee was paid at Start (confirm-start); this applies the
      // finished design to the private draft and releases it into the pool.
      const result = await api('/api/cards/create/publish', {
        method: 'POST',
        body: {
          id: draftId || undefined,
          name: trimmedName,
          info: cardInfo.trim() || null,
          // Only mention sets when one was typed — an untouched field must not
          // detach the draft from a set it already has.
          ...(setLabel.trim() ? { setName: setLabel, setInfo: setBlurb.trim() || undefined } : {}),
          tags: customCard.tags || [],
          stateData: {
            customCard,
            timestamp: new Date().toISOString(),
            version: '1.0'
          }
        }
      });
      setBalance(result.balance);
      setPublished(result.card);
      setMessage(`Published to the pool — rarity ${Number(result.rarityScore).toFixed(3)} (${result.card.tier}).`);
      if (onPublished) onPublished(result);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  if (!user) {
    return (
      <Panel>
        Publish to the pool
        <Divider />
        <Dim>Publishing a card needs an account. <Link to="/account">Sign up or log in</Link> to
        publish — your design is saved right here and will be waiting when you're back.</Dim>
      </Panel>
    );
  }

  return (
    <Panel>
      Publish to the pool
      <Divider />
      <Stack>
        <Field>
          <label htmlFor="publish-name">Card name</label>
          <TextInput
            id="publish-name"
            placeholder="required"
            value={name}
            maxLength={80}
            onChange={e => setName(e.target.value)}
          />
        </Field>

        <Field>
          <label htmlFor="publish-info">Card info <Dim>optional</Dim></label>
          <TextArea
            id="publish-info"
            placeholder="What is this card? (optional)"
            value={cardInfo}
            maxLength={280}
            onChange={e => setCardInfo(e.target.value)}
          />
        </Field>

        <Field>
          <label htmlFor="publish-set">Set name <Dim>optional</Dim></label>
          {mySets.length > 0 && (
            <Select
              aria-label="Add to one of your existing sets"
              value={mySets.some(s => s.label === setLabel) ? previewSetName : ''}
              onChange={e => (e.target.value ? chooseExistingSet(e.target.value) : setSetLabel(''))}
            >
              <option value="">— new set, or pick one of yours —</option>
              {mySets.map(s => (
                <option key={s.name} value={s.name}>
                  {s.label} ({s.cardCount} card{s.cardCount === 1 ? '' : 's'})
                </option>
              ))}
            </Select>
          )}
          <TextInput
            id="publish-set"
            placeholder="e.g. deep sea (optional)"
            value={setLabel}
            maxLength={48}
            onChange={e => setSetLabel(e.target.value)}
          />
          {previewSetName && (
            <Dim className="set-preview">
              Saved as <b style={{ color: 'var(--gold-bright)' }}>{previewSetName}</b>
            </Dim>
          )}
        </Field>

        {setLabel.trim() && (
          <Field>
            <label htmlFor="publish-set-info">Set info <Dim>optional</Dim></label>
            <TextArea
              id="publish-set-info"
              placeholder="What ties this set together? (optional)"
              value={setBlurb}
              maxLength={280}
              onChange={e => setSetBlurb(e.target.value)}
            />
          </Field>
        )}

        {onTagsChange && (
          <Field>
            <label htmlFor="publish-tags">Tags <Dim>optional</Dim></label>
            <Dim>Saved with the card; shown across the pool and your collection. Click one below to reuse it, or type a new one.</Dim>
            <TagInput value={tags} onChange={onTagsChange} />
            {tagSuggestions.length > 0 && (
              <SuggestWrap>
                {tagSuggestions.map(s => (
                  <SuggestChip
                    key={s.tag}
                    type="button"
                    $active={tags.includes(s.tag)}
                    onClick={() => toggleTag(s.tag)}
                  >
                    {formatTag(s.tag)}<span className="n">{s.count}</span>
                  </SuggestChip>
                ))}
              </SuggestWrap>
            )}
          </Field>
        )}
        {error && <ErrorText>{error}</ErrorText>}
        {message && <div className="publish-success">{message}</div>}
        {published && (
          <Dim className="publish-links">
            <Link to={`/card/${published.id}`}>View your card</Link>
            {' · '}
            <Link to="/collection">all your creations</Link>
          </Dim>
        )}
        <div>
          <PillButton onClick={publish} disabled={!canPublish}>
            {busy ? 'Publishing…' : 'Publish'}
          </PillButton>
        </div>
      </Stack>
    </Panel>
  );
};

const Stack = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
);

// A labelled field: the label sits above its input, and the set picker sits
// above the free-text box that mirrors it.
const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  label {
    color: var(--amber-text);
    font-size: 12px;
  }

  .set-preview {
    font-size: 11px;
  }
`;

// The pool's existing tags, as toggle chips. An active chip (already on the card)
// reads gold-filled; the count sits in a dimmer pill on the right.
const SuggestWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 2px;
`;

const SuggestChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 999px;
  cursor: pointer;
  color: ${p => (p.$active ? 'var(--ink)' : 'var(--amber-text)')};
  background: ${p => (p.$active ? 'var(--gold)' : 'var(--panel)')};
  border: 1px solid ${p => (p.$active ? 'var(--gold)' : 'var(--panel-border)')};

  &:hover { border-color: var(--gold); }

  .n {
    font-size: 10px;
    opacity: 0.7;
    ${p => (p.$active ? '' : 'color: var(--amber-dim);')}
  }
`;

export default PublishPanel;
