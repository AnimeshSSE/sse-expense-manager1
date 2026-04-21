import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { format } from 'date-fns'

export async function POST() {
  try {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    const [todayExpenses, todayAdvances, todayRequisitions, users] = await Promise.all([
      db.expense.findMany({
        where: { createdAt: { gte: startOfDay, lt: endOfDay } },
        include: {
          site: { include: { client: { select: { name: true } } } },
          category: { select: { name: true } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.advance.findMany({
        where: { createdAt: { gte: startOfDay, lt: endOfDay } },
        include: {
          site: { include: { client: { select: { name: true } } } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.requisition.findMany({
        where: { createdAt: { gte: startOfDay, lt: endOfDay } },
        include: {
          site: { include: { client: { select: { name: true } } } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.user.findMany({
        where: {
          role: { in: ['ADMIN', 'ACCOUNTANT'] },
          isActive: true,
        },
        select: { name: true, email: true },
      }),
    ])

    const totalExpenses = todayExpenses.reduce((sum, e) => sum + e.amount, 0)
    const totalAdvances = todayAdvances.reduce((sum, a) => sum + a.amount, 0)
    const totalRequisitions = todayRequisitions.reduce((sum, r) => sum + r.totalAmount, 0)

    const dateStr = format(today, 'dd MMM yyyy')

    // Build HTML email
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f4f4f4; }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1e293b; color: white; padding: 24px; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 8px 0 0; opacity: 0.8; font-size: 14px; }
    .summary { display: flex; gap: 16px; padding: 20px; }
    .summary-card { flex: 1; background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center; }
    .summary-card .label { font-size: 12px; color: #64748b; text-transform: uppercase; }
    .summary-card .value { font-size: 24px; font-weight: 700; color: #1e293b; margin-top: 4px; }
    .summary-card.expense .value { color: #d97706; }
    .summary-card.advance .value { color: #2563eb; }
    .summary-card.requisition .value { color: #059669; }
    .section { padding: 20px; }
    .section h2 { font-size: 16px; color: #1e293b; margin: 0 0 12px; border-bottom: 2px solid #f59e0b; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #1e293b; color: white; text-align: left; padding: 10px 12px; font-weight: 600; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-approved { background: #dbeafe; color: #1e40af; }
    .badge-paid { background: #d1fae5; color: #065f46; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }
    .empty { color: #94a3b8; font-style: italic; text-align: center; padding: 20px; }
    .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>S.S. Electricals - Daily Report</h1>
      <p>${dateStr} | Auto-generated summary</p>
    </div>
    <div class="summary">
      <div class="summary-card expense">
        <div class="label">Expenses</div>
        <div class="value">₹${totalExpenses.toLocaleString('en-IN')}</div>
        <div style="font-size:12px;color:#64748b;">${todayExpenses.length} entries</div>
      </div>
      <div class="summary-card advance">
        <div class="label">Advances</div>
        <div class="value">₹${totalAdvances.toLocaleString('en-IN')}</div>
        <div style="font-size:12px;color:#64748b;">${todayAdvances.length} entries</div>
      </div>
      <div class="summary-card requisition">
        <div class="label">Requisitions</div>
        <div class="value">₹${totalRequisitions.toLocaleString('en-IN')}</div>
        <div style="font-size:12px;color:#64748b;">${todayRequisitions.length} entries</div>
      </div>
    </div>

    ${todayExpenses.length > 0 ? `
    <div class="section">
      <h2>Today's Expenses (${todayExpenses.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>User</th>
            <th>Site</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${todayExpenses.map(e => `
          <tr>
            <td>${e.description}</td>
            <td>${e.user.name}</td>
            <td>${e.site.name}</td>
            <td>${e.category.name}</td>
            <td style="font-weight:600;">₹${e.amount.toLocaleString('en-IN')}</td>
            <td><span class="badge badge-${e.status.toLowerCase()}">${e.status.replace(/_/g, ' ')}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    ${todayAdvances.length > 0 ? `
    <div class="section">
      <h2>Today's Advances (${todayAdvances.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>User</th>
            <th>Site</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${todayAdvances.map(a => `
          <tr>
            <td>${a.purpose}</td>
            <td>${a.user.name}</td>
            <td>${a.site.name}</td>
            <td style="font-weight:600;">₹${a.amount.toLocaleString('en-IN')}</td>
            <td><span class="badge badge-${a.status.toLowerCase()}">${a.status.replace(/_/g, ' ')}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    ${todayRequisitions.length > 0 ? `
    <div class="section">
      <h2>Today's Requisitions (${todayRequisitions.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>User</th>
            <th>Site</th>
            <th>Total</th>
            <th>Priority</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${todayRequisitions.map(r => `
          <tr>
            <td>${r.title}</td>
            <td>${r.user.name}</td>
            <td>${r.site.name}</td>
            <td style="font-weight:600;">₹${r.totalAmount.toLocaleString('en-IN')}</td>
            <td><span class="badge badge-pending">${r.priority}</span></td>
            <td><span class="badge badge-${r.status.toLowerCase().replace(/_/g, '-')}">${r.status.replace(/_/g, ' ')}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    ${todayExpenses.length === 0 && todayAdvances.length === 0 && todayRequisitions.length === 0 ? `
    <div class="section">
      <div class="empty">No activity recorded today.</div>
    </div>` : ''}

    <div class="footer">
      S.S. Electricals Expense Manager v2.0 | This is an automated daily report.
    </div>
  </div>
</body>
</html>`

    // ── Send email via nodemailer (optional feature) ──
    // nodemailer is not bundled — we try to load it dynamically.
    // If it's not installed, we return the report without sending email.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = require('nodemailer')

      const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER
      const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS
      const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com'
      const smtpPort = parseInt(process.env.SMTP_PORT || '587')

      if (!smtpUser || !smtpPass) {
        console.log('[daily-report] SMTP not configured. Report generated but not sent.')
        return NextResponse.json({
          success: false,
          message: 'SMTP not configured. Report generated but not sent.',
          summary: { expenses: todayExpenses.length, advances: todayAdvances.length, requisitions: todayRequisitions.length },
        })
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      })

      const recipients = users.map(u => u.email)
      if (recipients.length === 0) {
        return NextResponse.json({ success: false, message: 'No recipients found' })
      }

      await transporter.sendMail({
        from: `"S.S. Electricals" <${smtpUser}>`,
        to: recipients.join(', '),
        subject: `Daily Report - ${dateStr} | S.S. Electricals`,
        html,
      })

      return NextResponse.json({
        success: true,
        message: `Daily report sent to ${recipients.length} recipients`,
        summary: { expenses: todayExpenses.length, advances: todayAdvances.length, requisitions: todayRequisitions.length },
      })
    } catch (emailError) {
      // nodemailer not available or email sending failed
      const msg = emailError instanceof Error ? emailError.message : String(emailError)
      console.warn(`[daily-report] Email not sent: ${msg}`)
      return NextResponse.json({
        success: false,
        message: `Report generated but email failed: ${msg}`,
        summary: { expenses: todayExpenses.length, advances: todayAdvances.length, requisitions: todayRequisitions.length },
      })
    }
  } catch (error) {
    console.error('Daily Report API error:', error)
    return NextResponse.json({ error: 'Failed to generate daily report' }, { status: 500 })
  }
}
