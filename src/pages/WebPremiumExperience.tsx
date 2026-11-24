import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GnhPremiumWheel } from '../components/gnh-premium-wheel/GnhPremiumWheel'
import type { PremiumPlan, ReturnContext } from '../components/gnh-premium-wheel/gnh-experience'
import '../components/gnh-premium-wheel/gnh-experience.css'
import { usePremium } from '../contexts/PremiumContext'
import { apiGet } from '../lib/api'
import { scrollWebShellToTop } from '../lib/webChrome'
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

const wheelAssetModules = import.meta.glob('../components/gnh-premium-wheel/assets/*.{webp,png}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const wheelAssetByFile = (() => {
  const map = new Map<string, string>()
  for (const [path, url] of Object.entries(wheelAssetModules)) {
    const file = path.split('/').pop()
    if (file) map.set(file, url)
  }
  return map
})()

function resolveWheelAsset(file: string): string | undefined {
  return wheelAssetByFile.get(file)
}

type Props = {
  initialView?: 'premium' | 'wheel' | 'plans'
}

export default function WebPremiumExperience({ initialView = 'premium' }: Props) {
  const { isPremium, refreshPremium } = usePremium()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const catalog = useWheelCatalog()
  const [apiPlans, setApiPlans] = useState<ApiPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [plansError, setPlansError] = useState<string | null>(null)
  const [plansRetry, setPlansRetry] = useState(0)
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
    scrollWebShellToTop('auto')
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    let cancelled = false
    setPlansLoading(true)
    setPlansError(null)

    const load = async (attempt: number): Promise<void> => {
      try {
        const res = await apiGet<{ ok?: boolean; plans?: ApiPlan[] }>('/api/plans?audience=web', {
          signal: ac.signal,
        })
        if (cancelled) return
        if (res.ok && Array.isArray(res.plans) && res.plans.length > 0) {
          setApiPlans(res.plans)
          setPlansError(null)
          setPlansLoading(false)
          return
        }
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
          if (!cancelled && !ac.signal.aborted) return load(attempt + 1)
        }
        setPlansError('Тарифы временно недоступны. Нажмите «Обновить».')
        setPlansLoading(false)
      } catch {
        if (cancelled || ac.signal.aborted) return
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
          if (!cancelled && !ac.signal.aborted) return load(attempt + 1)
        }
        setPlansError('Не удалось загрузить тарифы. Проверьте сеть и нажмите «Обновить».')
        setPlansLoading(false)
      }
    }

    void load(0)
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [plansRetry])

  useEffect(() => {
    if (!focusPlans) return
    const id = window.setTimeout(() => {
      const el =
        document.querySelector('.gnh-experience .gnh-plans') ||
        document.querySelector('.gnh-experience [data-view="plans"]') ||
        document.querySelector('.web-premium-experience--plans .gnh-main')
      el?.scrollIntoView({ block: 'start', behavior: 'auto' })
    }, 80)
    return () => window.clearTimeout(id)
  }, [focusPlans, plansLoading, apiPlans.length])

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
    void import('../analytics/metrikaGoals').then(({ reachMetrikaGoal }) =>
      reachMetrikaGoal('premium_checkout', { planId: plan.id })
    )
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

  const onGoHome = useCallback(() => {
    navigate('/', { replace: false })
  }, [navigate])

  const onCheckoutClose = useCallback(() => {
    setCheckoutPlanId(null)
    setCheckoutPlanSnap(null)
    setCheckoutOnly(false)
  }, [])

  const onCheckoutGoHome = useCallback(() => {
    setCheckoutPlanId(null)
    setCheckoutPlanSnap(null)
    setCheckoutOnly(false)
    navigate('/', { replace: false })
  }, [navigate])

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
      {(plansError || plansLoading) && (
        <div className="web-premium-experience__banner" role="status">
          <p className="web-premium-experience__error">
            {plansLoading ? 'Загрузка тарифов…' : plansError}
          </p>
          {!plansLoading && plansError ? (
            <button
              type="button"
              className="web-premium-experience__retry"
              onClick={() => setPlansRetry((n) => n + 1)}
            >
              Обновить
            </button>
          ) : null}
        </div>
      )}
      <GnhPremiumWheel
        catalog={catalog}
        plans={plans}
        isPremium={isPremium}
        assetBase={assetBase.endsWith('/') ? assetBase : `${assetBase}/`}
        resolveAsset={resolveWheelAsset}
        featuredGameIds={[...WEB_PREMIUM_FEATURED_IDS]}
        initialView={view}
        showHeader
        showFooter
        onCheckout={onCheckout}
        onStartGame={onStartGame}
        onNeedPremium={onNeedPremium}
        onViewChange={onViewChange}
        onGoHome={onGoHome}
      />
      <PremiumOverlay
        isOpen={Boolean(checkoutPlanId)}
        onClose={onCheckoutClose}
        preferredPlanId={checkoutPlanId || undefined}
        preferredPlan={checkoutPlanSnap || undefined}
        checkoutOnly={checkoutOnly}
        onChangePlan={onChangePlan}
        onGoHome={onCheckoutGoHome}
        onBecamePremium={onBecamePremium}
      />
    </div>
  )
}
