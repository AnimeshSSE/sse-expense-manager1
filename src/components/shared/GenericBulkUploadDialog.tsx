'use client'

import { useState, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Upload, Download, FileText, CheckCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export type BulkUploadEntity = 'sites' | 'clients' | 'categories' | 'expenses' | 'requisitions' | 'advances'

interface ParsedRow {
  [key: string]: string | string[]
  _errors: string[]
}

interface UploadResult {
  message: string
  success: number
  failed: number
  errors: Array<{ row: number; message: string }>
}

interface GenericBulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entity: BulkUploadEntity
  title?: string
  description?: string
  templateColumns?: string[]
  userId?: string | null
  onSuccess?: () => void
}

const entityConfig: Record<BulkUploadEntity, {
  label: string
  defaultColumns: string[]
  defaultDescription: string
  requiredFields: string[]
  fileName: string
}> = {
  sites: {
    label: 'Sites',
    defaultColumns: ['name', 'code', 'address', 'city', 'state', 'pincode'],
    defaultDescription: 'Upload a CSV file with site data. Required columns: name, code',
    requiredFields: ['name', 'code'],
    fileName: 'sites-upload-template.csv',
  },
  clients: {
    label: 'Clients',
    defaultColumns: ['name', 'code', 'email', 'phone', 'address', 'city', 'state'],
    defaultDescription: 'Upload a CSV file with client data. Required columns: name, code',
    requiredFields: ['name', 'code'],
    fileName: 'clients-upload-template.csv',
  },
  categories: {
    label: 'Categories',
    defaultColumns: ['name', 'code'],
    defaultDescription: 'Upload a CSV file with category data. Required columns: name, code',
    requiredFields: ['name', 'code'],
    fileName: 'categories-upload-template.csv',
  },
  expenses: {
    label: 'Expenses',
    defaultColumns: ['title', 'description', 'amount', 'date', 'category'],
    defaultDescription: 'Upload a CSV file with expense data. Required columns: title, amount, date',
    requiredFields: ['title', 'amount', 'date'],
    fileName: 'expenses-upload-template.csv',
  },
  requisitions: {
    label: 'Requisitions',
    defaultColumns: ['title', 'description', 'vendorName', 'deliveryDate'],
    defaultDescription: 'Upload a CSV file with requisition data. Required columns: title',
    requiredFields: ['title'],
    fileName: 'requisitions-upload-template.csv',
  },
  advances: {
    label: 'Advances',
    defaultColumns: ['title', 'description', 'amount', 'purpose', 'expectedReturnDate'],
    defaultDescription: 'Upload a CSV file with advance data. Required columns: title, amount',
    requiredFields: ['title', 'amount'],
    fileName: 'advances-upload-template.csv',
  },
}

export function GenericBulkUploadDialog({
  open,
  onOpenChange,
  entity,
  title,
  description,
  templateColumns,
  userId,
  onSuccess,
}: GenericBulkUploadDialogProps) {
  const config = entityConfig[entity]
  const columns = templateColumns || config.defaultColumns

  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setFile(null)
    setParsedRows([])
    setUploading(false)
    setProgress(0)
    setCompleted(false)
    setResult(null)
  }

  const handleClose = (opn: boolean) => {
    if (!opn) resetState()
    onOpenChange(opn)
  }

  const parseCSV = useCallback((text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const rows: ParsedRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim())
      const row: ParsedRow = { _errors: [] }
      headers.forEach((header, idx) => {
        row[header] = cols[idx] || ''
      })

      config.requiredFields.forEach(field => {
        const value = row[field]
        if (typeof value !== 'string' || !value.trim()) {
          row._errors.push(`${field} is required`)
        }
      })

      rows.push(row)
    }
    return rows
  }, [config.requiredFields])

  const handleFile = useCallback((f: File) => {
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      setParsedRows(parsed)
    }
    reader.readAsText(f)
  }, [parseCSV])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDownloadTemplate = () => {
    fetch(`/api/${entity}/download-template`)
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = config.fileName
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => {
        // Fallback: generate a simple CSV template in the browser
        const csvContent = columns.join(',') + '\n'
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = config.fileName
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file')
      const formData = new FormData()
      formData.append('file', file)
      if (userId && ['expenses', 'requisitions', 'advances'].includes(entity)) {
        formData.append('userId', userId)
      }
      return fetch(`/api/${entity}/bulk-upload`, {
        method: 'POST',
        body: formData,
      }).then(res => res.json())
    },
    onSuccess: (data: UploadResult) => {
      setResult(data)
      setUploading(false)
      setProgress(100)
      setCompleted(true)
      toast.success(data.message || `${config.label} uploaded successfully`)
      onSuccess?.()
    },
    onError: () => {
      setUploading(false)
      setProgress(0)
      toast.error(`Failed to upload ${config.label.toLowerCase()}`)
    },
  })

  const handleUpload = () => {
    setUploading(true)
    setProgress(20)
    uploadMutation.mutate()
  }

  const validRows = parsedRows.filter(r => r._errors.length === 0)
  const invalidRows = parsedRows.filter(r => r._errors.length > 0)

  const getRowPreviewText = (row: ParsedRow) => {
    const displayCols = columns.slice(0, 3)
    return displayCols
      .map((c) => {
        const value = row[c]
        return typeof value === 'string' && value ? value : '-'
      })
      .join(' · ')
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || `Bulk Upload ${config.label}`}</DialogTitle>
          <DialogDescription>
            {description || config.defaultDescription}
          </DialogDescription>
        </DialogHeader>

        {!completed ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Download CSV template</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1" />
                Template
              </Button>
            </div>

            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">
                {file ? file.name : 'Drag & drop your CSV file here'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
            </div>

            {parsedRows.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Preview ({parsedRows.length} records)</h3>
                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                  {parsedRows.map((row, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-md text-sm border',
                        row._errors.length > 0
                          ? 'border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20'
                          : 'border-border'
                  )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {typeof row[columns[0]] === 'string' && row[columns[0]]
                            ? row[columns[0]]
                            : `Row ${idx + 1}`}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{getRowPreviewText(row)}</p>
                      </div>
                      {row._errors.length > 0 && (
                        <span className="text-xs text-red-600 ml-2 flex-shrink-0">
                          {row._errors[0]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  {validRows.length} valid, {invalidRows.length} with errors
                </div>
              </div>
            )}

            {uploading && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Uploading... {progress}%
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mx-auto">
              <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Upload Complete</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {result?.success || 0} {config.label.toLowerCase()} processed successfully
                {(result?.failed || 0) > 0 && `, ${result?.failed} skipped due to errors`}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {completed ? (
            <Button onClick={() => handleClose(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button
                onClick={handleUpload}
                disabled={!file || parsedRows.length === 0 || uploading}
              >
                {uploading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {uploading ? 'Uploading...' : `Upload ${validRows.length} ${config.label}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
