import type { ReactNode } from "react"

type IconProps = { size?: number }

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

function Svg({ size = 18, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export function IconGamepad({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path {...line} d="M6.4 9.1h11.2a3.1 3.1 0 0 1 3.1 2.9l.3 3.1a2.15 2.15 0 0 1-2.1 2.35c-.7 0-1.3-.32-1.7-.9L15.8 14.6H8.2l-1.4 1.95c-.4.58-1 .9-1.7.9a2.15 2.15 0 0 1-2.1-2.35l.3-3.1a3.1 3.1 0 0 1 3.1-2.9Z" />
      <path {...line} d="M8.1 12.15h2.5M9.35 10.9v2.5" />
      <circle cx="15.15" cy="11.85" r="0.75" fill="currentColor" />
      <circle cx="17.15" cy="13.45" r="0.75" fill="currentColor" />
    </Svg>
  )
}

export function IconStar({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path {...line} d="M12 3.6 14.5 8.7l5.6.8-4.05 3.95.96 5.55L12 16.4l-5.01 2.6.96-5.55L3.9 9.5l5.6-.8L12 3.6Z" />
    </Svg>
  )
}

export function IconSun({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="3.4" {...line} />
      <path {...line} d="M12 3.2v2.1M12 18.7v2.1M3.2 12h2.1M18.7 12h2.1M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M18.2 5.8l-1.5 1.5M7.3 16.7l-1.5 1.5" />
    </Svg>
  )
}

export function IconLeaf({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path {...line} d="M19.2 4.6C12.2 5.2 6.4 8.6 5.2 14.6c-.7 3.5 1.7 6.4 5.2 5.9 5.6-.8 8.1-7 8.8-15.9Z" />
      <path {...line} d="M5.6 19.2c2.6-3.8 6-6.9 10.6-9.4M9.8 16.2l-.4-3.8M13.2 13.1 9.6 12.9" />
    </Svg>
  )
}

export function IconBolt({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path {...line} d="M13 2.8 6.2 13.2h4.6L9.6 21.2 17.8 10.2h-4.5L13 2.8Z" />
    </Svg>
  )
}

export function IconTrophy({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path {...line} d="M8 4.5h8v2.6a4 4 0 0 1-8 0V4.5Z" />
      <path {...line} d="M8 6.2H5.6A2.4 2.4 0 0 0 8 10.2M16 6.2h2.4A2.4 2.4 0 0 1 16 10.2" />
      <path {...line} d="M12 11.2V14M9.2 19.2h5.6M10.2 14.2h3.6V19" />
    </Svg>
  )
}

export function IconSearch({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="11" cy="11" r="5.2" {...line} />
      <path {...line} d="m15.2 15.2 3.3 3.3" />
    </Svg>
  )
}

export function IconBell({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <path {...line} d="M6.2 16.2h11.6l-1.1-1.6V10a4.7 4.7 0 0 0-9.4 0v4.6l-1.1 1.6Z" />
      <path {...line} d="M10 16.4a2 2 0 0 0 4 0" />
    </Svg>
  )
}

export function IconFlame({ size = 16 }: IconProps) {
  return (
    <Svg size={size}>
      <path {...line} d="M12.2 3.2c.2 2.4-1.1 3.6-2.2 4.8-1.5 1.6-2.8 3.2-2.8 5.6a4.8 4.8 0 0 0 9.4-1.6c0-2.6-1.6-4.1-2.6-5.5-.3 1.3-1 2.1-1.8 2.1.2-1.8-.2-3.4 0-5.4Z" />
    </Svg>
  )
}

export function IconPlay({ size = 12 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M8.2 5.4v13.2L18.4 12 8.2 5.4Z" fill="currentColor" />
    </Svg>
  )
}

export function IconChevron({ size = 14 }: IconProps) {
  return (
    <Svg size={size}>
      <path {...line} d="m9 6 6 6-6 6" />
    </Svg>
  )
}

export function IconDiamond({ size = 20 }: IconProps) {
  return (
    <Svg size={size}>
      <path {...line} d="M4.5 9 8.2 4h7.6L19.5 9 12 20.5 4.5 9Z" />
      <path {...line} d="M4.5 9h15M8.2 4 12 20.5 15.8 4" />
    </Svg>
  )
}
