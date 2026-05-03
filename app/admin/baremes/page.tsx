'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Upload, Download, Search, Trash2, FileSpreadsheet, Calendar } from 'lucide-react'
import { toast } from 'sonner'

interface BareFile {
  id: string
  name: string
  effectiveDate: string
  uploadedAt: string
  multiplicateur?: number
  sheetsCount: number
}

interface SheetData {
  id: string
  name: string
  category: string
  rowCount: number
  colCount: number
  sheetIndex: number
  cellData: string[][]
}

interface FileWithSheets {
  file: {
    id: string
    name: string
    effectiveDate: string
    multiplicateur?: number
    filePath: string
  }
  sheets: SheetData[]
}

export default function BaremesPage() {
  const [files, setFiles] = useState<BareFile[]>([])
  const [selectedFileData, setSelectedFileData] = useState<FileWithSheets | null>(null)
  const [activeSheetId, setActiveSheetId] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/baremes')
      const data = await res.json()
      setFiles(data.files || [])
      // Auto-sélectionner le premier fichier
      if (data.files?.[0] && !selectedFileData) {
        loadFile(data.files[0].id)
      }
    } catch (error) {
      console.error(error)
    }
  }

  // Charger la liste des fichiers
  useEffect(() => {
    fetchFiles()
  }, [])

  const loadFile = async (fileId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/baremes?fileId=${fileId}`)
      const data = await res.json()
      setSelectedFileData(data)
      if (data.sheets?.[0]) {
        setActiveSheetId(data.sheets[0].id)
      }
    } catch (error) {
      toast.error('Failed to load file')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => {
    let file: File | null = null

    if ('dataTransfer' in e) {
      e.preventDefault()
      file = e.dataTransfer.files[0]
    } else {
      file = e.currentTarget.files?.[0] || null
    }

    if (!file || !file.name.endsWith('.xlsx')) {
      toast.error('Only .xlsx files allowed')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/baremes/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await res.json()
      toast.success(`${data.sheetsCount} feuilles importées`)

      await fetchFiles()
      loadFile(data.fileId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
      console.error(error)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (fileId: string) => {
    if (!confirm('Supprimer ce fichier ?')) return

    try {
      const res = await fetch(`/api/baremes/${fileId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')

      toast.success('Fichier supprimé')
      if (selectedFileData?.file.id === fileId) {
        setSelectedFileData(null)
      }
      await fetchFiles()
    } catch (error) {
      toast.error('Delete failed')
    }
  }

  const handleExportSheet = (sheetId: string, sheetName: string) => {
    window.location.href = `/api/baremes/export?sheetId=${sheetId}`
    toast.success(`Téléchargement: ${sheetName}.csv`)
  }

  const handleDownloadOriginal = () => {
    if (selectedFileData?.file.filePath) {
      window.open(selectedFileData.file.filePath, '_blank')
    }
  }

  const activeSheet = useMemo(() => {
    return selectedFileData?.sheets.find((s) => s.id === activeSheetId) || null
  }, [selectedFileData, activeSheetId])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Barèmes ONEM</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload et consultation des barèmes officiels
        </p>
      </div>

      {/* Liste des fichiers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>Fichiers ({files.length})</span>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading}
              />
              <Button disabled={uploading} type="button">
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Upload...' : 'Uploader'}
              </Button>
            </label>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleUpload}
              className="border-2 border-dashed rounded-lg p-12 text-center hover:border-blue-500 transition"
            >
              <FileSpreadsheet className="mx-auto w-12 h-12 text-gray-400 mb-3" />
              <p className="font-medium mb-1">Aucun fichier uploadé</p>
              <p className="text-sm text-gray-500">Glissez un fichier .xlsx ici</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {files.map((f) => (
                <div
                  key={f.id}
                  onClick={() => loadFile(f.id)}
                  className={`p-3 border rounded-lg cursor-pointer transition ${
                    selectedFileData?.file.id === f.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" title={f.name}>
                        {f.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {f.effectiveDate}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {f.sheetsCount} feuilles
                        </Badge>
                        {f.multiplicateur && (
                          <Badge variant="outline" className="text-xs">
                            ×{f.multiplicateur}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(f.id)
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visualisation du fichier */}
      {loading && <p className="text-center py-8 text-gray-500">Chargement...</p>}

      {selectedFileData && !loading && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>{selectedFileData.file.name}</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  En vigueur depuis le {selectedFileData.file.effectiveDate}
                  {selectedFileData.file.multiplicateur &&
                    ` • Multiplicateur: ${selectedFileData.file.multiplicateur}`}
                </p>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher dans le tableau..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-64"
                  />
                </div>
                <Button variant="outline" onClick={handleDownloadOriginal}>
                  <Download className="w-4 h-4 mr-2" />
                  Original
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeSheetId} onValueChange={setActiveSheetId}>
              <div className="overflow-x-auto pb-2">
                <TabsList className="inline-flex w-auto">
                  {selectedFileData.sheets.map((sheet) => (
                    <TabsTrigger key={sheet.id} value={sheet.id} className="text-xs">
                      {sheet.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {selectedFileData.sheets.map((sheet) => (
                <TabsContent key={sheet.id} value={sheet.id} className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{sheet.category}</h3>
                      <p className="text-xs text-gray-500">
                        {sheet.rowCount} lignes × {sheet.colCount} colonnes
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportSheet(sheet.id, sheet.name)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      CSV
                    </Button>
                  </div>

                  <ExcelGrid cellData={sheet.cellData} searchTerm={searchTerm} />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Composant tableau type Excel
function ExcelGrid({
  cellData,
  searchTerm,
}: {
  cellData: string[][]
  searchTerm: string
}) {
  const search = searchTerm.toLowerCase().trim()

  // Highlight la recherche
  const highlightCell = (val: string): React.ReactNode => {
    if (!search || !val) return val
    const lower = val.toLowerCase()
    const idx = lower.indexOf(search)
    if (idx === -1) return val
    return (
      <>
        {val.slice(0, idx)}
        <mark className="bg-yellow-200 px-0.5">{val.slice(idx, idx + search.length)}</mark>
        {val.slice(idx + search.length)}
      </>
    )
  }

  // Détecte si la cellule matche
  const isMatchingRow = (row: string[]): boolean => {
    if (!search) return true
    return row.some((c) => c && c.toLowerCase().includes(search))
  }

  if (!cellData || cellData.length === 0) {
    return <p className="text-center py-8 text-gray-500">Pas de données</p>
  }

  return (
    <div className="border rounded-lg overflow-auto max-h-[600px]">
      <table className="text-sm w-full border-collapse">
        <tbody>
          {cellData.map((row, rIdx) => {
            const matches = isMatchingRow(row)
            return (
              <tr
                key={rIdx}
                className={`${
                  search && !matches ? 'opacity-30' : ''
                } ${rIdx === 0 ? 'bg-gray-100 font-semibold' : 'hover:bg-blue-50'}`}
              >
                <td className="border border-gray-200 px-2 py-1 text-xs text-gray-400 sticky left-0 bg-gray-50 font-mono">
                  {rIdx + 1}
                </td>
                {row.map((cell, cIdx) => {
                  const isError = cell?.startsWith('#')
                  return (
                    <td
                      key={cIdx}
                      className={`border border-gray-200 px-2 py-1 whitespace-nowrap ${
                        isError ? 'text-red-400 italic text-xs' : ''
                      }`}
                    >
                      {isError ? '' : highlightCell(cell || '')}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
