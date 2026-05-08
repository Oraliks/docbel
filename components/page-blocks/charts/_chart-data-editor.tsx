'use client'

import { Input } from '@/components/ui/input'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'

export interface ChartDataPoint {
  label: string
  value: number
}

export function ChartDataEditor({
  data,
  onChange,
}: {
  data: ChartDataPoint[]
  onChange: (data: ChartDataPoint[]) => void
}) {
  return (
    <RepeaterList<ChartDataPoint>
      items={data}
      onChange={onChange}
      render={(it, set) => (
        <div className="grid grid-cols-2 gap-1.5">
          <Input
            value={it.label}
            onChange={(e) => set({ label: e.target.value })}
            placeholder="Libellé"
            className="h-8 text-xs"
          />
          <Input
            type="number"
            value={it.value}
            onChange={(e) => set({ value: Number(e.target.value) })}
            placeholder="0"
            className="h-8 text-xs"
          />
        </div>
      )}
      addItem={() => ({ label: 'Nouveau', value: 0 })}
    />
  )
}
