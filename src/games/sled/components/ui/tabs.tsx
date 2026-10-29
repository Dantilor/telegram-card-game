import * as React from 'react'
import { cn } from '../../lib/utils'

type TabsCtx = {
  value: string
  setValue: (next: string) => void
}

const TabsContext = React.createContext<TabsCtx | null>(null)

export function Tabs({
  className,
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  orientation?: string
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? '')
  const current = value ?? internal
  const setValue = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternal(next)
      onValueChange?.(next)
    },
    [onValueChange, value],
  )
  return (
    <TabsContext.Provider value={{ value: current, setValue }}>
      <div data-slot="tabs" className={cn('sled-tabs', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export function TabsList({
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { variant?: string }) {
  return (
    <div data-slot="tabs-list" role="tablist" className={cn('sled-tabs__list', className)} {...props}>
      {children}
    </div>
  )
}

export function TabsTrigger({
  className,
  value,
  children,
  ...props
}: React.ComponentProps<'button'> & { value: string }) {
  const ctx = React.useContext(TabsContext)
  const active = ctx?.value === value
  return (
    <button
      type="button"
      role="tab"
      data-slot="tabs-trigger"
      data-state={active ? 'active' : 'inactive'}
      aria-selected={active}
      className={cn('sled-tabs__trigger', className)}
      onClick={(event) => {
        props.onClick?.(event)
        ctx?.setValue(value)
      }}
      {...props}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  className,
  value,
  children,
  ...props
}: React.ComponentProps<'div'> & { value: string }) {
  const ctx = React.useContext(TabsContext)
  if (ctx && ctx.value !== value) return null
  return (
    <div data-slot="tabs-content" role="tabpanel" className={cn(className)} {...props}>
      {children}
    </div>
  )
}
