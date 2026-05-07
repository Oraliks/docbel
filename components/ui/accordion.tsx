"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Context ────────────────────────────────────────────────────────────
type AccordionType = "single" | "multiple"

interface AccordionContextValue {
  type: AccordionType
  collapsible: boolean
  openItems: string[]
  toggle: (value: string) => void
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null)

interface AccordionProps {
  type?: AccordionType
  collapsible?: boolean
  defaultValue?: string | string[]
  value?: string | string[]
  onValueChange?: (value: string | string[]) => void
  className?: string
  children: React.ReactNode
}

function Accordion({
  type = "single",
  collapsible = true,
  defaultValue,
  value: valueProp,
  onValueChange,
  className,
  children,
}: AccordionProps) {
  const isControlled = valueProp !== undefined

  const initial = React.useMemo<string[]>(() => {
    const v = isControlled ? valueProp : defaultValue
    if (v === undefined || v === null) return []
    return Array.isArray(v) ? v : [v]
  }, [defaultValue, isControlled, valueProp])

  const [internal, setInternal] = React.useState<string[]>(initial)
  const openItems = isControlled
    ? Array.isArray(valueProp)
      ? valueProp
      : valueProp
        ? [valueProp]
        : []
    : internal

  const toggle = (val: string) => {
    let next: string[]
    if (type === "single") {
      const isOpen = openItems.includes(val)
      next = isOpen ? (collapsible ? [] : openItems) : [val]
    } else {
      next = openItems.includes(val) ? openItems.filter((v) => v !== val) : [...openItems, val]
    }
    if (!isControlled) setInternal(next)
    onValueChange?.(type === "single" ? (next[0] ?? "") : next)
  }

  return (
    <AccordionContext.Provider value={{ type, collapsible, openItems, toggle }}>
      <div data-slot="accordion" className={className}>{children}</div>
    </AccordionContext.Provider>
  )
}

// ── Item ───────────────────────────────────────────────────────────────
interface AccordionItemContextValue {
  value: string
  isOpen: boolean
}
const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null)

interface AccordionItemProps {
  value: string
  className?: string
  children: React.ReactNode
}
function AccordionItem({ value, className, children }: AccordionItemProps) {
  const ctx = React.useContext(AccordionContext)
  if (!ctx) throw new Error("AccordionItem must be used inside <Accordion>")
  const isOpen = ctx.openItems.includes(value)
  return (
    <AccordionItemContext.Provider value={{ value, isOpen }}>
      <div
        data-slot="accordion-item"
        data-state={isOpen ? "open" : "closed"}
        className={cn("border-b last:border-b-0", className)}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  )
}

// ── Trigger ────────────────────────────────────────────────────────────
function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<"button">) {
  const a = React.useContext(AccordionContext)
  const i = React.useContext(AccordionItemContext)
  if (!a || !i) throw new Error("AccordionTrigger must be inside <AccordionItem>")
  return (
    <button
      type="button"
      data-slot="accordion-trigger"
      data-state={i.isOpen ? "open" : "closed"}
      aria-expanded={i.isOpen}
      onClick={() => a.toggle(i.value)}
      className={cn(
        "group flex w-full items-center justify-between gap-2 py-3 text-left text-sm font-medium transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
          i.isOpen && "rotate-180"
        )}
      />
    </button>
  )
}

// ── Content ────────────────────────────────────────────────────────────
function AccordionContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const i = React.useContext(AccordionItemContext)
  if (!i) throw new Error("AccordionContent must be inside <AccordionItem>")
  if (!i.isOpen) return null
  return (
    <div
      data-slot="accordion-content"
      data-state="open"
      className={cn("overflow-hidden pb-3 text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-top-1 duration-150", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
