export const communityActivityPath = (activity) => {
  const cardId = encodeURIComponent(activity?.card?.id || '');
  if (activity?.type === 'set_complete' && activity?.actor?.collectionPath) {
    return activity.actor.collectionPath;
  }
  if (!cardId) return '/';
  if (activity?.type === 'save' && activity?.actor?.username) {
    return `/${encodeURIComponent(activity.actor.username)}/card/${cardId}`;
  }
  return `/card/${cardId}`;
};

export const relativeActivityTime = (value, now = Date.now()) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
};
