import * as React from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

type DialogCtx = {
  open: boolean
  onOpenChange?: (open: boolean) => void
}

const DialogContext = React.createContext<DialogCtx>({ open: false })

export function Dialog({
  open = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
}

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<'div'> & { showCloseButton?: boolean }) {
  const { open, onOpenChange } = React.useContext(DialogContext)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted || !open) return null

  return createPortal(
    <div
      className="sled-dialog-overlay sled-portal"
      data-slot="dialog-overlay"
      onClick={() => onOpenChange?.(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        data-slot="dialog-content"
        className={cn('sled-dialog', className)}
        onClick={(event) => event.stopPropagation()}
        {...props}
      >
        {children}
        {showCloseButton && (
          <button
            type="button"
            className="sled-dialog__close"
            aria-label="Close"
            onClick={() => onOpenChange?.(false)}
          >
            <XIcon size={16} />
            <span className="sled-sr-only">Close</span>
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('sled-dialog__header', className)} {...props} />
}

export function DialogFooter({
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { showCloseButton?: boolean }) {
  return (
    <div data-slot="dialog-footer" className={cn('sled-dialog__footer', className)} {...props}>
      {children}
    </div>
  )
}

export function DialogTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 data-slot="dialog-title" className={cn(className)} {...props} />
}

export function DialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="dialog-description" className={cn(className)} {...props} />
}

export function DialogClose({
  className,
  children,
  ...props
}: React.ComponentProps<'button'>) {
  const { onOpenChange } = React.useContext(DialogContext)
  return (
    <button type="button" className={className} onClick={() => onOpenChange?.(false)} {...props}>
      {children}
    </button>
  )
}

export const DialogPortal = ({ children }: { children?: React.ReactNode }) => <>{children}</>
export const DialogOverlay = ({ children }: { children?: React.ReactNode }) => <>{children}</>
export const DialogTrigger = ({ children }: { children?: React.ReactNode }) => <>{children}</>
