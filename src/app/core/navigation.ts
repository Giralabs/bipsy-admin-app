/**
 * Panel map. It is read by the side menu, the tiles screen and the search:
 * a new section is added here and shows up in all three places.
 */

export type BadgeKey = 'tickets' | 'improvements' | 'reports' | 'onboarding';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  /** One line for the tile on the home screen. */
  description: string;
  badge?: BadgeKey;
  /** Wide tile on the home screen. */
  wide?: boolean;
}

export interface NavSection {
  title: string | null;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: null,
    items: [
      {
        path: '/dashboard',
        label: 'Resumen',
        icon: 'space_dashboard',
        description: 'Cifras clave, lo que pide atención y la actividad del equipo.',
        wide: true,
      },
    ],
  },
  {
    title: 'Personas',
    items: [
      { path: '/users', label: 'Clientes', icon: 'group', description: 'Cuentas de la app Bipsy, sanciones y pagos.' },
      {
        path: '/businesses',
        label: 'Negocios',
        icon: 'storefront',
        description: 'Fichas, plan y acceso, clientes, equipo y reseñas.',
      },
      {
        path: '/onboarding',
        label: 'Bienvenidas',
        icon: 'call',
        description: 'Negocios en cortesía o prueba a los que llamar antes de que paguen.',
        badge: 'onboarding',
      },
    ],
  },
  {
    title: 'Moderación',
    items: [
      {
        path: '/tickets',
        label: 'Soporte',
        icon: 'support_agent',
        description: 'Tickets de ayuda de Bipsy Business.',
        badge: 'tickets',
      },
      {
        path: '/improvements',
        label: 'Mejoras',
        icon: 'lightbulb',
        description: 'Solicitudes de mejora de los negocios con plan Quality.',
        badge: 'improvements',
      },
      { path: '/reports', label: 'Reportes', icon: 'flag', description: 'Denuncias entre clientes y negocios.', badge: 'reports' },
      { path: '/reviews', label: 'Reseñas', icon: 'reviews', description: 'Opiniones publicadas de cada negocio.' },
    ],
  },
  {
    title: 'Dinero',
    items: [
      {
        path: '/payments',
        label: 'Cobros',
        icon: 'payments',
        description: 'Todo lo cobrado a clientes: tarifas y pagos de cita. Devolver y cobrar.',
      },
    ],
  },
  {
    title: 'Plataforma',
    items: [
      {
        path: '/plans',
        label: 'Planes y ofertas',
        icon: 'workspace_premium',
        description: 'Catálogo, planes regalados y accesos gratis.',
      },
      { path: '/categories', label: 'Categorías', icon: 'category', description: 'Tipos de negocio de Explorar y del alta.' },
      { path: '/discovery', label: 'Explorar', icon: 'travel_explore', description: 'Quién sale destacado y hasta dónde.' },
      { path: '/referrals', label: 'Referidos', icon: 'share', description: 'Clientes traídos por cada negocio.' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { path: '/team', label: 'Equipo del panel', icon: 'admin_panel_settings', description: 'Cuentas de administración y permisos.' },
      { path: '/audit-log', label: 'Auditoría', icon: 'history', description: 'Quién cambió qué y cuándo.' },
      {
        path: '/maintenance',
        label: 'Mantenimiento',
        icon: 'construction',
        description: 'Cierra la web de clientes o la de negocios mientras se trabaja en ellas.',
      },
      { path: '/legal', label: 'Legal', icon: 'gavel', description: 'Términos, privacidad, suscripción y datos del titular.' },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
