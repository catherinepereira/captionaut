export function PaletteIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 4-4 4h-2a2 2 0 0 0-1.6 3.2A2 2 0 0 1 12 22z" />
      <circle cx="7.5" cy="10.5" r="1.2" />
      <circle cx="12" cy="7" r="1.2" />
      <circle cx="16.5" cy="10.5" r="1.2" />
    </svg>
  )
}
