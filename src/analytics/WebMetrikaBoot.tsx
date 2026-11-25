import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { isWebMetrikaFeatureEnabled } from './metrikaFeature'
import { getMetrikaConsent, subscribeMetrikaConsent } from './metrikaConsent'
import { gameIdFromPath, isGameOpenPath, normalizeMetrikaPath } from './metrikaPath'
import { reachMetrikaGoal, reachMetrikaGoalOnce } from './metrikaGoals'
import { disableYandexMetrika, enableYandexMetrika, hitYandexMetrika, purgeMetrikaStorage } from './yandexMetrika'

/** Game currently "open"; game_open fires on entering a game, not on every screen inside it. */
let currentGameId: string | undefined

async function trackPath(pathname: string, referer: string | null): Promise<string> {
  const path = normalizeMetrikaPath(pathname)
  const gameId = isGameOpenPath(path) ? gameIdFromPath(path) : undefined
  const enteringGame = gameId !== undefined && gameId !== currentGameId
  currentGameId = gameId
  await enableYandexMetrika()
  hitYandexMetrika(path, document.title, referer ?? undefined)
  if (enteringGame && gameId) {
    const delivered = await reachMetrikaGoal('game_open', { gameId })
    // Skipped on a private URL: let the next screen of the same game count it.
    if (!delivered && currentGameId === gameId) currentGameId = undefined
  }
  if (path === '/premium' || path.startsWith('/premium/')) {
    await reachMetrikaGoalOnce('premium_view', 'view')
  }
  return path
}

/**
 * WEB-only: load Metrika after consent, send SPA hits, game_open / premium_view goals.
 * Renders nothing. Mini App never mounts this component.
 */
export default function WebMetrikaBoot() {
  const location = useLocation()
  const prevPathRef = useRef<string | null>(null)
  const pathRef = useRef(location.pathname)

  pathRef.current = location.pathname

  useEffect(() => {
    if (!isWebMetrikaFeatureEnabled()) return

    let cancelled = false
    const applyConsent = () => {
      const state = getMetrikaConsent()
      if (state !== 'granted') {
        currentGameId = undefined
        disableYandexMetrika()
        // Explicit refusal: also clear any leftover Metrika cookies/storage from earlier sessions.
        if (state === 'denied') purgeMetrikaStorage()
        return
      }
      void (async () => {
        const path = await trackPath(pathRef.current, prevPathRef.current)
        if (!cancelled) prevPathRef.current = path
      })()
    }

    applyConsent()
    const unsubscribe = subscribeMetrikaConsent(() => {
      if (cancelled) return
      applyConsent()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isWebMetrikaFeatureEnabled()) return
    if (getMetrikaConsent() !== 'granted') {
      currentGameId = undefined
      prevPathRef.current = normalizeMetrikaPath(location.pathname)
      return
    }
    let cancelled = false
    void (async () => {
      const path = await trackPath(location.pathname, prevPathRef.current)
      if (!cancelled) prevPathRef.current = path
    })()
    return () => {
      cancelled = true
    }
    // search/hash are deps so the tag can start once a private URL becomes safe, and so a
    // Direct landing (UTM/yclid only) is tracked after consent without waiting for navigation.
    // Unsafe query/hash values are never forwarded into hits or goals.
  }, [location.pathname, location.search, location.hash])

  return null
}