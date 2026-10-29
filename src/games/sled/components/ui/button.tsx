import * as React from 'react'
import { cn } from '../../lib/utils'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string
  size?: string
  asChild?: boolean
}

export function Button({ className, type = 'button', children, ...props }: ButtonProps) {
  const rest = { ...props }
  delete (rest as { variant?: string }).variant
  delete (rest as { size?: string }).size
  delete (rest as { asChild?: boolean }).asChild
  return (
    <button type={type} data-slot="button" className={cn('sled-btn', className)} {...rest}>
      {children}
    </button>
  )
}
