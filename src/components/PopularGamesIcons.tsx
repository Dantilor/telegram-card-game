/**
 * SVG иконки в стиле Glassmorphism для блока «Самые популярные».
 * 40×40px, stroke: var(--card-glow), fill с opacity, backdrop-filter для объёма.
 */
import type { SVGProps } from 'react'

const iconSize = 40
const strokeWidth = 1.5

/** Колода карт — абстрактный градиент */
export function IconCardDeck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <defs>
        <linearGradient id="card-deck-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--card-glow)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--card-glow)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect
        x="8"
        y="10"
        width="24"
        height="20"
        rx="3"
        fill="url(#card-deck-fill)"
        stroke="var(--card-glow)"
        strokeWidth={strokeWidth}
        style={{ filter: 'blur(0)' }}
      />
      <rect
        x="10"
        y="12"
        width="20"
        height="16"
        rx="2"
        fill="var(--card-glow)"
        fillOpacity="0.08"
        stroke="var(--card-glow)"
        strokeWidth={strokeWidth * 0.8}
        strokeOpacity="0.6"
      />
      <rect
        x="12"
        y="14"
        width="16"
        height="12"
        rx="1.5"
        fill="var(--card-glow)"
        fillOpacity="0.05"
        stroke="var(--card-glow)"
        strokeWidth={strokeWidth * 0.6}
        strokeOpacity="0.4"
      />
    </svg>
  )
}

/** Мафия — силуэт в шляпе, inner glow */
export function IconMafia(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <defs>
        <filter id="mafia-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="mafia-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--card-glow)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--card-glow)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {/* Шляпа */}
      <ellipse
        cx="20"
        cy="14"
        rx="12"
        ry="4"
        fill="url(#mafia-fill)"
        stroke="var(--card-glow)"
        strokeWidth={strokeWidth}
        style={{ backdropFilter: 'blur(4px)' }}
      />
      <path
        d="M10 14 L10 8 Q20 4 30 8 L30 14"
        fill="none"
        stroke="var(--card-glow)"
        strokeWidth={strokeWidth}
      />
      <path
        d="M10 14 L10 8 Q20 4 30 8 L30 14"
        fill="var(--card-glow)"
        fillOpacity="0.08"
      />
      {/* Лицо/маска */}
      <ellipse
        cx="20"
        cy="26"
        rx="8"
        ry="10"
        fill="url(#mafia-fill)"
        stroke="var(--card-glow)"
        strokeWidth={strokeWidth}
      />
    </svg>
  )
}

/** Саботаж — искры/детонатор */
export function IconSabotage(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <defs>
        <linearGradient id="sabotage-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--card-glow)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--card-glow)" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      {/* Корпус */}
      <rect
        x="14"
        y="16"
        width="12"
        height="16"
        rx="2"
        fill="url(#sabotage-fill)"
        stroke="var(--card-glow)"
        strokeWidth={strokeWidth}
      />
      {/* Кнопка/верх */}
      <circle
        cx="20"
        cy="12"
        r="4"
        fill="var(--card-glow)"
        fillOpacity="0.12"
        stroke="var(--card-glow)"
        strokeWidth={strokeWidth}
      />
      {/* Искры */}
      <path
        d="M20 8 L20 4 M20 4 L18 6 M20 4 L22 6 M20 4 L20 2"
        stroke="var(--card-glow)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M16 10 L14 8 M18 10 L20 8 M22 10 L26 6"
        stroke="var(--card-glow)"
        strokeWidth={strokeWidth * 0.8}
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  )
}
