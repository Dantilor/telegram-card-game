import { type RefObject, useEffect } from 'react'

export function useHorizontalScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }

    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('wheel', onWheel)
    }
  }, [ref])
}
