import type { NavbarProfileProps } from './navbarTypes';

export default function NavbarProfile({
  email,
  role,
  onOpenDashboard,
  onSignOut,
  mobile = false,
}: NavbarProfileProps) {
  return (
    <details className={`navbar-profile ${mobile ? 'mobile' : ''}`}>
      <summary>
        <span className="navbar-avatar">{email.slice(0, 1).toUpperCase()}</span>
        <span className="navbar-profile-summary">
          <strong>{mobile ? email : 'Account'}</strong>
          <small>{role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</small>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>

      <div className="navbar-profile-menu">
        <div className="navbar-profile-identity">
          <span className="navbar-avatar large">{email.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{email}</strong>
            <span>{role === 'SUPER_ADMIN' ? 'Super Admin access' : 'Admin access'}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.currentTarget.closest('details')?.removeAttribute('open');
            onOpenDashboard();
          }}
        >
          <span>Control Center</span>
          <span>→</span>
        </button>
        <button
          type="button"
          className="danger"
          onClick={(event) => {
            event.currentTarget.closest('details')?.removeAttribute('open');
            onSignOut();
          }}
        >
          <span>Sign out</span>
          <span>↗</span>
        </button>
      </div>
    </details>
  );
}
