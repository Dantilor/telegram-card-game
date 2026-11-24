import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { isWebShell } from '../config/shell'
import { getMetrikaConsent, subscribeMetrikaConsent } from './metrikaConsent'
import { gameIdFromPath, isGameOpenPath, normalizeMetrikaPath } from './metrikaPath'
import { reachMetrikaGoalOnce } from './metrikaGoals'
import { disableYandexMetrika, enableYandexMetrika, hitYandexMetrika } from './yandexMetrika'

async function trackPath(pathname: string, referer: string | null): Promise<string> {
  const path = normalizeMetrikaPath(pathname)
  await enableYandexMetrika()
  hitYandexMetrika(path, document.title, referer ?? undefined)
  if (isGameOpenPath(path)) {
    const gameId = gameIdFromPath(path)
    await reachMetrikaGoalOnce('game_open', path, gameId ? { gameId } : undefined)
  }
  if (path === '/premium' || path.startsWith('/premium/')) {
    await reachMetrikaGoalOnce('premium_view', 'route:/premium')
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
    if (!isWebShell()) return

    let cancelled = false
    const applyConsent = () => {
      const state = getMetrikaConsent()
      if (state !== 'granted') {
        disableYandexMetrika()
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
    if (!isWebShell()) return
    if (getMetrikaConsent() !== 'granted') {
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
  }, [location.pathname])

  return null
}