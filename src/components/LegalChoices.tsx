import { useCallback, useEffect, useState } from 'react'
import {
  buildAgreementBody,
  buildChannelActionBody,
  buildConsentGrantBody,
  consentById,
  fetchPublicDocument,
  LegalClientError,
  userFacingLoadError,
} from '../legal/client'
import { blockAnalyticsTransport } from '../legal/analyticsGate'
import { useLegal } from '../legal/LegalProvider'
import { useTelegramBack } from '../legal/useTelegramBack'
import type { PublicDocument } from '../legal/types'
import './LegalDocumentView.css'

const SHEET_KEY = 'gnh_legal_sheet_closed'

function closedThisSession(): boolean {
  try {
    return sessionStorage.getItem(SHEET_KEY) === '1'
  } catch {
    return false
  }
}

function rememberClosed(): void {
  try {
    sessionStorage.setItem(SHEET_KEY, '1')
  } catch {
    // The flag only hides the sheet. It is not acceptance.
  }
}

function useOptionalDocument(id: string, enabled: boolean): {
  document: PublicDocument | null
  error: string | null
  retry: () => void
} {
  const [document, setDocument] = useState<PublicDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setError(null)
    fetchPublicDocument(id, undefined, import.meta.env)
      .then((loaded) => {
        if (!cancelled) setDocument(loaded)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setDocument(null)
        setError(userFacingLoadError(reason))
      })
    return () => {
      cancelled = true
    }
  }, [id, enabled, attempt])
  return { document, error, retry: () => setAttempt((value) => value + 1) }
}

