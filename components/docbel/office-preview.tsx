"use client"

import { useEffect, useState } from "react"
import { Loader2, AlertCircle } from "lucide-react"

type Mode = "docx" | "xlsx"

interface OfficePreviewProps {
  url: string
  mode: Mode
}

interface SheetData {
  name: string
  rows: string[][]
}

// Render docx and xlsx files inside the browser. The conversion libraries are
// dynamically imported so they don't ship in the main bundle when nobody opens
// a preview.
export function OfficePreview({ url, mode }: OfficePreviewProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState<string>("")
  const [html, setHtml] = useState<string>("")
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [activeSheet, setActiveSheet] = useState(0)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        setStatus("loading")
        setErrorMsg("")
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buffer = await res.arrayBuffer()
        if (cancelled) return

        if (mode === "docx") {
          const mammoth = await import("mammoth")
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
          if (cancelled) return
          setHtml(result.value || "<p><em>Document vide</em></p>")
        } else {
          const XLSX = await import("xlsx")
          const wb = XLSX.read(buffer, { type: "array" })
          const all: SheetData[] = wb.SheetNames.map((name) => {
            const ws = wb.Sheets[name]
            const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
              header: 1,
              defval: "",
              raw: false,
            })
            // Cap to a reasonable preview size — full sheets can be huge.
            const capped = rows.slice(0, 100).map((r) => r.slice(0, 30))
            return { name, rows: capped }
          })
          if (cancelled) return
          setSheets(all)
          setActiveSheet(0)
        }

        setStatus("ready")
      } catch (error) {
        if (cancelled) return
        console.error("OfficePreview error:", error)
        setErrorMsg(error instanceof Error ? error.message : "Erreur inconnue")
        setStatus("error")
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [url, mode])

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center w-full h-[400px] text-sm text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Génération de l&apos;aperçu...
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center w-full h-[400px] text-sm text-muted-foreground gap-2">
        <AlertCircle className="w-6 h-6 text-orange-500" />
        <p>Aperçu impossible à générer</p>
        {errorMsg && <code className="text-[11px]">{errorMsg}</code>}
      </div>
    )
  }

  if (mode === "docx") {
    return (
      <div
        className="docx-preview prose prose-sm max-w-none overflow-auto w-full max-h-[600px] p-4 bg-card text-foreground"
        // mammoth output is structural HTML produced from a controlled docx parse;
        // it does not contain user-generated <script> tags.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  const sheet = sheets[activeSheet]
  return (
    <div className="flex flex-col gap-2 w-full max-h-[600px] overflow-hidden">
      {sheets.length > 1 && (
        <div className="flex gap-1 flex-wrap border-b border-border pb-2">
          {sheets.map((s, idx) => (
            <button
              key={s.name}
              onClick={() => setActiveSheet(idx)}
              className={`text-xs px-2 py-1 rounded ${
                idx === activeSheet
                  ? "bg-emerald-500/15 text-emerald-600 font-medium"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-auto border border-border rounded">
        <table className="text-xs border-collapse w-full">
          <tbody>
            {sheet?.rows.map((row, rIdx) => (
              <tr key={rIdx} className={rIdx === 0 ? "bg-muted font-medium" : ""}>
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className="border border-border px-2 py-1 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis"
                    title={String(cell)}
                  >
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sheet && sheet.rows.length >= 100 && (
        <p className="text-[11px] text-muted-foreground">
          Aperçu limité aux 100 premières lignes.
        </p>
      )}
    </div>
  )
}
