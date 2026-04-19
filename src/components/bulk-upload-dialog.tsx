'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Upload, Download, FileSpreadsheet, X, Loader2, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface BulkUploadResult {
  success: boolean
  created: number
  errors: { row: number; error: string }[]
}

interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'expenses' | 'advances'
  onSuccess: () => void
}

export function BulkUploadDialog({ open, onOpenChange, type, onSuccess }: BulkUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<BulkUploadResult | null>(null)
  const [preview, setPreview] = useState<{ headers: string[]; rowCount: number } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const title = type === 'expenses' ? 'Bulk Upload Expenses' : 'Bulk Upload Advances'
  const acceptedTypes = '.xlsx,.xls,.csv'

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile) return

    // Validate file type
    const ext = selectedFile.name.split('.').pop()?.toLowerCase()
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      toast({ title: 'Invalid file', description: 'Please upload xlsx, xls, or csv files only', variant: 'destructive' })
      return
    }

    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 5MB', variant: 'destructive' })
      return
    }

    setFile(selectedFile)
    setResult(null)

    // Preview: parse headers and row count using xlsx
    try {
      const XLSX = await import('xlsx')
      const buffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
      if (jsonData.length > 0) {
        const headers = jsonData[0].map((h: any) => String(h || '').trim()).filter(Boolean)
        const rowCount = jsonData.length - 1 // exclude header
        setPreview({ headers, rowCount })
      }
    } catch {
      toast({ title: 'Parse error', description: 'Could not preview file. It may be corrupted.', variant: 'destructive' })
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) handleFileSelect(droppedFile)
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const endpoint = type === 'expenses'
        ? '/api/expenses/bulk-upload'
        : '/api/advances/bulk-upload'

      const res = await fetch(endpoint, { method: 'POST', body: formData })
      const data: BulkUploadResult = await res.json()

      if (!res.ok) {
        toast({ title: 'Upload failed', description: data?.errors?.[0]?.error || 'Unknown error', variant: 'destructive' })
        return
      }

      setResult(data)

      if (data.created > 0) {
        toast({
          title: 'Upload Complete',
          description: `${data.created} ${type} uploaded successfully${data.errors.length > 0 ? ` with ${data.errors.length} errors` : ''}`,
        })
        onSuccess()
      }

      if (data.created === 0 && data.errors.length > 0) {
        toast({ title: 'Upload failed', description: 'All rows had errors. Check the error list.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Upload failed', description: 'Network error. Please try again.', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadTemplate = async () => {
    const endpoint = type === 'expenses'
      ? '/api/expenses/bulk-upload/template'
      : '/api/advances/bulk-upload/template'

    try {
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = type === 'expenses' ? 'expense-bulk-upload-template.xlsx' : 'advance-bulk-upload-template.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'Template downloaded', description: 'Fill in your data and upload' })
    } catch {
      toast({ title: 'Download failed', description: 'Could not download template', variant: 'destructive' })
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const expectedHeaders = type === 'expenses'
    ? ['Site Name', 'Category Name', 'Amount', 'Description', 'Expense Date', 'Seller Name', 'Invoice Number', 'Payment Method', 'Notes']
    : ['Site Name', 'Amount', 'Purpose', 'Notes']

  const requiredHeaders = type === 'expenses'
    ? ['Site Name', 'Category Name', 'Amount', 'Description', 'Expense Date']
    : ['Site Name', 'Amount', 'Purpose']

  return (
    <Dialog open={open} onOpenChange={handleClose} modal>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Upload an xlsx, xls, or csv file with {type} data. Max 500 rows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template Button */}
          <div className="flex items-center justify-between bg-stone-50 p-3 rounded-lg">
            <div className="text-sm">
              <span className="font-medium text-stone-700">Step 1:</span>{' '}
              <span className="text-stone-500">Download template, fill in your data</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Template
            </Button>
          </div>

          {/* File Upload Area */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-stone-700">Step 2: Upload your file</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                dragActive
                  ? 'border-stone-900 bg-stone-50'
                  : file
                    ? 'border-green-300 bg-green-50'
                    : 'border-stone-300 hover:border-stone-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedTypes}
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-stone-900">{file.name}</p>
                    <p className="text-xs text-stone-500">
                      {(file.size / 1024).toFixed(1)} KB
                      {preview && ` · ${preview.rowCount} data rows · ${preview.headers.length} columns`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 ml-2"
                    onClick={(e) => { e.stopPropagation(); reset() }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 mx-auto text-stone-400 mb-2" />
                  <p className="text-sm text-stone-600 font-medium">
                    Drag & drop or click to upload
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    Supports .xlsx, .xls, .csv (max 5MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Preview: Header validation */}
          {preview && !result && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-stone-700">Step 3: Preview & verify</Label>
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-stone-50 px-3 py-2 border-b">
                  <p className="text-xs text-stone-600">
                    <span className="font-medium">{preview.rowCount}</span> rows detected with{' '}
                    <span className="font-medium">{preview.headers.length}</span> columns
                  </p>
                </div>
                <div className="p-3 flex flex-wrap gap-1.5">
                  {expectedHeaders.map((h) => {
                    const found = preview.headers.some(
                      (ph) => ph.toLowerCase().replace(/[\s_]+/g, '') === h.toLowerCase().replace(/[\s_]+/g, '')
                    )
                    const isRequired = requiredHeaders.includes(h)
                    return (
                      <Badge
                        key={h}
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          found
                            ? 'border-green-300 bg-green-50 text-green-700'
                            : isRequired
                              ? 'border-red-300 bg-red-50 text-red-700'
                              : 'border-stone-300 bg-stone-50 text-stone-400'
                        }`}
                      >
                        {found ? <CheckCircle2 className="w-2.5 h-2.5 mr-0.5 inline" /> : null}
                        {!found && isRequired ? <AlertCircle className="w-2.5 h-2.5 mr-0.5 inline" /> : null}
                        {h}
                        {isRequired && !found && <span className="text-red-500 ml-0.5">*</span>}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Upload Results */}
          {result && (
            <div className="space-y-3">
              {result.created > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      {result.created} {type} created successfully
                    </p>
                  </div>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="px-3 py-2 border-b border-amber-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <p className="text-xs font-medium text-amber-800">
                      {result.errors.length} row(s) had errors and were skipped
                    </p>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-16">Row</TableHead>
                          <TableHead className="text-xs">Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.errors.map((err, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-medium">{err.row}</TableCell>
                            <TableCell className="text-xs text-red-700">{err.error}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="bg-stone-900 hover:bg-stone-800"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {file ? `(${preview?.rowCount || 0} rows)` : ''}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
