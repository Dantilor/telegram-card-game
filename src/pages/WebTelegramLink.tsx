import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { markTelegramStartParamConsumed, waitForTelegramStartParam } from '../lib/telegram'
import {
  completeTelegramWebLink,
  fetchTelegramDevicesForMiniApp,
  revokeTelegramDeviceFromMiniApp,
} from '../lib/telegramWebLink'
import { waitForInitData } from '../lib/waitForInitData'
import { haptic } from '../utils/telegram'
import { usePremium } from '../contexts/PremiumContext'
import HomeButton from '../components/HomeButton'
import BackButton from '../components/BackButton'
import { useBack } from '../hooks/useBack'
import './WebTelegramLink.css'

const WL_TOKEN_RE = /^wl_[A-Za-z0-9_-]{16,60}$/

type DeviceRow = {
  id: string
  label: string
  linkedAt: string
  lastActiveAt: string
  isCurrent: boolean
}

export default function WebTelegramLink() {
  const handleBack = useBack('/')
  const navigate = useNavigate()
  const { refreshPremium } = usePremium()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const [devicesUsed, setDevicesUsed] = useState<number | null>(null)
  const [devicesLimit, setDevicesLimit] = useState(3)
  const [manageMode, setManageMode] = useState(false)
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [bootHint, setBootHint] = useState('Подключаем Telegram…')

  const loadDevices = useCallback(async () => {
    const listed = await fetchTelegramDevicesForMiniApp()
    setDevices(listed.devices || [])
    setDevicesUsed(listed.devicesUsed)
    setDevicesLimit(listed.devicesLimit || 3)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setBootHint('Подключаем Telegram…')
      const [initData, startParam] = await Promise.all([
        waitForInitData(4000),
        waitForTelegramStartParam(4000),
      ])
      if (cancelled) return
      if (startParam === 'devices' || startParam.startsWith('devices')) {
        setManageMode(true)
        setBootHint('')
        if (initData) {
          try {
            await loadDevices()
          } catch {
            setError('Не удалось загрузить устройства. Откройте Mini App из Telegram ещё раз.')
          }
        } else {
          setBootHint('Откройте эту страницу внутри Telegram Mini App GameNight Host.')
        }
        return
      }
      const next = WL_TOKEN_RE.test(startParam) ? startParam : ''
      setToken(next)
      if (!next) {
        setBootHint(
          'Ссылка привязки не найдена. Вернитесь на сайт play.gamenighthost.ru и нажмите «Восстановить через Telegram».'
        )
      } else if (!initData) {
        setBootHint('Откройте эту страницу внутри Telegram Mini App GameNight Host.')
      } else {
        setBootHint('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadDevices])

  const onConfirm = useCallback(async () => {
    haptic('medium')
    setError(null)
    setStatus(null)
    setLimitReached(false)
    if (!token) {
      setError(
        'Ссылка привязки неполная или устарела. Вернитесь на сайт и нажмите «Восстановить через Telegram».'
      )
      return
    }
    const initData = await waitForInitData(2500)
    if (!initData) {
      setError('Откройте эту страницу внутри Telegram Mini App GameNight Host.')
      return
    }
    setBusy(true)
    try {
      const result = await completeTelegramWebLink(token)
      markTelegramStartParamConsumed(token)
      setDone(true)
      if (typeof result.devicesUsed === 'number') setDevicesUsed(result.devicesUsed)
      if (typeof result.devicesLimit === 'number') setDevicesLimit(result.devicesLimit)
      await refreshPremium()
      try {
        window.dispatchEvent(new Event('tcg_premium_sync'))
      } catch {
        /* ignore */
      }
      const usedLabel =
        typeof result.devicesUsed === 'number'
          ? ` Устройств: ${result.devicesUsed} из ${result.devicesLimit ?? 3}.`
          : ''
      if (result.isPremium || result.premium) {
        setStatus(
          result.activeUntil
            ? `Telegram подключён! Premium доступен на сайте до ${new Date(result.activeUntil).toLocaleDateString('ru-RU')}.${usedLabel}`
            : `Telegram подключён! Premium доступен на сайте.${usedLabel}`
        )
      } else {
        setStatus(`Telegram подключён, но активный Premium не найден.${usedLabel}`)
      }
    } catch (reason) {
      const codeName =
        reason && typeof reason === 'object' && 'code' in reason
          ? String((reason as { code?: string }).code ?? '')
          : ''
      if (codeName === 'device_limit_reached') {
        setLimitReached(true)
        const used =
          reason && typeof reason === 'object' && 'devicesUsed' in reason
            ? Number((reason as { devicesUsed?: number }).devicesUsed)
            : 3
        const limit =
          reason && typeof reason === 'object' && 'devicesLimit' in reason
            ? Number((reason as { devicesLimit?: number }).devicesLimit)
            : 3
        setDevicesUsed(used)
        setDevicesLimit(limit)
        setError(null)
        setStatus(null)
        markTelegramStartParamConsumed(token)
        try {
          await loadDevices()
          setManageMode(true)
        } catch {
          /* ignore */
        }
      } else if (codeName === 'token_invalid' || codeName === 'invalid_token' || codeName === 'code_invalid') {
        setError('Ссылка недействительна или уже использована. Запросите новую на сайте.')
      } else if (codeName === 'telegram_init_required') {
        setError('Telegram не передал данные входа. Закройте Mini App и откройте ссылку снова с сайта.')
      } else if (codeName === 'telegram_already_linked') {
        setError('Этот Telegram уже связан с другим WEB-аккаунтом.')
      } else if (codeName === 'web_already_linked') {
        setError('WEB-аккаунт уже связан с другим Telegram.')
      } else if (codeName === 'rate_limited') {
        setError('Слишком много попыток. Подождите немного.')
      } else {
        setError('Не удалось подтвердить привязку. Попробуйте ещё раз.')
      }
    } finally {
      setBusy(false)
    }
  }, [token, refreshPremium, loadDevices])

  const onRevoke = useCallback(
    async (deviceId: string, label: string) => {
      haptic('medium')
      const ok = window.confirm(`Отключить «${label}»?`)
      if (!ok) return
      setBusy(true)
      setError(null)
      try {
        const result = await revokeTelegramDeviceFromMiniApp(deviceId)
        setDevices(result.devices || [])
        setDevicesUsed(result.devicesUsed)
        setDevicesLimit(result.devicesLimit || 3)
        if ((result.devicesUsed ?? 0) < (result.devicesLimit ?? 3)) {
          setLimitReached(false)
          setStatus('Слот освобождён. Можно подключить новое устройство с сайта.')
        }
      } catch {
        setError('Не удалось отключить устройство.')
      } finally {
        setBusy(false)
      }
    },
    []
  )

  return (
    <div className="web-tg-link">
      <div className="web-tg-link__top">
        <HomeButton className="web-tg-link__nav" />
        <BackButton onClick={handleBack} className="web-tg-link__nav" />
      </div>
      <h1 className="web-tg-link__title">
        {limitReached || manageMode ? 'Управление устройствами' : 'Подключить Premium к сайту'}
      </h1>
      {!manageMode && !limitReached ? (
        <p className="web-tg-link__lead">
          Вы подключаете свой Telegram-аккаунт к GameNight Host. Если у вас есть действующий Premium, он
          станет доступен на сайте без повторной покупки.
        </p>
      ) : (
        <p className="web-tg-link__lead">
          {limitReached
            ? 'Все 3 устройства подключены. Отключите одно из предыдущих, чтобы подключить новое.'
            : 'Устройства с доступом к Premium на сайте.'}
          {devicesUsed != null ? ` Сейчас: ${devicesUsed} из ${devicesLimit}.` : ''}
        </p>
      )}
      {bootHint ? (
        <p className="web-tg-link__hint" role="status">
          {bootHint}
        </p>
      ) : null}
      {token && !done && !limitReached ? (
        <button
          type="button"
          className="web-tg-link__submit"
          disabled={busy}
          onClick={() => void onConfirm()}
        >
          {busy ? 'Подключаем…' : 'Подключить'}
        </button>
      ) : null}
      {(manageMode || limitReached) && devices.length > 0 ? (
        <ul className="web-tg-link__devices">
          {devices.map((device) => (
            <li key={device.id} className="web-tg-link__device">
              <div>
                <strong>{device.label}</strong>
                <span>
                  {device.isCurrent
                    ? 'Текущая сессия Mini App не занимает слот WEB'
                    : `Активность: ${new Date(device.lastActiveAt).toLocaleDateString('ru-RU')}`}
                </span>
              </div>
              <button
                type="button"
                className="web-tg-link__secondary"
                disabled={busy}
                onClick={() => void onRevoke(device.id, device.label)}
              >
                Отключить
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className="web-tg-link__error" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="web-tg-link__ok" role="status">
          {status}
        </p>
      ) : null}
      {done || limitReached || manageMode ? (
        <p className="web-tg-link__foot">
          <button
            type="button"
            className="web-tg-link__submit"
            onClick={() => {
              haptic('light')
              navigate('/', { replace: true })
            }}
          >
            Открыть GameNight Host
          </button>
        </p>
      ) : null}
    </div>
  )
}