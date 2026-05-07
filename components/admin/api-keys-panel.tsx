"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Copy, Trash2, Plus } from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

interface ApiKey {
  id: string
  key?: string
  keyPreview?: string
  name: string
  active: boolean
  lastUsedAt: string | null
  createdAt: string
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return "a l'instant"
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)}h`
  if (seconds < 604800) return `il y a ${Math.floor(seconds / 86400)}j`

  return date.toLocaleDateString("fr-FR")
}

export function ApiKeysPanel() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState("")
  const [loading, setLoading] = useState(false)
  const [newKey, setNewKey] = useState<{ key: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchApiKeys()
  }, [])

  async function fetchApiKeys() {
    try {
      const res = await fetch("/api/admin/api-keys")
      if (res.ok) {
        const data = await res.json()
        setApiKeys(data.data || [])
      }
    } catch (error) {
      console.error("Failed to fetch API keys:", error)
    }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) return

    setLoading(true)
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      })

      if (res.ok) {
        const data = await res.json()
        setNewKey(data.data)
        setNewKeyName("")
        await fetchApiKeys()
      }
    } catch (error) {
      console.error("Failed to create API key:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteKey(id: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setDeleteId(null)
        await fetchApiKeys()
      }
    } catch (error) {
      console.error("Failed to delete API key:", error)
    } finally {
      setDeleting(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function getKeyLabel(key: ApiKey) {
    return key.keyPreview || key.key || "Masquee"
  }

  return (
    <div className="space-y-6">
      {newKey && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900">
          <CardHeader>
            <CardTitle className="text-green-900 dark:text-green-200">Cle API creee</CardTitle>
            <CardDescription className="text-green-800 dark:text-green-300">
              Copiez cette cle maintenant. Vous ne pourrez plus la voir ensuite.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded border border-green-200 dark:border-green-900 bg-card p-3 font-mono text-sm">
              {newKey.key}
            </div>
            <Button
              onClick={() => copyToClipboard(newKey.key)}
              className="w-full"
              variant="default"
            >
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "Copiee" : "Copier la cle"}
            </Button>
            <Button
              onClick={() => setNewKey(null)}
              variant="outline"
              className="w-full"
            >
              Fermer
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cles API</CardTitle>
              <CardDescription>Gerez vos cles d&apos;acces aux APIs publiques</CardDescription>
            </div>
            <Dialog>
              <DialogTrigger className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                Nouvelle cle
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Creer une nouvelle cle API</DialogTitle>
                  <DialogDescription>
                    Donnez un nom a votre cle pour l&apos;identifier facilement
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Ex: External Partner, Mobile App"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                  <Button
                    onClick={handleCreateKey}
                    disabled={loading || !newKeyName.trim()}
                    className="w-full"
                  >
                    {loading ? "Creation..." : "Creer"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Cle</TableHead>
                  <TableHead>Creee</TableHead>
                  <TableHead>Dernier usage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-sm">{getKeyLabel(key)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelativeTime(key.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.lastUsedAt ? formatRelativeTime(key.lastUsedAt) : "Jamais"}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog open={deleteId === key.id} onOpenChange={(open) => !open && setDeleteId(null)}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(key.id)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer la cle API ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              La cle &quot;{key.name}&quot; sera supprimee definitivement. Les applications
                              l&apos;utilisant ne pourront plus acceder aux APIs.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="flex justify-end gap-2">
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteKey(key.id)}
                              disabled={deleting}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {deleting ? "Suppression..." : "Supprimer"}
                            </AlertDialogAction>
                          </div>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Aucune cle API creee pour le moment
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Utilisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="rounded bg-muted p-2 font-mono">
              Authorization: Bearer &lt;YOUR_API_KEY&gt;
            </p>
          </div>
          <div>
            <p className="mb-1 font-medium">Exemple :</p>
            <p className="overflow-auto rounded bg-muted p-2 font-mono text-xs">
              curl -H &quot;Authorization: Bearer api_...&quot; \
            </p>
            <p className="rounded bg-muted p-2 font-mono text-xs">
              https://your-domain.com/api/public/commissions
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
