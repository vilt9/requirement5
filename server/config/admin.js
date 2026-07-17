// Who can reach the admin surface (/api/admin/*, the /admin page). A single
// operator email, overridable in prod via ADMIN_EMAIL. Kept tiny and dependency-
// free so both the admin router and publicUser() can share one source of truth.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@requirement5.com')
  .trim()
  .toLowerCase();

export const isAdminEmail = (email) =>
  !!email && String(email).trim().toLowerCase() === ADMIN_EMAIL;

export { ADMIN_EMAIL };
