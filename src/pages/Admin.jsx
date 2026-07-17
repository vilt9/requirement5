// The admin review surface at /admin. Client-side it is gated by user.is_admin
// (derived server-side from the account email); every /api/admin call is also
// enforced server-side, so this page is a convenience, not the security boundary.
//
// Two jobs: work the queue of flagged cards (restore a false alarm, or remove a
// real problem for good), and manage user accounts (ban / unban).
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Page, Panel, PillButton, Dim, Divider, TagList, ErrorText } from '../components/UI';
import Card from '../components/Card/Card';
import { poolCardToCardData } from '../utils/poolCard';
import { fmtT26 } from '../utils/economyRandom';

export default function Admin() {
  const { user, loading } = useAuth();
  const isAdmin = !!user?.is_admin;

  const [overview, setOverview] = useState(null);
  const [flagged, setFlagged] = useState([]);
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [o, f, u] = await Promise.all([
        api('/api/admin/overview'),
        api('/api/admin/flagged'),
        api('/api/admin/users')
      ]);
      setOverview(o);
      setFlagged(f.items || []);
      setUsers(u.users || []);
      setErr(null);
    } catch (e) {
      setErr(e?.message || 'Could not load admin data.');
    }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const cardAction = async (id, action) => {
    setBusyId(id);
    try { await api(`/api/admin/cards/${id}/${action}`, { method: 'POST' }); await load(); }
    catch (e) { setErr(e?.message || 'Action failed.'); }
    setBusyId(null);
  };
  const userAction = async (id, action) => {
    setBusyId(id);
    try { await api(`/api/admin/users/${id}/${action}`, { method: 'POST' }); await load(); }
    catch (e) { setErr(e?.message || 'Action failed.'); }
    setBusyId(null);
  };

  if (loading) return <Page><Panel><Dim>Loading…</Dim></Panel></Page>;
  if (!isAdmin) {
    return (
      <Page>
        <Panel>
          <h2>Admins only</h2>
          <Dim>You don’t have access to this page.</Dim>
          <div style={{ marginTop: 10 }}><Link to="/">← Back to Discover</Link></div>
        </Panel>
      </Page>
    );
  }

  return (
    <Page>
      <Panel>
        <h2>Admin</h2>
        {overview && (
          <Dim>
            {overview.flaggedCards} flagged · {overview.openReports} open reports ·{' '}
            {overview.users} users · {overview.bannedUsers} banned
          </Dim>
        )}
        {err && <ErrorText>{err}</ErrorText>}
      </Panel>

      <Panel>
        <h3>Flagged cards ({flagged.length})</h3>
        <Divider />
        {flagged.length === 0 && <Dim>Nothing in the queue.</Dim>}
        {flagged.map(item => (
          <Review key={item.card.id}>
            <div className="preview">
              {poolCardToCardData(item.card)
                ? <Card cardData={poolCardToCardData(item.card)} />
                : <Dim>No preview</Dim>}
            </div>
            <div className="meta">
              <div className="name">{item.card.name || 'Untitled card'}</div>
              <Dim className="id">id {item.card.id}</Dim>
              <div>Creator: {item.card.creator_username || item.card.creator_id}</div>
              {item.card.tags?.length > 0 && <TagList tags={item.card.tags} />}
              <div className="reasons">
                {item.reports.map(r => (
                  <div key={r.id} className="reason">
                    <b>{r.reason}</b>{r.detail ? ` — ${r.detail}` : ''}
                    <Dim> · {new Date(r.created_at).toISOString().slice(0, 10)}</Dim>
                  </div>
                ))}
              </div>
              <div className="buttons">
                <PillButton $secondary disabled={busyId === item.card.id} onClick={() => cardAction(item.card.id, 'restore')}>
                  Restore to pool
                </PillButton>
                <PillButton disabled={busyId === item.card.id} onClick={() => cardAction(item.card.id, 'remove')}>
                  Remove for good
                </PillButton>
              </div>
            </div>
          </Review>
        ))}
      </Panel>

      <Panel>
        <h3>Users ({users.length})</h3>
        <Divider />
        {users.map(u => (
          <UserRow key={u.id} $banned={u.banned}>
            <span className="who">
              {u.username}
              {u.is_admin && <Dim> · admin</Dim>}
              {u.banned && <span className="ban"> · banned</span>}
            </span>
            <span className="email"><Dim>{u.email}</Dim></span>
            <span className="counts"><Dim>{u.published_count} pub · {u.saved_count} saved · {fmtT26(u.balance)} /t26</Dim></span>
            <span className="act">
              {!u.is_admin && (u.banned
                ? <PillButton $secondary disabled={busyId === u.id} onClick={() => userAction(u.id, 'unban')}>Unban</PillButton>
                : <PillButton $secondary disabled={busyId === u.id} onClick={() => userAction(u.id, 'ban')}>Ban</PillButton>)}
            </span>
          </UserRow>
        ))}
      </Panel>
    </Page>
  );
}

const Review = styled.div`
  display: flex;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--panel-border);
  text-align: left;

  .preview {
    width: 150px;
    height: 210px;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: 8px;
  }
  /* Card renders at its own size; shrink it to a thumbnail for the queue. */
  .preview > * { transform: scale(0.42); transform-origin: top left; }

  .meta { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .name { font-size: 14px; color: var(--gold-bright); }
  .id { font-size: 10px; overflow-wrap: anywhere; }
  .reasons { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
  .reason b { color: #ff8a8a; text-transform: capitalize; }
  .buttons { display: flex; gap: 8px; margin-top: 6px; }
`;

const UserRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid var(--panel-border);
  text-align: left;
  font-size: 12px;

  .who { width: 16ch; flex-shrink: 0; color: ${p => (p.$banned ? '#ff8a8a' : 'var(--amber-text)')}; overflow-wrap: anywhere; }
  .who .ban { color: #ff8a8a; }
  .email { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .counts { flex-shrink: 0; }
  .act { flex-shrink: 0; margin-left: auto; }

  @media (max-width: 640px) {
    flex-wrap: wrap;
    .email { flex: 0 0 100%; }
  }
`;
