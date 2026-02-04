import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTg, haptic } from '../utils/telegram'

/**
 * Универсальная кнопка «Назад»: в Telegram WebView всегда использует явный fallback
 * (history.length и navigate(-1) там ненадёжны), иначе — navigate(-1) при наличии истории.
 */
export function useBack(fallback: string) {
  const navigate = useNavigate()
  const isTelegram = typeof window !== 'undefined' && !!getTg()

  return useCallback(() => {
    haptic('light')
    // В Telegram WebView history.length ненадёжен, navigate(-1) ломает приложение
    if (isTelegram || window.history.length <= 1) {
      navigate(fallback)
    } else {
      navigate(-1)
    }
  }, [navigate, fallback, isTelegram])
}
