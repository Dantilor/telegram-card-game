import type { IconName } from './icons'
import { ICONS } from './icons'
import './icons.css'

export type IconSize = 'sm' | 'md' | 'lg'

type IconProps = {
  name: IconName
  size?: IconSize
  className?: string
  'aria-hidden'?: boolean
}

const sizeClass: Record<IconSize, string> = {
  sm: 'ui-icon--sm',
  md: 'ui-icon--md',
  lg: 'ui-icon--lg',
}

export function Icon({ name, size = 'lg', className = '', 'aria-hidden': ariaHidden = true }: IconProps) {
  const Render = ICONS[name]
  if (!Render) return null
  const sizeClassName = sizeClass[size]
  const classes = ['ui-icon', sizeClassName, className].filter(Boolean).join(' ')
  return (
    <span className={classes} aria-hidden={ariaHidden}>
      {Render()}
    </span>
  )
}

export { ICONS }
export type { IconName } from './icons'
