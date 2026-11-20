import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  mountGnhExperience,
  type CatalogGame,
  type PremiumPlan,
  type ReturnContext,
  type ExperienceHandle,
} from './gnh-experience.js'
import './gnh-experience.css'

type Props = {
  catalog: CatalogGame[]
  plans: PremiumPlan[]
  isPremium: boolean
  assetBase: string
  featuredGameIds?: string[]
  initialView?: 'premium' | 'wheel' | 'plans'
  showHeader?: boolean
  showFooter?: boolean
  onCheckout: (plan: PremiumPlan, context: ReturnContext) => void | Promise<void>
  onStartGame: (gameId: string) => void | Promise<void>
  onNeedPremium?: (gameId: string) => void
  onViewChange?: (view: 'premium' | 'wheel') => void
  onGoHome?: () => void
}

export const GnhPremiumWheel = forwardRef<Pick<ExperienceHandle, 'showPremium' | 'showWheel'>, Props>(
  function GnhPremiumWheel(props, ref) {
    const element = useRef<HTMLDivElement>(null)
    const widget = useRef<ExperienceHandle | null>(null)
    const latest = useRef(props)
    latest.current = props

    useImperativeHandle(
      ref,
      () => ({
        showPremium: () => widget.current?.showPremium(),
        showWheel: () => widget.current?.showWheel(),
      }),
      []
    )

    useEffect(() => {
      if (!element.current) return
      const instance = mountGnhExperience(element.current, {
        catalog: props.catalog,
        plans: props.plans,
        assetBase: props.assetBase,
        featuredGameIds: props.featuredGameIds,
        initialView: props.initialView,
        demoMode: false,
        showHeader: props.showHeader !== false,
        showFooter: props.showFooter !== false,
        isPremium: () => latest.current.isPremium,
        onCheckout: (plan, context) => latest.current.onCheckout(plan, context),
        onStartGame: (gameId) => latest.current.onStartGame(gameId),
        onNeedPremium: (gameId) => latest.current.onNeedPremium?.(gameId),
        onViewChange: (view) => latest.current.onViewChange?.(view),
        onGoHome: () => latest.current.onGoHome?.(),
      })
      widget.current = instance
      return () => {
        instance.destroy()
        widget.current = null
      }
    }, [
      props.catalog,
      props.plans,
      props.assetBase,
      props.featuredGameIds,
      props.initialView,
      props.showHeader,
      props.showFooter,
    ])

    useEffect(() => {
      widget.current?.refreshAccess()
    }, [props.isPremium])

    return <div ref={element} />
  }
)