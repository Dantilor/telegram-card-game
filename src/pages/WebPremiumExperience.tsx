import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GnhPremiumWheel } from '../components/gnh-premium-wheel/GnhPremiumWheel'
import type { PremiumPlan, ReturnContext } from '../components/gnh-premium-wheel/gnh-experience'
import '../components/gnh-premium-wheel/gnh-experience.css'
import { usePremium } from '../contexts/PremiumContext'
import { apiGet } from '../lib/api'
import {
  buildWebPremiumPlans,
  gameStartPath,
  useWheelCatalog,
  WEB_PREMIUM_FEATURED_IDS,
  WHEEL_PENDING_GAME_KEY,
  type ApiPlan,
} from '../lib/webPremiumCatalog'
import PremiumOverlay from '../components/PremiumOverlay'
import './WebPremiumExperience.css'

const assetBase = new URL('../components/gnh-premium-wheel/assets/', import.meta.url).href

type Props = {
  initialView?: 'premium' | 'wheel' | 'plans'
}

export default function WebPremiumExperience({ initialView = 'premium' }: Props) {
  const { isPremium, refreshPremium } = usePremium()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const catalog = useWheelCatalog()
  const [apiPlans, setApiPlans] = useState<ApiPlan[]>([])
  const [plansError, setPlansError] = useState<string | null>(null)
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null)
  const [checkoutPlanSnap, setCheckoutPlanSnap] = useState<{
    id: string
    title: string
    priceRub: number
    durationDays: number
  } | null>(null)
  const [checkoutOnly, setCheckoutOnly] = useState(false)

  const focusPlans = initialView === 'plans' || searchParams.get('focus') === 'plans'
  const pendingGame = searchParams.get('game')

  useEffect(() => {
    if (!pendingGame) return
    try {
      sessionStorage.setItem(WHEEL_PENDING_GAME_KEY, pendingGame)
    } catch {
      /* ignore */
    }
  }, [pendingGame])

  useEffect(() => {
    const ac = new AbortController()
    apiGet<{ ok?: boolean; plans?: ApiPlan[] }>('/api/plans?audience=web', { signal: ac.signal })
      .then((res) => {
        if (res.ok && Array.isArray(res.plans)) {
          setApiPlans(res.plans)
          setPlansError(null)
        } else {
          setPlansError('Тарифы временно недоступны')
        }
      })
      .catch(() => setPlansError('Не удалось загрузить тарифы'))
    return () => ac.abort()
  }, [])

  const plans = useMemo(() => buildWebPremiumPlans(apiPlans), [apiPlans])
  const view = focusPlans ? 'plans' : initialView === 'wheel' ? 'wheel' : 'premium'

  const onCheckout = useCallback(async (plan: PremiumPlan, context: ReturnContext) => {
    if (context.selectedGameId) {
      try {
        sessionStorage.setItem(WHEEL_PENDING_GAME_KEY, context.selectedGameId)
      } catch {
        /* ignore */
      }
    }
    const fromApi = apiPlans.find((p) => p.id === plan.id)
    setCheckoutPlanSnap({
      id: plan.id,
      title: fromApi?.title || plan.label,
      priceRub: fromApi?.priceRub ?? plan.price,
      durationDays: fromApi?.durationDays ?? (plan.days ?? 36500),
    })
    setCheckoutOnly(true)
    setCheckoutPlanId(plan.id)
  }, [apiPlans])

  const onStartGame = useCallback(
    async (gameId: string) => {
      navigate(gameStartPath(gameId))
    },
    [navigate]
  )

  const onNeedPremium = useCallback(
    (gameId: string) => {
      try {
        sessionStorage.setItem(WHEEL_PENDING_GAME_KEY, gameId)
      } catch {
        /* ignore */
      }
      setSearchParams({ focus: 'plans', game: gameId }, { replace: true })
    },
    [setSearchParams]
  )

  const onViewChange = useCallback(
    (next: 'premium' | 'wheel') => {
      if (next === 'wheel') navigate('/wheel', { replace: true })
      else navigate(focusPlans ? '/premium?focus=plans' : '/premium', { replace: true })
    },
    [focusPlans, navigate]
  )

  const onCheckoutClose = useCallback(() => {
    setCheckoutPlanId(null)
    setCheckoutPlanSnap(null)
    setCheckoutOnly(false)
  }, [])

  const onChangePlan = useCallback(() => {
    setCheckoutPlanId(null)
    setCheckoutPlanSnap(null)
    setCheckoutOnly(false)
  }, [])

  const onBecamePremium = useCallback(() => {
    void refreshPremium()
    setCheckoutPlanId(null)
    setCheckoutPlanSnap(null)
    try {
      const gid = sessionStorage.getItem(WHEEL_PENDING_GAME_KEY)
      if (gid) {
        sessionStorage.removeItem(WHEEL_PENDING_GAME_KEY)
        navigate(gameStartPath(gid))
      }
    } catch {
      /* ignore */
    }
  }, [navigate, refreshPremium])

  return (
    <div className={`web-premium-experience${focusPlans ? ' web-premium-experience--plans' : ''}`}>
      {plansError && <p className="web-premium-experience__error">{plansError}</p>}
      {plans.length === 0 && !plansError ? (
        <p className="web-premium-experience__error">Загрузка тарифов…</p>
      ) : (
        <GnhPremiumWheel
          catalog={catalog}
          plans={plans}
          isPremium={isPremium}
          assetBase={assetBase.endsWith('/') ? assetBase : `${assetBase}/`}
          featuredGameIds={[...WEB_PREMIUM_FEATURED_IDS]}
          initialView={view}
          showHeader
          showFooter
          onCheckout={onCheckout}
          onStartGame={onStartGame}
          onNeedPremium={onNeedPremium}
          onViewChange={onViewChange}
        />
      )}
      <PremiumOverlay
        isOpen={Boolean(checkoutPlanId)}
        onClose={onCheckoutClose}
        preferredPlanId={checkoutPlanId || undefined}
        preferredPlan={checkoutPlanSnap || undefined}
        checkoutOnly={checkoutOnly}
        onChangePlan={onChangePlan}
        onBecamePremium={onBecamePremium}
      />
    </div>
  )
}