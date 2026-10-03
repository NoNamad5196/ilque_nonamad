export type IconName =
  | "sun"
  | "quest"
  | "goal"
  | "flag"
  | "book"
  | "history"
  | "spark"
  | "settings"
  | "chevron"
  | "plus"
  | "check"
  | "clock"
  | "refresh"
  | "fire"
  | "close"
  | "menu"
  | "arrow";
const paths: Record<IconName, React.ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  quest: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="3" />
      <path d="M9 3h6v4H9zM9 12l2 2 4-4m-6 8h6" />
    </>
  ),
  goal: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="m12 12 8-8m-1-2v3h3" />
    </>
  ),
  flag: (
    <>
      <path d="M5 22V3m0 1c5-5 9 5 15 0v11c-6 5-10-5-15 0" />
    </>
  ),
  book: (
    <>
      <path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-4-2-7-1-10 1v15" />
    </>
  ),
  history: (
    <>
      <path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4m-2-2h4" />
    </>
  ),
  settings: (
    <>
      <path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 8a9 9 0 0 0-16-2L2 9m0-6v6h6m-4 7a9 9 0 0 0 16 2l2-3m0 6v-6h-6" />
    </>
  ),
  fire: (
    <path d="M13 2c1 6-5 7-3 11 2-1 3-3 3-5 5 3 7 5 6 9-1 7-13 7-14 0-1-5 4-7 4-11 1 2 2 2 2 3 2-2 2-5 2-7z" />
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
