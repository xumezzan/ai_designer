import type { CSSProperties } from "react";

const paths: Record<string, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.4" />
      <rect x="14" y="3" width="7" height="7" rx="1.4" />
      <rect x="3" y="14" width="7" height="7" rx="1.4" />
      <rect x="14" y="14" width="7" height="7" rx="1.4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  flower: (
    <>
      <path d="M12 8c-9-11-13 4-4 4-11 9 4 13 4 4 9 11 13-4 4-4 11-9-4-13-4-4Z" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3" />
    </>
  ),
  settings: (
    <>
      <path d="m9 3-.7 3-2.5.8-2.4-1.2-2 3.4 2 2v2l-2 2 2 3.4 2.4-1.2 2.5.8.7 3h4l.7-3 2.5-.8 2.4 1.2 2-3.4-2-2v-2l2-2-2-3.4-2.4 1.2-2.5-.8L13 3Z" />
      <circle cx="11" cy="12" r="3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m8 4 8 8-8 8" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  external: (
    <>
      <path d="M14 3h7v7m0-7L10 14" />
      <path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  phone: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M10 18h4" />
    </>
  ),
  desktop: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V3H3v13h5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01" />
    </>
  ),
  logout: (
    <>
      <path d="M9 3H3v18h6m5-14 5 5-5 5m-5-5h12" />
    </>
  ),
  heart: (
    <path d="M12 21S2 15 2 8a5 5 0 0 1 10-1A5 5 0 0 1 22 8c0 7-10 13-10 13Z" />
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 2v6m10-6v6M3 11h18m-13 5h.01M12 16h.01M16 16h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 6 6" />
    </>
  ),
};
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name] || paths.flower}
    </svg>
  );
}

export function BotanicalSprig({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 300"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1.1">
        <path d="M96 287C102 222 58 147 112 16M97 246c41-33 67-62 65-108M95 205C58 181 32 156 32 112M91 158c30-23 48-48 46-75M94 110C66 89 62 59 70 36" />
        <path d="M111 17C89 36 88 54 96 64c17-5 24-23 15-47ZM73 38C52 34 41 42 44 59c15 13 28 12 36 9M91 112C75 77 48 75 43 89c-2 16 21 29 48 23ZM137 84c-21 12-30 31-22 43 17 2 29-17 22-43ZM32 113c-21-7-31 2-28 19 11 13 24 18 37 14M94 158c25-6 47-6 53 9-7 19-32 20-55 5M162 140c-21 9-33 28-27 43 20 1 34-15 27-43ZM91 203c-27-29-53-34-62-19 5 20 29 29 62 19ZM111 234c30-11 53-10 56 7-10 20-30 21-55 5M97 251c-24-20-45-22-51-7 5 15 25 19 51 17" />
      </g>
    </svg>
  );
}
