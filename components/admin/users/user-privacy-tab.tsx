"use client"

import { useEffect, useRef, useState } from "react"
import { Download, Loader2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import type { PrivacyInventory, PrivacyInventoryEntry } from "@/lib/privacy/types"
import { formatNumber } from "@/lib/i18n/format"
import type { Locale } from "@/i18n/locales"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"

type ExportPage = {
  dataset: string
  records: unknown[]
  nextCursor: string | null
  limit: number
}

type ExportProgress = {
  dataset: string
  nextCursor: string | null
  page: number
  downloadUrl: string
}

function UserPrivacyContent({ userId }: { userId: string }) {
  const t = useTranslations("admin.userPrivacy")
  const locale = useLocale() as Locale
  const [inventory, setInventory] = useState<PrivacyInventory | null>(null)
  const [inventoryPending, setInventoryPending] = useState(false)
  const [exportingDataset, setExportingDataset] = useState<string | null>(null)
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)
  const [error, setError] = useState<"inventory" | "export" | null>(null)
  const requests = useRef(new Set<AbortController>())
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const activeRequests = requests.current
    return () => {
      mounted.current = false
      for (const request of activeRequests) request.abort()
      activeRequests.clear()
    }
  }, [])

  function createRequest(): AbortController {
    const controller = new AbortController()
    requests.current.add(controller)
    return controller
  }

  async function loadInventory() {
    if (inventoryPending || exportingDataset) return
    setInventoryPending(true)
    setError(null)
    setExportProgress(null)
    const controller = createRequest()
    try {
      const response = await fetch(
        `/api/admin/privacy/accounts/${encodeURIComponent(userId)}/inventory`,
        { cache: "no-store", signal: controller.signal },
      )
      if (!response.ok) throw new Error("inventory_request_failed")
      const result = (await response.json()) as PrivacyInventory
      if (!mounted.current || controller.signal.aborted) return
      setInventory(result)
    } catch {
      if (!mounted.current || controller.signal.aborted) return
      setError("inventory")
    } finally {
      requests.current.delete(controller)
      if (mounted.current && !controller.signal.aborted) setInventoryPending(false)
    }
  }

  function downloadPage(url: string) {
    // Native HTTP downloads also work in embedded browsers that cannot save Blob URLs.
    // The API rechecks the admin's access when it serves the file.
    const link = document.createElement("a")
    link.href = url
    link.download = ""
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  async function exportPage(dataset: string, cursor: string | null, pageNumber: number) {
    if (inventoryPending || exportingDataset) return
    setExportingDataset(dataset)
    setError(null)
    const controller = createRequest()
    const query = new URLSearchParams({ dataset, limit: "100" })
    if (cursor) query.set("cursor", cursor)
    const downloadUrl = `/api/admin/privacy/accounts/${encodeURIComponent(userId)}/export?${query}`
    try {
      const response = await fetch(
        downloadUrl,
        { cache: "no-store", signal: controller.signal },
      )
      if (!response.ok) throw new Error("export_request_failed")
      const result = (await response.json()) as ExportPage
      if (
        !mounted.current ||
        controller.signal.aborted ||
        result.dataset !== dataset ||
        !Array.isArray(result.records)
      ) return

      downloadPage(downloadUrl)
      setExportProgress({ dataset, nextCursor: result.nextCursor, page: pageNumber, downloadUrl })
      toast.success(t("exportSuccess", { dataset, page: pageNumber }))
    } catch {
      if (!mounted.current || controller.signal.aborted) return
      setError("export")
    } finally {
      requests.current.delete(controller)
      if (mounted.current && !controller.signal.aborted) setExportingDataset(null)
    }
  }

  const totalRecords = inventory?.entries.reduce((sum, entry) => sum + entry.count, 0) ?? 0
  const exportableDomains = inventory?.entries.filter(
    (entry) => entry.count > 0 && entry.exportDataset,
  ).length ?? 0

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="size-5 text-primary" />
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
          </div>
          <Button
            type="button"
            onClick={() => void loadInventory()}
            disabled={inventoryPending || exportingDataset !== null}
            className="gap-1.5"
          >
            {inventoryPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : inventory ? (
              <RefreshCw className="size-4" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            {inventory ? t("reloadInventory") : t("loadInventory")}
          </Button>
        </div>

        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50/60 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
          <p className="flex items-start gap-2 font-medium">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {t("accountScopeWarning")}
          </p>
          <p className="mt-1 pl-6 text-xs">{t("reviewWarning")}</p>
          <p className="mt-1 pl-6 text-xs">{t("deletionUnavailable")}</p>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error === "inventory" ? t("inventoryError") : t("exportError")}
          </p>
        )}
      </section>

      {!inventory && !inventoryPending && (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      )}

      {inventory && (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label={t("summaryDomains")} value={formatNumber(inventory.entries.length, locale)} />
            <SummaryCard label={t("summaryRecords")} value={formatNumber(totalRecords, locale)} />
            <SummaryCard label={t("summaryExportable")} value={formatNumber(exportableDomains, locale)} />
          </section>

          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">{t("domainsTitle")}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("pageLimit")}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t("columnDomain")}</th>
                    <th className="px-4 py-2 font-medium">{t("columnRelation")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("columnCount")}</th>
                    <th className="px-4 py-2 font-medium">{t("columnScope")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("columnExport")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inventory.entries.map((entry) => (
                    <InventoryRow
                      key={`${entry.source}:${entry.relation}`}
                      entry={entry}
                      count={formatNumber(entry.count, locale)}
                      disabled={inventoryPending || exportingDataset !== null}
                      loading={exportingDataset === entry.exportDataset}
                      onExport={(dataset) => void exportPage(dataset, null, 1)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {exportProgress && (
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">
                  {t("lastExport", {
                    dataset: exportProgress.dataset,
                    page: exportProgress.page,
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {exportProgress.nextCursor ? t("morePages") : t("lastPage")}
                </p>
                <a
                  href={exportProgress.downloadUrl}
                  download
                  className={buttonVariants({ variant: "link", className: "mt-1 px-0" })}
                >
                  {t("downloadAgain")}
                </a>
              </div>
              {exportProgress.nextCursor && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={inventoryPending || exportingDataset !== null}
                  onClick={() => void exportPage(
                    exportProgress.dataset,
                    exportProgress.nextCursor,
                    exportProgress.page + 1,
                  )}
                  className="gap-1.5"
                >
                  {exportingDataset === exportProgress.dataset ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  {t("exportNextPage", { page: exportProgress.page + 1 })}
                </Button>
              )}
            </section>
          )}

          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">{t("limitsTitle")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("limitsDescription")}</p>
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {inventory.unresolvedScopes.map((scope) => (
                <li key={scope.source} className="rounded-lg border bg-muted/20 px-3 py-2">
                  <code className="text-xs font-medium">{scope.source}</code>
                  <p className="mt-1 text-xs text-muted-foreground">{t("limitReviewRequired")}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

export function UserPrivacyTab({ userId }: { userId: string }) {
  return <UserPrivacyContent key={userId} userId={userId} />
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function InventoryRow({
  entry,
  count,
  disabled,
  loading,
  onExport,
}: {
  entry: PrivacyInventoryEntry
  count: string
  disabled: boolean
  loading: boolean
  onExport: (dataset: string) => void
}) {
  const t = useTranslations("admin.userPrivacy")
  return (
    <tr>
      <td className="px-4 py-2.5 font-medium"><code>{entry.source}</code></td>
      <td className="px-4 py-2.5 text-muted-foreground"><code>{entry.relation}</code></td>
      <td className="px-4 py-2.5 text-right tabular-nums">{count}</td>
      <td className="px-4 py-2.5">
        <Badge variant={entry.policyStatus === "review_required" ? "warning" : "outline"}>
          {entry.policyStatus === "review_required" ? t("scopeReview") : t("scopeAccount")}
        </Badge>
      </td>
      <td className="px-4 py-2.5 text-right">
        {entry.exportDataset && entry.count > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onExport(entry.exportDataset as string)}
            className="gap-1.5"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {t("exportFirstPage")}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{t("notExportable")}</span>
        )}
      </td>
    </tr>
  )
}
