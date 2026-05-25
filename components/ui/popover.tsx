"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface PopoverContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null)

function usePopover() {
  const ctx = React.useContext(PopoverContext)
  if (!ctx) throw new Error("Popover components must be used inside <Popover>")
  return ctx
}

interface PopoverProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Popover({ open: openProp, defaultOpen, onOpenChange, children }: PopoverProps) {
  const isControlled = openProp !== undefined
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false)
  const open = isControlled ? openProp : internalOpen
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange]
  )

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef }}>
      {children}
    </PopoverContext.Provider>
  )
}

interface PopoverTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean
}

const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  function PopoverTrigger({ children, onClick, asChild, ...props }, ref) {
    const { open, setOpen, triggerRef } = usePopover()

    const setRefs = (node: HTMLButtonElement | null) => {
      triggerRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    }

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{
        ref?: React.Ref<HTMLElement>
        onClick?: (e: React.MouseEvent) => void
        "aria-expanded"?: boolean
      }>
      return React.cloneElement(child, {
        ref: setRefs as unknown as React.Ref<HTMLElement>,
        onClick: (e: React.MouseEvent) => {
          child.props.onClick?.(e)
          setOpen(!open)
        },
        "aria-expanded": open,
      })
    }

    return (
      <button
        ref={setRefs}
        type="button"
        aria-expanded={open}
        data-state={open ? "open" : "closed"}
        onClick={(e) => {
          onClick?.(e)
          setOpen(!open)
        }}
        {...props}
      >
        {children}
      </button>
    )
  }
)

interface PopoverContentProps extends React.ComponentProps<"div"> {
  align?: "start" | "center" | "end"
  side?: "top" | "right" | "bottom" | "left"
  sideOffset?: number
}

function PopoverContent({
  className,
  children,
  align = "center",
  side = "bottom",
  sideOffset = 4,
  ...props
}: PopoverContentProps) {
  const { open, setOpen, triggerRef } = usePopover()
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState<{ top: number; left: number; maxWidth: number }>({
    top: 0,
    left: 0,
    maxWidth: 0,
  })

  // Position the popover relative to the trigger.
  //
  // On utilise un rAF imbriqué dans useLayoutEffect : le 1er render mounte
  // l'élément, le browser fait son layout (incluant les `min()` Tailwind sur
  // la width), puis on mesure dans la frame suivante. Sans ça, le 1er
  // getBoundingClientRect peut renvoyer une largeur "intrinsic" non clampée
  // par les CSS responsive — bug observé sur le UsageBadge popover qui
  // dépassait à droite sur écran étroit.
  //
  // On force aussi un `maxWidth` inline qui sera appliqué AVANT la mesure
  // suivante pour garantir un clamp robuste, peu importe les CSS du caller.
  React.useLayoutEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const content = contentRef.current
    if (!trigger || !content) return

    const reposition = () => {
      if (!triggerRef.current || !contentRef.current) return
      const trig = triggerRef.current
      const cont = contentRef.current
      const vw = window.innerWidth
      const vh = window.innerHeight

      // Clamp maxWidth ABSOLU dès le départ : on n'autorise jamais le popover
      // à dépasser viewport-16px (8px de marge de chaque côté).
      const maxAllowedWidth = Math.max(160, vw - 16)
      // Applique maxWidth inline AVANT de mesurer, pour forcer le browser à
      // recalculer la largeur si le content intrinsic était plus large.
      cont.style.maxWidth = `${maxAllowedWidth}px`

      const triggerRect = trig.getBoundingClientRect()
      const contentRect = cont.getBoundingClientRect()

      let top = 0
      let left = 0

      if (side === "bottom") top = triggerRect.bottom + sideOffset
      else if (side === "top") top = triggerRect.top - contentRect.height - sideOffset
      else if (side === "left") {
        top = triggerRect.top
        left = triggerRect.left - contentRect.width - sideOffset
      } else if (side === "right") {
        top = triggerRect.top
        left = triggerRect.right + sideOffset
      }

      if (side === "top" || side === "bottom") {
        if (align === "start") left = triggerRect.left
        else if (align === "end") left = triggerRect.right - contentRect.width
        else left = triggerRect.left + (triggerRect.width - contentRect.width) / 2
      }

      // Clamp inside viewport
      left = Math.max(8, Math.min(left, vw - contentRect.width - 8))
      top = Math.max(8, Math.min(top, vh - contentRect.height - 8))

      setPosition({ top, left, maxWidth: maxAllowedWidth })
    }

    // Double rAF pour attendre que le browser ait appliqué le layout final
    // (incluant les CSS responsive min/max-width des classes Tailwind).
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(reposition)
      ;(reposition as unknown as { _raf2: number })._raf2 = raf2
    })

    // Recalcule la position au resize fenêtre (rotation mobile, redim browser).
    window.addEventListener("resize", reposition)

    return () => {
      cancelAnimationFrame(raf1)
      const raf2 = (reposition as unknown as { _raf2?: number })._raf2
      if (raf2) cancelAnimationFrame(raf2)
      window.removeEventListener("resize", reposition)
    }
  }, [open, side, align, sideOffset, triggerRef])

  // Close on click outside / escape
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (contentRef.current?.contains(t)) return
      if (triggerRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("mousedown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open, setOpen, triggerRef])

  if (!open) return null

  return (
    <div
      ref={contentRef}
      data-slot="popover-content"
      data-state={open ? "open" : "closed"}
      data-side={side}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        // maxWidth inline = garde-fou contre tout overflow viewport, peu
        // importe ce que le caller met en className. 0 = pas encore mesuré
        // (premier paint avant le rAF).
        maxWidth: position.maxWidth || undefined,
        zIndex: 50,
        // Garde le popover invisible avant la 1ère mesure pour éviter un
        // flash mal positionné.
        visibility: position.maxWidth === 0 ? "hidden" : undefined,
      }}
      className={cn(
        "min-w-[8rem] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg outline-none animate-in fade-in-0 zoom-in-95 duration-100",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
