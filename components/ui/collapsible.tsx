"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface CollapsibleContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null)

interface CollapsibleProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  children: React.ReactNode
}

function Collapsible({
  open: openProp,
  defaultOpen,
  onOpenChange,
  className,
  children,
}: CollapsibleProps) {
  const isControlled = openProp !== undefined
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false)
  const open = isControlled ? openProp : internalOpen
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange]
  )

  return (
    <CollapsibleContext.Provider value={{ open, setOpen }}>
      <div data-slot="collapsible" data-state={open ? "open" : "closed"} className={className}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

interface CollapsibleTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean
}

function CollapsibleTrigger({ asChild, onClick, children, ...props }: CollapsibleTriggerProps) {
  const ctx = React.useContext(CollapsibleContext)
  if (!ctx) throw new Error("CollapsibleTrigger must be used inside Collapsible")
  const handle = (e: React.MouseEvent) => {
    onClick?.(e as React.MouseEvent<HTMLButtonElement>)
    ctx.setOpen(!ctx.open)
  }

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      onClick?: (e: React.MouseEvent) => void
      "aria-expanded"?: boolean
      "data-state"?: string
    }>
    return React.cloneElement(child, {
      onClick: handle,
      "aria-expanded": ctx.open,
      "data-state": ctx.open ? "open" : "closed",
    })
  }
  return (
    <button
      type="button"
      data-slot="collapsible-trigger"
      data-state={ctx.open ? "open" : "closed"}
      aria-expanded={ctx.open}
      onClick={handle}
      {...props}
    >
      {children}
    </button>
  )
}

function CollapsibleContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const ctx = React.useContext(CollapsibleContext)
  if (!ctx) throw new Error("CollapsibleContent must be used inside Collapsible")
  if (!ctx.open) return null
  return (
    <div
      data-slot="collapsible-content"
      data-state="open"
      className={cn("animate-in fade-in-0 slide-in-from-top-1 duration-150", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
