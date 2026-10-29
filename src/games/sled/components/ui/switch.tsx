import * as React from 'react'
import { cn } from '../../lib/utils'

type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  size?: 'sm' | 'default'
}

export function Switch({
  className,
  checked = false,
  onCheckedChange,
  disabled,
  size = 'default',
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-slot="switch"
      data-size={size}
      data-state={checked ? 'checked' : 'unchecked'}
      className={cn('sled-switch', className)}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span data-slot="switch-thumb" className="sled-switch__thumb" />
    </button>
  )
}
