import { useRef, useState, useCallback, useEffect } from 'react'

const THRESHOLD_PX = 80
const COMMIT_DURATION_MS = 200
const RETURN_DURATION_MS = 250

export type UseSwipeCardOptions = {
  onSwipeRight?: () => void
  onSwipeLeft?: () => void
  /** Min distance (px) or fraction of width (0–1). Default 80px, or 25% if containerRef provided. */
  threshold?: number
  containerRef?: React.RefObject<HTMLElement | null>
}

export type UseSwipeCardReturn = {
  bind: {
    onPointerDown: (e: React.PointerEvent) => void
    onPointerMove: (e: React.PointerEvent) => void
    onPointerUp: (e: React.PointerEvent) => void
    onPointerCancel: (e: React.PointerEvent) => void
  }
  style: React.CSSProperties
  state: { isDragging: boolean; dx: number; dy: number }
}

export function useSwipeCard(options: UseSwipeCardOptions = {}): UseSwipeCardReturn {
  const { onSwipeRight, onSwipeLeft, threshold: thresholdOption, containerRef } = options
  const startX = useRef(0)
  const startY = useRef(0)
  const lastDx = useRef(0)
  const lastDy = useRef(0)

  const [dx, setDx] = useState(0)
  const [dy, setDy] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null)
  const [transition, setTransition] = useState('')

  const getThreshold = useCallback(() => {
    if (containerRef?.current) {
      const w = containerRef.current.offsetWidth
      const frac = typeof thresholdOption === 'number' && thresholdOption <= 1 ? thresholdOption : 0.25
      return Math.max(THRESHOLD_PX, w * frac)
    }
    return typeof thresholdOption === 'number' && thresholdOption > 1 ? thresholdOption : THRESHOLD_PX
  }, [containerRef, thresholdOption])

  useEffect(() => {
    if (exitDirection == null) return
    const dir = exitDirection
    const t = setTimeout(() => {
      if (dir === 'right') {
        onSwipeRight?.()
      } else {
        onSwipeLeft?.()
        setTransition(`transform ${RETURN_DURATION_MS}ms ease-out`)
      }
      setExitDirection(null)
    }, COMMIT_DURATION_MS)
    return () => clearTimeout(t)
  }, [exitDirection, onSwipeRight, onSwipeLeft])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (exitDirection) return
    startX.current = e.clientX
    startY.current = e.clientY
    setIsDragging(true)
    setTransition('none')
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [exitDirection])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return
    const newDx = e.clientX - startX.current
    const newDy = e.clientY - startY.current
    lastDx.current = newDx
    lastDy.current = newDy
    setDx(newDx)
    setDy(newDy)
  }, [isDragging])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setIsDragging(false)
    const currentDx = lastDx.current
    const threshold = getThreshold()
    if (Math.abs(currentDx) > threshold) {
      const dir = currentDx > 0 ? 'right' : 'left'
      setExitDirection(dir)
      setDx(0)
      setDy(0)
      setTransition(`transform ${COMMIT_DURATION_MS}ms ease-out`)
    } else {
      setDx(0)
      setDy(0)
      setTransition(`transform ${RETURN_DURATION_MS}ms ease-out`)
    }
  }, [getThreshold])

  const onPointerCancel = useCallback(() => {
    setIsDragging(false)
    setDx(0)
    setDy(0)
    setExitDirection(null)
    setTransition(`transform ${RETURN_DURATION_MS}ms ease-out`)
  }, [])

  const transform = exitDirection
    ? `translateX(${exitDirection === 'right' ? '100%' : '-100%'}) rotate(0deg)`
    : `translateX(${dx}px) rotate(${dx * 0.03}deg)`

  return {
    bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    style: { transform, transition },
    state: { isDragging, dx, dy },
  }
}
