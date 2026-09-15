export interface NavbarProfileProps {
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  onOpenDashboard: () => void;
  onSignOut: () => void;
  mobile?: boolean;
}
