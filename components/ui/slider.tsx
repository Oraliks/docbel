"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  disabled?: boolean
  id?: string
}

function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className,
  disabled,
  id,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className={cn("relative flex w-full touch-none select-none items-center py-2", className)}>
      <div className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-input">
        <div
          className="h-full bg-primary transition-[width] duration-100"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      <input
        id={id}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-not-allowed"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-sm transition-transform"
        style={{ left: `calc(${Math.max(0, Math.min(100, pct))}% - 8px)` }}
      />
    </div>
  )
}

export { Slider }