export function FirstUseSheet() {
  const legal = useLegal()
  const [hidden, setHidden] = useState(closedThisSession)
  const [pdChecked, setPdChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const analyticsRecordEarly = consentById(legal.records, 'analytics')
  const analyticsSettled =
    analyticsRecordEarly?.state === 'granted' ||
    analyticsRecordEarly?.state === 'declined' ||
    analyticsRecordEarly?.state === 'withdrawn'
  const needed =
    legal.status === 'ready' &&
    !hidden &&
    (legal.records?.agreement?.active !== true || !analyticsSettled)
  const agreement = useOptionalDocument('agreement', needed)
  const privacy = useOptionalDocument('privacy', needed)
  const pd = useOptionalDocument('pd_account', needed)
  const analytics = useOptionalDocument('analytics', needed)

  const close = useCallback(() => {
    rememberClosed()
    setHidden(true)
  }, [])
  useTelegramBack(needed, close)
  if (!needed) return null

  const send = async (task: () => Promise<void>) => {
    setBusy(true)
    setMessage(null)
    try {
      await task()
      await legal.refreshRecords()
    } catch (reason) {
      if (reason instanceof LegalClientError && reason.code === 'version_mismatch') {
        agreement.retry()
        privacy.retry()
        pd.retry()
        analytics.retry()
      }
      setMessage(reason instanceof LegalClientError ? userFacingLoadError(reason) : 'Подтверждение не сохранено.')
    } finally {
      setBusy(false)
    }
  }

  const pdRecord = consentById(legal.records, 'pd_account')
  const analyticsRecord = consentById(legal.records, 'analytics')

  return (
    <div className="legal-choice" role="dialog" aria-modal="true" aria-labelledby="legal-first-title">
      <div className="legal-choice__card">
        <h2 id="legal-first-title" className="legal-choice__title">Документы GameNight Host</h2>
        <p className="legal-choice__lead">
          Перед использованием можно открыть полные тексты. Закрытие этого окна ничего не подтверждает.
        </p>
        <div className="legal-choice__links">
          <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={() => legal.openDocument('privacy')}>
            Политика конфиденциальности
          </button>
          <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={() => legal.openDocument('agreement')}>
            Пользовательское соглашение
          </button>
          <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={() => legal.openDocument('offer')}>
            Публичная оферта Premium
          </button>
          <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={() => legal.openDocument('pd_account')}>
            Согласие на сопровождение аккаунта
          </button>
        </div>
        {(agreement.error || privacy.error) && (
          <p className="legal-doc__error">
            {agreement.error || privacy.error} Принятие сейчас недоступно.
            <button type="button" className="legal-doc__retry" onClick={() => { agreement.retry(); privacy.retry() }}>
              Повторить загрузку
            </button>
          </p>
        )}
        <div className="legal-choice__actions">
          <button
            type="button"
            className="legal-choice__btn legal-choice__btn--primary"
            disabled={busy || !agreement.document || !privacy.document}
            onClick={() => {
              const document = agreement.document
              if (!document) return
              void send(async () => {
                await legal.postLegal('/api/legal/agreement', buildAgreementBody(document))
              })
            }}
          >
            Принимаю Пользовательское соглашение
          </button>
        </div>

        <h3 className="legal-choice__title">Сопровождение аккаунта</h3>
        <p className="legal-choice__hint">
          Это отдельное согласие только на операции из его текста, включая поручение ООО «ТАЙМВЭБ.КЛАУД» в указанных пределах.
          Обработка, необходимая для договора или закона, на этом согласии не основана. Отказ не отменяет оплаченный Premium.
          Поддержка, восстановление покупки и обращение о данных остаются доступны.
        </p>
        {pd.error && (
          <p className="legal-doc__error">
            {pd.error}
            <button type="button" className="legal-doc__retry" onClick={pd.retry}>Повторить загрузку</button>
          </p>
        )}
        {pd.document && pdRecord?.active !== true && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const document = pd.document
              if (!document || !pdChecked) return
              void send(async () => {
                await legal.postLegal(
                  '/api/legal/consents',
                  buildConsentGrantBody(document, { reconfirm: pdRecord?.state === 'withdrawn' })
                )
                setPdChecked(false)
              })
            }}
          >
            <label className="legal-choice__check">
              <input
                type="checkbox"
                checked={pdChecked}
                onChange={(event) => setPdChecked(event.target.checked)}
              />
              <span>{pd.document.confirmation.available ? pd.document.confirmation.statement : ''}</span>
            </label>
            <div className="legal-choice__actions">
              <button type="submit" className="legal-choice__btn legal-choice__btn--primary" disabled={busy || !pdChecked}>
                Подтвердить согласие на сопровождение аккаунта
              </button>
              <button
                type="button"
                className="legal-choice__btn legal-choice__btn--quiet"
                disabled={busy || pdRecord?.state === 'declined'}
                onClick={() => {
                  void send(() => legal.postLegal('/api/legal/consents/decline', buildChannelActionBody('pd_account')).then(() => undefined))
                }}
              >
                Не давать это согласие
              </button>
            </div>
          </form>
        )}
        {pdRecord?.active && <p className="legal-choice__status">Согласие на сопровождение аккаунта действует.</p>}

        <h3 className="legal-choice__title">Аналитика</h3>
        {analytics.error && <p className="legal-choice__hint">Необязательная аналитика сейчас недоступна и остаётся выключенной.</p>}
        {analytics.document && analyticsRecord?.active !== true && (
          <div className="legal-choice__actions">
            <p className="legal-choice__hint">{analytics.document.confirmation.available ? analytics.document.confirmation.statement : ''}</p>
            <button
              type="button"
              className="legal-choice__btn legal-choice__btn--primary"
              disabled={busy}
              onClick={() => {
                const document = analytics.document
                if (!document) return
                void send(async () => {
                  await legal.postLegal(
                    '/api/legal/consents',
                    buildConsentGrantBody(document, { reconfirm: analyticsRecord?.state === 'withdrawn' })
                  )
                })
              }}
            >
              Разрешить аналитику
            </button>
            <button
              type="button"
              className="legal-choice__btn legal-choice__btn--quiet"
              disabled={busy || analyticsRecord?.state === 'declined' || analyticsRecord?.state === 'withdrawn'}
              onClick={() => {
                blockAnalyticsTransport()
                void send(() => legal.postLegal('/api/legal/consents/decline', buildChannelActionBody('analytics')).then(() => undefined))
              }}
            >
              Продолжить без аналитики
            </button>
          </div>
        )}
        {message && <p className="legal-doc__error">{message}</p>}
        <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={close}>
          Закрыть без подтверждения
        </button>
      </div>
    </div>
  )
}

