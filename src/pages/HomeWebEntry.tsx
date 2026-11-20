import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { haptic } from '../utils/telegram'
import { hapticImpact } from '../utils/haptics'
import { usePremium } from '../contexts/PremiumContext'
import { isFavoritesLocked } from '../utils/access'
import { apiGet } from '../lib/api'
import { formatPlansFromPrice, type PlanOption } from '../utils/planLabel'
import { HOME_PICK_THUMBS, IMAGES } from '../assets/images'
import pickMafiaShadowsAvif from '../assets/optimized/home-pick-mafia-shadows.avif'
import pickDoublesAvif from '../assets/optimized/home-pick-doubles.avif'
import pickInfectedAvif from '../assets/optimized/home-pick-infected.avif'
import HomeReference from './HomeReference'

const WEB_POPULAR = [
  {
    title: 'Мафия: Тени города',
    image: HOME_PICK_THUMBS.mafiaShadows,
    avif: pickMafiaShadowsAvif,
    gameId: 'mafia-shadows',
    to: '/mafia-shadows',
  },
  {
    title: 'Двойники',
    image: HOME_PICK_THUMBS.doubles,
    avif: pickDoublesAvif,
    gameId: 'doubles',
    to: '/doubles',
  },
  {
    title: 'Заражённые',
    image: HOME_PICK_THUMBS.infected,
    avif: pickInfectedAvif,
    gameId: 'infected',
    to: '/infected',
  },
  { title: 'Ассоциации', image: IMAGES.alias.png, to: '/alias' },
  { title: 'Мафия Lite', image: IMAGES.mafia.png, to: '/mafia' },
] as const

const WEB_FRESH = [
  { title: 'Кто тут кто?', image: IMAGES.whoIsWho.png, to: '/who-is-who' },
  { title: 'Путешествие по России', image: IMAGES.russiaTravel.png, to: '/russia-travel' },
  {
    title: 'Заражённые',
    image: HOME_PICK_THUMBS.infected,
    avif: pickInfectedAvif,
    to: '/infected',
  },
  { title: 'СЛЕД', image: IMAGES.sled.png, to: '/sled' },
] as const

/** WEB-only home — no Mini App hero CSS / theme packs in this chunk. */
export default function HomeWebEntry() {
  const { isPremium, loading } = usePremium()
  const navigate = useNavigate()
  const [plansPriceLabel, setPlansPriceLabel] = useState('Тарифы')
  const favoritesLocked = isFavoritesLocked(isPremium)

  useEffect(() => {
    let cancelled = false
    const loadPlans = () => {
      apiGet<{ ok?: boolean; plans?: PlanOption[] }>('/api/plans?audience=web')
        .then((res) => {
          if (cancelled) return
          if (res.ok && Array.isArray(res.plans)) {
            setPlansPriceLabel(formatPlansFromPrice(res.plans))
          }
        })
        .catch(() => {})
    }
    let idleId: number | undefined
    let timeoutId: number | undefined
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(loadPlans, { timeout: 4000 })
    } else {
      timeoutId = window.setTimeout(loadPlans, 1500)
    }
    return () => {
      cancelled = true
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [])

  const openPremium = useCallback(() => {
    navigate('/premium?focus=plans')
  }, [navigate])

  const handleFavoritesClick = useCallback(() => {
    haptic('light')
    if (favoritesLocked) openPremium()
    else navigate('/favorites')
  }, [favoritesLocked, navigate, openPremium])

  const handlePremiumOpen = useCallback(() => {
    hapticImpact('light')
    navigate('/premium')
  }, [navigate])

  const handleWheelOpen = useCallback(() => {
    hapticImpact('light')
    navigate('/wheel')
  }, [navigate])

  const handlePickClick = useCallback(
    (to: string) => {
      haptic('light')
      navigate(to)
    },
    [navigate],
  )

  return (
    <HomeReference
      popular={WEB_POPULAR}
      fresh={WEB_FRESH}
      plansPriceLabel={plansPriceLabel}
      plansLoading={loading}
      showPremium={!isPremium || loading}
      onFavorites={handleFavoritesClick}
      onPremium={handlePremiumOpen}
      onPremiumGate={openPremium}
      onWheel={handleWheelOpen}
      onPick={handlePickClick}
      premiumOpen={false}
      onPremiumClose={() => undefined}
    />
  )
}
