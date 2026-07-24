import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { api } from '../utils/api';

const NotificationCentre = ({ user }) => {
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  const refresh = useCallback(() => {
    if (!user) return;
    api('/api/cards/notifications/mine')
      .then(feed => setUnread(feed.unread || 0))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return undefined;
    }
    refresh();
    const timer = setInterval(refresh, 30000);
    const markRead = () => setUnread(0);
    window.addEventListener('focus', refresh);
    window.addEventListener('r5c:notifications-read', markRead);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('r5c:notifications-read', markRead);
    };
  }, [user, refresh]);

  if (!user) return null;

  return (
    <AlertsLink
      to="/notifications"
      aria-label={`Alerts${unread ? `, ${unread} unread` : ''}`}
      title="Alerts"
      className={location.pathname === '/notifications' ? 'active' : ''}
    >
      Alerts
      {unread > 0 && <Unread aria-hidden />}
    </AlertsLink>
  );
};

const AlertsLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--amber-dim);
  white-space: nowrap;
  &:hover { color: var(--white); text-decoration: none; }
  &.active { color: var(--gold-bright); font-weight: 700; }
`;

const Unread = styled.span`
  width: 5px;
  height: 5px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #ff5f56;
`;

export default NotificationCentre;
