'use client'

import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'expenses' | 'advances' | 'clients' | 'sites' | 'categories' | 'users'
}

const TYPE_LABELS: Record<string, string> = {
  expenses: 'Expenses',
  advances: 'Advances',
  clients: 'Clients',
  sites: 'Sites',
  categories: 'Categories',
  users: 'Users',
}

const TYPE_COLUMNS: Record<string, string> = {
  expenses: 'siteName, categoryName, description, amount, expenseDate, paymentMethod',
  advances: 'siteName, amount, purpose, notes, paymentDate',
  clients: 'name, description',
  sites: 'name, clientName, location, description, budget',
  categories: 'name, type, description',
  users: 'name, email, role, password',
}

export function BulkUploadDialog({ open, onOpenChange, type }: BulkUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<{ success: string[]; errors: string[] } | null>(null)

  const isAdminType = ['clients', 'sites', 'categories', 'users'].includes(type)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      const ext = selected.name.split('.').pop()?.toLowerCase()
      if (ext !== 'xlsx' && ext !== 'csv') {
        toast.error('Please upload an xlsx or csv file')
        return
      }
      setFile(selected)
      setResults(null)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      if (type === 'expenses') {
        const blob = await api.getBulkUploadTemplate('expenses')
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'expenses-template.xlsx'
        a.click()
        URL.revokeObjectURL(url)
      } else if (type === 'advances') {
        const blob = await api.getAdvanceBulkUploadTemplate()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'advances-template.xlsx'
        a.click()
        URL.revokeObjectURL(url)
      } else {
        // Generate template on-the-fly for admin types
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const XLSX = require('xlsx')
        const columns = TYPE_COLUMNS[type].split(', ')
        const ws = XLSX.utils.json_to_sheet([{ [columns[0]]: 'sample' }])
        // Add headers from column names
        const wb = XLSX.utils.book_new()
        const headerRow: Record<string, string> = {}
        columns.forEach(col => { headerRow[col] = '' })
        XLSX.utils.sheet_add_json(ws, [headerRow], { origin: 'A1' })
        XLSX.utils.book_append_sheet(wb, ws, 'Template')
        XLSX.writeFile(wb, `${type}-template.xlsx`)
      }
    } catch {
      toast.error('Failed to download template')
    }
  }

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected')
      setUploading(true)
      setProgress(10)

      if (isAdminType) {
        // Use the generic bulk-upload API
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', type)
        setProgress(40)
        const result = await api.bulkUpload(formData)
        setProgress(100)
        return result as { success: string[]; errors: string[] }
      } else if (type === 'expenses') {
        // Use existing expenses bulk-upload API
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/expenses/bulk-upload', { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Upload failed' }))
          throw new Error(err.error || 'Upload failed')
        }
        setProgress(100)
        const result = await res.json()
        return {
          success: Array.isArray(result.success) ? result.success : [`Created ${result.created || 0} expenses`],
          errors: result.errors || [],
        } as { success: string[]; errors: string[] }
      } else if (type === 'advances') {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/advances/bulk-upload', { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Upload failed' }))
          throw new Error(err.error || 'Upload failed')
        }
        setProgress(100)
        const result = await res.json()
        return {
          success: Array.isArray(result.success) ? result.success : [`Created ${result.created || 0} advances`],
          errors: result.errors || [],
        } as { success: string[]; errors: string[] }
      }
      throw new Error('Unknown type')
    },
    onSuccess: (data) => {
      setResults(data)
      toast.success(`Upload complete: ${data.success.length} success, ${data.errors.length} errors`)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
    onSettled: () => {
      setUploading(false)
    },
  })

  const handleClose = () => {
    setFile(null)
    setResults(null)
    setProgress(0)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber-500" />
            Bulk Upload {TYPE_LABELS[type]}
          </DialogTitle>
          <DialogDescription>
            Upload an xlsx or csv file with the following columns: {TYPE_COLUMNS[type]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!results ? (
            <>
              {/* Download Template */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={handleDownloadTemplate}
              >
                <Download className="w-4 h-4" />
                Download Template
              </Button>

              {/* File Picker */}
              <div
                className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-amber-300 hover:bg-amber-50/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-navy-900">{file.name}</p>
                      <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Click to select xlsx or csv file</p>
                  </>
                )}
              </div>

              {/* Progress */}
              {uploading && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-slate-500 text-center">Uploading... {progress}%</p>
                </div>
              )}

              {/* Upload Button */}
              <Button
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                disabled={!file || uploading}
                onClick={() => uploadMutation.mutate()}
              >
                {uploading ? 'Uploading...' : 'Upload File'}
              </Button>
            </>
          ) : (
            /* Results */
            <div className="space-y-3">
              <div className="flex items-center gap-4 justify-center">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-600">{results.success.length} Success</span>
                </div>
                {results.errors.length > 0 && (
                  <div className="flex items-center gap-1">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="text-sm font-semibold text-red-600">{results.errors.length} Errors</span>
                  </div>
                )}
              </div>

              {/* Success list */}
              {results.success.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-emerald-100 bg-emerald-50/50">
                  {results.success.map((s, i) => (
                    <p key={i} className="text-xs text-emerald-700 px-3 py-1.5 border-b border-emerald-100 last:border-0">{s}</p>
                  ))}
                </div>
              )}

              {/* Errors list */}
              {results.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-red-100 bg-red-50/50">
                  {results.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-700 px-3 py-1.5 border-b border-red-100 last:border-0 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      {typeof e === 'string' ? e : JSON.stringify(e)}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setResults(null)}>
                  Upload Another
                </Button>
                <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={handleClose}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
