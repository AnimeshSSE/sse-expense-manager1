'use client'

import { useState, useRef, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Upload, Download, FileText, CheckCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ParsedUser {
  name: string
  email: string
  role: string
  department: string
  employeeId: string
  errors: string[]
}

interface UploadResult {
  message: string
  success: number
  failed: number
  errors: Array<{ row: number; message: string }>
}

interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BulkUploadDialog({ open, onOpenChange }: BulkUploadDialogProps) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setFile(null)
    setParsedUsers([])
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
    const users: ParsedUser[] = []

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim())
      const row: ParsedUser = {
        name: cols[0] || '',
        email: cols[1] || '',
        role: cols[2] || 'EMPLOYEE',
        department: cols[3] || '',
        employeeId: cols[4] || '',
        errors: [],
      }
      if (!row.name || !row.email) {
        row.errors.push('Name and email are required')
      }
      if (row.email && !row.email.includes('@')) {
        row.errors.push('Invalid email format')
      }
      users.push(row)
    }
    return users
  }, [])

  const handleFile = useCallback((f: File) => {
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      setParsedUsers(parsed)
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
    fetch('/api/users/download-template')
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'user-upload-template.csv'
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file')
      const formData = new FormData()
      formData.append('file', file)
      return fetch('/api/users/bulk-upload', {
        method: 'POST',
        body: formData,
      }).then(res => res.json())
    },
    onSuccess: (data: UploadResult) => {
      setResult(data)
      setUploading(false)
      setProgress(100)
      setCompleted(true)
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(data.message || 'Upload complete')
    },
    onError: () => {
      setUploading(false)
      setProgress(0)
      toast.error('Failed to upload users')
    },
  })

  const handleUpload = () => {
    setUploading(true)
    setProgress(20)
    uploadMutation.mutate()
  }

  const validUsers = parsedUsers.filter(u => u.errors.length === 0)
  const invalidUsers = parsedUsers.filter(u => u.errors.length > 0)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Users</DialogTitle>
          <DialogDescription>
            Upload a CSV file with user data. The file should include columns: name, email, role, department, employeeId
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

            {parsedUsers.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Preview ({parsedUsers.length} records)</h3>
                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                  {parsedUsers.map((user, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-md text-sm border',
                        user.errors.length > 0 ? 'border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20' : 'border-border'
                      )}
                    >
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email} · {user.role} · {user.department}</p>
                      </div>
                      {user.errors.length > 0 && (
                        <span className="text-xs text-red-600">
                          {user.errors[0]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  {validUsers.length} valid, {invalidUsers.length} with errors
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
                {result?.success || 0} users created successfully
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
                disabled={!file || parsedUsers.length === 0 || uploading}
              >
                {uploading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {uploading ? 'Uploading...' : `Upload ${validUsers.length} Users`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
