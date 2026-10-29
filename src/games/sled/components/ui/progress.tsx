import * as React from 'react'
import { cn } from '../../lib/utils'

export function Progress({
  className,
  value = 0,
  ...props
}: React.ComponentProps<'div'> & { value?: number | null }) {
  const clamped = Math.max(0, Math.min(100, Number(value ?? 0)))
  return (
    <div data-slot="progress" className={cn('sled-progress', className)} {...props}>
      <div data-slot="progress-indicator" className="sled-progress__bar" style={{ width: `${clamped}%` }} />
    </div>
  )
}