export function ConsentsPanel() {
  const legal = useLegal()
  const [channelChecked, setChannelChecked] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)
  const [pdChecked, setPdChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const permissionDoc = useOptionalDocument('marketing_permission', legal.status !== 'anonymous')
  const pdDoc = useOptionalDocument('marketing_pd', legal.status !== 'anonymous')
  const analyticsDoc = useOptionalDocument('analytics', legal.status !== 'anonymous')
  const accountDoc = useOptionalDocument('pd_account', legal.status !== 'anonymous')

  if (legal.status === 'anonymous') {
    return (
      <div className="profile-consents">
        <p className="profile-consents__text">Управление согласиями доступно внутри Telegram. Документы можно читать без входа.</p>
      </div>
    )
  }
  if (legal.status === 'loading') {
    return (
      <div className="profile-consents">
        <p className="profile-consents__text">Проверяем сохранённые согласия…</p>
      </div>
    )
  }
  if (legal.status === 'error') {
    return (
      <div className="profile-consents">
        <p className="legal-doc__error">{legal.error}</p>
        <button type="button" className="legal-doc__retry" onClick={() => void legal.refreshRecords()}>
          Повторить запрос
        </button>
      </div>
    )
  }

  const analytics = consentById(legal.records, 'analytics')
  const account = consentById(legal.records, 'pd_account')
  const permission = consentById(legal.records, 'marketing_permission', 'telegram')
  const marketingPd = consentById(legal.records, 'marketing_pd', 'telegram')
  const marketingOpen = Boolean(permission?.active && marketingPd?.active && legal.records?.marketingDelivery?.telegram)

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setMessage(null)
    try {
      await task()
      await legal.refreshRecords()
    } catch (reason) {
      if (reason instanceof LegalClientError && reason.code === 'version_mismatch') {
        permissionDoc.retry()
        pdDoc.retry()
        analyticsDoc.retry()
        accountDoc.retry()
      }
      setMessage(reason instanceof LegalClientError ? userFacingLoadError(reason) : 'Сервер не подтвердил изменение.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="profile-consents">
      <div className="profile-consents__block">
        <h3 className="profile-consents__title">Сопровождение аккаунта</h3>
        <p className="profile-consents__text">
          {account?.active
            ? `Действует редакция ${account.version}. Отзыв не удаляет оплаченный Premium.`
            : account?.state === 'withdrawn'
              ? 'Согласие отозвано. Оплаченные права, поддержка и восстановление покупки сохраняются.'
              : 'Отдельное согласие не дано.'}
        </p>
        <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={() => legal.openDocument('pd_account')}>
          Открыть полный текст
        </button>
        {account?.active && (
          <button
            type="button"
            className="legal-choice__btn legal-choice__btn--quiet"
            disabled={busy}
            onClick={() => void run(() => legal.postLegal('/api/legal/consents/withdraw', buildChannelActionBody('pd_account')).then(() => undefined))}
          >
            Отозвать согласие на сопровождение аккаунта
          </button>
        )}
        {!account?.active && accountDoc.document && (
          <button
            type="button"
            className="legal-choice__btn legal-choice__btn--primary"
            disabled={busy}
            onClick={() => {
              const document = accountDoc.document
              if (!document) return
              void run(async () => {
                await legal.postLegal('/api/legal/consents', buildConsentGrantBody(document, { reconfirm: account?.state === 'withdrawn' }))
              })
            }}
          >
            {accountDoc.document.confirmation.available ? accountDoc.document.confirmation.statement : 'Подтвердить документ'}
          </button>
        )}
        {accountDoc.error && <p className="profile-consents__text">{accountDoc.error}</p>}
      </div>

      <div className="profile-consents__block">
        <h3 className="profile-consents__title">Аналитика</h3>
        <p className="profile-consents__text">
          {analytics?.active
            ? `Разрешена до ${analytics.validUntil ? new Date(analytics.validUntil).toLocaleDateString('ru-RU') : 'окончания срока'}.`
            : analytics?.inactiveReason === 'expired'
              ? 'Срок согласия истёк. Аналитика выключена.'
              : analytics?.state === 'withdrawn'
                ? 'Согласие отозвано. Аналитика выключена.'
                : 'Аналитика выключена.'}
        </p>
        <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={() => legal.openDocument('analytics')}>
          Открыть полный текст
        </button>
        {analytics?.active ? (
          <button
            type="button"
            className="legal-choice__btn legal-choice__btn--quiet"
            disabled={busy}
            onClick={() => {
              blockAnalyticsTransport()
              void run(() => legal.postLegal('/api/legal/consents/withdraw', buildChannelActionBody('analytics')).then(() => undefined))
            }}
          >
            Отозвать аналитику
          </button>
        ) : analyticsDoc.document ? (
          <div className="legal-choice__actions">
            <button
              type="button"
              className="legal-choice__btn legal-choice__btn--primary"
              disabled={busy}
              onClick={() => {
                const document = analyticsDoc.document
                if (!document) return
                void run(async () => {
                  await legal.postLegal('/api/legal/consents', buildConsentGrantBody(document, { reconfirm: analytics?.state === 'withdrawn' }))
                })
              }}
            >
              Разрешить аналитику
            </button>
            <button
              type="button"
              className="legal-choice__btn legal-choice__btn--quiet"
              disabled={busy || analytics?.state === 'declined' || analytics?.state === 'withdrawn'}
              onClick={() => {
                blockAnalyticsTransport()
                void run(() => legal.postLegal('/api/legal/consents/decline', buildChannelActionBody('analytics')).then(() => undefined))
              }}
            >
              Продолжить без аналитики
            </button>
          </div>
        ) : (
          <p className="profile-consents__text">Необязательная аналитика недоступна и остаётся выключенной.</p>
        )}
      </div>

      <div className="profile-consents__block">
        <h3 className="profile-consents__title">Рекламная рассылка</h3>
        <p className="profile-consents__text">
          {marketingOpen
            ? 'Для Telegram действуют оба подтверждения: реклама и обработка контакта.'
            : 'Реклама выключена. Канал email не предлагается: принадлежность адреса не проверяется.'}
        </p>
        <p className="profile-consents__text">Игра и Premium не зависят от этой подписки.</p>
        <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={() => legal.openDocument('marketing_permission')}>
          Открыть текст согласия на рекламу
        </button>
        <button type="button" className="legal-choice__btn legal-choice__btn--quiet" onClick={() => legal.openDocument('marketing_pd')}>
          Открыть текст согласия на данные для рассылки
        </button>
        {!marketingOpen && permissionDoc.document && pdDoc.document && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const permissionDocument = permissionDoc.document
              const pdDocument = pdDoc.document
              if (!permissionDocument || !pdDocument || !channelChecked || !permissionChecked || !pdChecked) return
              void run(async () => {
                await legal.postLegal(
                  '/api/legal/consents',
                  buildConsentGrantBody(permissionDocument, {
                    channel: 'telegram',
                    reconfirm: permission?.state === 'withdrawn',
                  })
                )
                await legal.postLegal(
                  '/api/legal/consents',
                  buildConsentGrantBody(pdDocument, {
                    channel: 'telegram',
                    reconfirm: marketingPd?.state === 'withdrawn',
                  })
                )
                setChannelChecked(false)
                setPermissionChecked(false)
                setPdChecked(false)
              })
            }}
          >
            <label className="legal-choice__check">
              <input type="checkbox" checked={channelChecked} onChange={(event) => setChannelChecked(event.target.checked)} />
              <span>Канал: личные сообщения Telegram от @GameNightHostBot</span>
            </label>
            <label className="legal-choice__check">
              <input type="checkbox" checked={permissionChecked} onChange={(event) => setPermissionChecked(event.target.checked)} />
              <span>{permissionDoc.document.confirmation.available ? permissionDoc.document.confirmation.statement : ''}</span>
            </label>
            <label className="legal-choice__check">
              <input type="checkbox" checked={pdChecked} onChange={(event) => setPdChecked(event.target.checked)} />
              <span>{pdDoc.document.confirmation.available ? pdDoc.document.confirmation.statement : ''}</span>
            </label>
            <button
              type="submit"
              className="legal-choice__btn legal-choice__btn--primary"
              disabled={busy || !channelChecked || !permissionChecked || !pdChecked}
            >
              Подтвердить рекламную подписку в Telegram
            </button>
          </form>
        )}
        {(permission?.active || marketingPd?.active || permission?.state === 'granted' || marketingPd?.state === 'granted') && (
          <button
            type="button"
            className="legal-choice__btn legal-choice__btn--quiet"
            disabled={busy}
            onClick={() => {
              void run(async () => {
                if (permission?.state === 'granted') {
                  await legal.postLegal('/api/legal/consents/withdraw', buildChannelActionBody('marketing_permission', 'telegram'))
                }
                if (marketingPd?.state === 'granted') {
                  await legal.postLegal('/api/legal/consents/withdraw', buildChannelActionBody('marketing_pd', 'telegram'))
                }
              })
            }}
          >
            Отказаться от рекламы
          </button>
        )}
        {(permissionDoc.error || pdDoc.error) && (
          <p className="profile-consents__text">Рекламная подписка сейчас недоступна и не включается.</p>
        )}
      </div>
      {message && <p className="legal-doc__error">{message}</p>}
    </div>
  )
}
