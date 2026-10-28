const iconPaths = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7V5a2 2 0 0 1 2-2h13v4" />
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M16 14h5" />
    </>
  ),
  tag: <path d="M20 13 13 20l-10-10V3h7l10 10Z" />,
  chart: (
    <>
      <path d="M4 19V9m6 10V5m6 14v-7m5 7H2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A7 7 0 0 0 15 6l-.3-2.6h-4L10.4 6A7 7 0 0 0 8 7.1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1A7 7 0 0 0 10.4 18l.3 2.6h4L15 18a7 7 0 0 0 1.5-1.1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="m9 18 6-6-6-6" />,
  activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
  report: (
    <>
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M14 3v5h5M8 13h8M8 17h5" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12 4 4L19 6" />,
  home: <path d="M3 12l9-9 9 9M5 10v10h4v-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5h4V10" />,
  car: <path d="M5 17h14v-2a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3H7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h13l-2-4H5a1 1 0 0 0 0 2v9a1 1 0 0 0 1 1z" />,
  shoppingBag: <path d="M16 11V7a4 4 0 0 0-8 0v4M5 21h14a2 2 0 0 0 2-2v-6H3v6a2 2 0 0 0 2 2z" />,
  tv: <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />,
  heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />,
  eye: <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />,
  'eye-off': <path d="M1 1m5 0l12 12m-7-5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  edit: <path d="M2 5h2a4 4 0 0 1 4-2h1.4a1 1 0 0 1 .7.3l2-2a1 1 0 0 1 1.4 0L21 3l-2 18-2 2H5l-3-3V6a3 3 0 0 1 0-3Z" />,
  trash: <path d="M3 6h18M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1h2zM4 6h16v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6z" />,
  save: <path d="M19 12H5M5 12l7 7m-7-7l7-7" />,
  'arrow-left': <path d="M12 5v14M19 12l-7 7-7-7" />,
  'arrow-right': <path d="M5 12h14M12 5l7 7-7 7" />,
  'check-circle': <path d="M9 12l2 2 4-4M7.5 21h9a4.5 4.5 0 0 0 0-9H7.5a4.5 4.5 0 0 0 0 9Z" />,
  'x-circle': <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" />,
  'alert-triangle': <path d="M10.29 3.86 1.82 21a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3l-8.57-17.14a2 2 0 0 0-3.44 0z" />,
  'trending-up': <path d="M3 17l6-6 4 4 8-8" />,
  plane: <path d="M22 6.5l-8.5-3-8.5 8.5 0 3.5 5-2.5 3.5 5.5-8.5 3 0 3 10-10-3-5-7-2-8z" />,
  code: <path d="M16 18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8z" />,
  'pie-chart': <path d="M12 2v10l9 5a10 10 0 0 0-9-15z" />,
  zap: <path d="M13 2L3 14h9v8l10-12h-9z" />,
}

export function Icon({ name, className = 'size-5', children }) {
  const path = iconPaths[name] || iconPaths.search
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {path}
    </svg>
  )
}

export default Icon
