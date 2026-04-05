/**
 * Export utility for CSV, XLS, PDF export
 * All exports are client-side using the data already loaded in the page
 */

// ============ CSV Export ============
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: { key: string; label: string; format?: (val: any, row: T) => string }[],
  filename: string
) {
  const headers = columns.map(c => c.label)
  const rows = data.map(row =>
    columns.map(col => {
      const val = row[col.key]
      const formatted = col.format ? col.format(val, row) : formatCellValue(val)
      const str = String(formatted || '')
      return str.includes(',') || str.includes('\n') || str.includes('"')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(',')
  )

  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}.csv`)
}

// ============ XLS Export ============
export async function exportToXLS<T extends Record<string, any>>(
  data: T[],
  columns: { key: string; label: string; format?: (val: any, row: T) => string }[],
  filename: string
) {
  const XLSX = await import('xlsx')

  const headers = columns.map(c => c.label)
  const rows = data.map(row =>
    columns.map(col => {
      const val = row[col.key]
      return col.format ? col.format(val, row) : formatCellValue(val)
    })
  )

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const colWidths = columns.map((col, i) => {
    const maxLen = Math.max(col.label.length, ...rows.slice(0, 100).map(r => String(r[i] || '').length))
    return { wch: Math.min(maxLen + 2, 50) }
  })
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ============ PDF Export ============
export async function exportToPDF<T extends Record<string, any>>(
  data: T[],
  columns: { key: string; label: string; format?: (val: any, row: T) => string }[],
  filename: string,
  title?: string
) {
  // Dynamic imports for PDF generation
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Apply autoTable plugin
  const autoTable = (autoTableModule as any).default || autoTableModule
  autoTable(doc, {
    startY: title ? 28 : 14,
    head: [columns.map(c => c.label)],
    body: data.map(row =>
      columns.map(col => {
        const val = row[col.key]
        return col.format ? col.format(val, row) : formatCellValue(val)
      })
    ),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 37, 36], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    margin: { top: title ? 28 : 14 },
  })

  if (title) {
    // Title must be added after autoTable to get correct final page count
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(14)
      doc.text(title, 14, 15)
      doc.setFontSize(9)
      doc.setTextColor(128)
      doc.text(`Generated: ${new Date().toLocaleString()} | Total: ${data.length} records`, 14, 22)
      doc.setTextColor(0)
    }
  }

  doc.save(`${filename}.pdf`)
}

// ============ Helpers ============

function formatCellValue(val: any): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'object') {
    if (val instanceof Date) return val.toLocaleDateString()
    if (val.name) return val.name
    return JSON.stringify(val)
  }
  return String(val)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
