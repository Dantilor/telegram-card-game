import { useEffect, useState } from 'react'
import { getTgUser } from '../utils/telegram'
import { useTheme } from '../hooks/useTheme'
import { apiGet } from '../lib/api'
import iconHostCrown from '../assets/icons/gnh/host-crown.svg'
import iconLightHostCrown from '../assets/icons/gnh-light-pro/light-host-crown-pro.svg'
import iconSunsetHostCrown from '../assets/icons/gnh-sunset-pro/sunset-host-crown-pro.svg'
import iconCalmHostCrown from '../assets/icons/gnh-calm-pro/calm-host-crown-pro.svg'
import './HomeWelcomeTop.css'

const CROWN_BY_THEME = {
  'neon-dark': iconHostCrown,
  'neon-light': iconLightHostCrown,
  sunset: iconSunsetHostCrown,
  'minimal-calm': iconCalmHostCrown,
} as const

const FALLBACK_USERS_COUNT = 6000

function formatUsersCount(count: number): string {
  return new Intl.NumberFormat('ru-RU').format(count)
}

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.trim()[0] ?? ''
  const last = lastName?.trim()[0] ?? ''
  return (first + last).toUpperCase() || 'GN'
}

function HomeWelcomeTop() {
  const [theme] = useTheme()
  const [usersCount, setUsersCount] = useState(FALLBACK_USERS_COUNT)
  const user = getTgUser()
  const crownIcon = CROWN_BY_THEME[theme]
  const formattedCount = formatUsersCount(usersCount)

  useEffect(() => {
    let cancelled = false
    apiGet<{ usersCount: number }>('/api/public-stats')
      .then((data) => {
        if (!cancelled && typeof data.usersCount === 'number' && Number.isFinite(data.usersCount)) {
          setUsersCount(data.usersCount)
        }
      })
      .catch(() => {
        /* fallback stays */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const greeting = 'Привет!'

  return (
    <header className="home-welcome-top">
      <div className="home-welcome-top__card">
        <div className="home-welcome-top__profile">
          <div className="home-welcome-top__avatar-wrap">
            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt=""
                className="home-welcome-top__avatar"
                decoding="async"
                loading="lazy"
              />
            ) : (
              <div className="home-welcome-top__avatar home-welcome-top__avatar--fallback" aria-hidden>
                <span className="home-welcome-top__avatar-letter">
                  {user ? getInitials(user.first_name, user.last_name) : 'GN'}
                </span>
              </div>
            )}
            <span className="home-welcome-top__status" aria-hidden />
          </div>
          <div className="home-welcome-top__meta">
            <span className="home-welcome-top__eyebrow">GameNight Host</span>
            <p className="home-welcome-top__greeting">{greeting}</p>
            {user?.username && (
              <p className="home-welcome-top__username">@{user.username}</p>
            )}
            <span className="home-welcome-top__badge">
              <img src={crownIcon} alt="" className="home-welcome-top__badge-icon" decoding="async" />
              Host
            </span>
          </div>
        </div>
        <div className="home-welcome-top__stats-block" aria-label={`${formattedCount} игроков выбирают GNH`}>
          <span className="home-welcome-top__stats-value">{formattedCount}</span>
          <span className="home-welcome-top__stats-caption">игроков выбирают GNH</span>
        </div>
      </div>
    </header>
  )
}

export default HomeWelcomeTop
