import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { haptic } from '../utils/telegram'

/**
 * Универсальная кнопка «Назад»: сначала пробует history.back(),
 * если некуда возвращаться — переходит на fallback.
 */
export function useBack(fallback: string) {
  const navigate = useNavigate()

  return useCallback(() => {
    haptic('light')
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate(fallback)
    }
  }, [navigate, fallback])
}
