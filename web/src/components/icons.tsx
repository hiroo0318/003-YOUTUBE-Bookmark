type P = { size?: number; className?: string };
const base = (size = 22) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const BrandMark = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden>
    <path d="M7 3h10a1.5 1.5 0 0 1 1.5 1.5V21l-6.5-4.2L5.5 21V4.5A1.5 1.5 0 0 1 7 3z" />
  </svg>
);
export const IconPlayFill = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <polygon points="7,4 20,12 7,20" />
  </svg>
);
export const IconVideos = (p: P) => (
  <svg {...base(p.size)} className={p.className}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <polygon points="10,9 15,12 10,15" fill="currentColor" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p.size)} className={p.className}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
export const IconList = (p: P) => (
  <svg {...base(p.size)} className={p.className}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);
export const IconInbox = (p: P) => (
  <svg {...base(p.size)} className={p.className}>
    <polyline points="22,12 16,12 14,15 10,15 8,12 2,12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);
export const IconFamily = (p: P) => (
  <svg {...base(p.size)} className={p.className}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M17 14a5 5 0 0 1 4.5 5" />
  </svg>
);
export const IconSettings = (p: P) => (
  <svg {...base(p.size)} className={p.className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </svg>
);
export const IconBack = (p: P) => (
  <svg {...base(p.size)} className={p.className}>
    <polyline points="15,18 9,12 15,6" />
  </svg>
);
export const IconInfo = ({ size = 16 }: P) => (
  <svg {...base(size)} className="flex-none">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="11" x2="12" y2="16" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);
export const IconClock = ({ size = 12 }: P) => (
  <svg {...base(size)} strokeWidth={2.4}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12,7 12,12 15,14" />
  </svg>
);
export const IconPlus = ({ size = 14 }: P) => (
  <svg {...base(size)} strokeWidth={2.2}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
export const IconCheck = ({ size = 16 }: P) => (
  <svg {...base(size)} strokeWidth={2.2}>
    <polyline points="20,6 9,17 4,12" />
  </svg>
);
export const IconChevron = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <polyline points="9,6 15,12 9,18" />
  </svg>
);
export const IconBell = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);
export const IconLock = ({ size = 30 }: P) => (
  <svg {...base(size)}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
