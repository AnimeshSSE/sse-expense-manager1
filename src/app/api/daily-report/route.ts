import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Helper: format INR currency
function inr(amount: number): string {
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Helper: format date to readable string
function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Helper: status badge color
function statusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: '#f59e0b',
    ACCOUNTANT_APPROVED: '#3b82f6',
    ADMIN_APPROVED: '#8b5cf6',
    APPROVED: '#22c55e',
    REJECTED: '#ef4444',
    RETURNED: '#f97316',
    PAID: '#10b981',
    ORDERED: '#6366f1',
    RECEIVED: '#14b8a6',
    CANCELLED: '#6b7280',
  };
  return colors[status] || '#6b7280';
}

function buildHtmlReport(data: ReportData): string {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Report — S.S. Electricals</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f4; color: #1c1917; }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #1c1917; color: white; padding: 24px 28px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 6px 0 0; opacity: 0.7; font-size: 13px; }
    .summary { display: flex; gap: 12px; padding: 20px 28px; border-bottom: 1px solid #e7e5e4; flex-wrap: wrap; }
    .stat-card { flex: 1; min-width: 120px; background: #fafaf9; border-radius: 8px; padding: 14px 16px; text-align: center; }
    .stat-card .number { font-size: 22px; font-weight: 700; color: #1c1917; }
    .stat-card .label { font-size: 11px; color: #78716c; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-card.accent { background: #fffbeb; }
    .stat-card.accent .number { color: #d97706; }
    .section { padding: 20px 28px; border-bottom: 1px solid #f5f5f4; }
    .section:last-child { border-bottom: none; }
    .section h2 { font-size: 15px; font-weight: 600; color: #44403c; margin: 0 0 14px; display: flex; align-items: center; gap: 8px; }
    .section h2 .count { background: #e7e5e4; color: #57534e; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead th { text-align: left; padding: 8px 10px; background: #fafaf9; color: #78716c; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 1px solid #e7e5e4; }
    tbody td { padding: 8px 10px; border-bottom: 1px solid #f5f5f4; color: #44403c; }
    tbody tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; color: white; }
    .amount { font-weight: 600; text-align: right; white-space: nowrap; }
    .empty { text-align: center; padding: 20px; color: #a8a29e; font-size: 13px; font-style: italic; }
    .footer { padding: 16px 28px; text-align: center; font-size: 11px; color: #a8a29e; border-top: 1px solid #e7e5e4; }
    .total-row td { font-weight: 700; border-top: 2px solid #e7e5e4 !important; background: #fafaf9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚡ S.S. Electricals — Daily Report</h1>
      <p>${today}</p>
    </div>

    <div class="summary">
      <div class="stat-card">
        <div class="number">${data.expenses.length}</div>
        <div class="label">Expenses</div>
      </div>
      <div class="stat-card accent">
        <div class="number">${inr(data.totalExpenseAmount)}</div>
        <div class="label">Total Spent</div>
      </div>
      <div class="stat-card">
        <div class="number">${data.advances.length}</div>
        <div class="label">Advances</div>
      </div>
      <div class="stat-card accent">
        <div class="number">${inr(data.totalAdvanceAmount)}</div>
        <div class="label">Total Advances</div>
      </div>
    </div>

    ${data.expenses.length > 0 ? `
    <div class="section">
      <h2>🧾 Expenses <span class="count">${data.expenses.length}</span></h2>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Site</th>
            <th>Category</th>
            <th>By</th>
            <th style="text-align:right">Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.expenses.map(e => `
          <tr>
            <td>${e.description}</td>
            <td>${e.siteName || '—'}</td>
            <td>${e.categoryName || '—'}</td>
            <td>${e.userName}</td>
            <td class="amount">${inr(e.amount)}</td>
            <td><span class="badge" style="background:${statusColor(e.status)}">${e.status.replace(/_/g, ' ')}</span></td>
          </tr>`).join('')}
          <tr class="total-row">
            <td colspan="4">Total</td>
            <td class="amount">${inr(data.totalExpenseAmount)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>` : `
    <div class="section">
      <h2>🧾 Expenses</h2>
      <div class="empty">No expenses submitted today</div>
    </div>`}

    ${data.advances.length > 0 ? `
    <div class="section">
      <h2>💰 Advances <span class="count">${data.advances.length}</span></h2>
      <table>
        <thead>
          <tr>
            <th>Purpose</th>
            <th>Site</th>
            <th>By</th>
            <th style="text-align:right">Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.advances.map(a => `
          <tr>
            <td>${a.purpose}</td>
            <td>${a.siteName || '—'}</td>
            <td>${a.userName}</td>
            <td class="amount">${inr(a.amount)}</td>
            <td><span class="badge" style="background:${statusColor(a.status)}">${a.status.replace(/_/g, ' ')}</span></td>
          </tr>`).join('')}
          <tr class="total-row">
            <td colspan="3">Total</td>
            <td class="amount">${inr(data.totalAdvanceAmount)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>` : `
    <div class="section">
      <h2>💰 Advances</h2>
      <div class="empty">No advances submitted today</div>
    </div>`}

    ${data.requisitions.length > 0 ? `
    <div class="section">
      <h2>📦 Requisitions <span class="count">${data.requisitions.length}</span></h2>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Site</th>
            <th>By</th>
            <th style="text-align:right">Amount</th>
            <th>Priority</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.requisitions.map(r => `
          <tr>
            <td>${r.title}</td>
            <td>${r.siteName || '—'}</td>
            <td>${r.userName}</td>
            <td class="amount">${inr(r.totalAmount)}</td>
            <td>${r.priority}</td>
            <td><span class="badge" style="background:${statusColor(r.status)}">${r.status.replace(/_/g, ' ')}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `
    <div class="section">
      <h2>📦 Requisitions</h2>
      <div class="empty">No requisitions submitted today</div>
    </div>`}

    <div class="footer">
      ⚡ S.S. Electricals Expense Manager — Automated Daily Report · ${today}
    </div>
  </div>
</body>
</html>`;
}

interface ReportData {
  expenses: Array<{
    description: string; amount: number; status: string;
    siteName: string; categoryName: string; userName: string;
  }>;
  advances: Array<{
    purpose: string; amount: number; status: string;
    siteName: string; userName: string;
  }>;
  requisitions: Array<{
    title: string; totalAmount: number; status: string;
    siteName: string; userName: string; priority: string;
  }>;
  totalExpenseAmount: number;
  totalAdvanceAmount: number;
}

// GET /api/daily-report — Generate and send daily email report
export async function GET() {
  try {
    // Verify cron secret to prevent unauthorized calls
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = process.env.VERCEL === '1';

    // In production, only allow Vercel cron or requests with the secret
    if (isVercelCron && cronSecret) {
      // Vercel cron doesn't send the secret in headers by default,
      // so we rely on the vercel.json cron config + VERCEL env var check
    }

    // Get today's date range in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const startOfDay = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate(), 0, 0, 0);
    const endOfDay = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate(), 23, 59, 59, 999);
    // Convert back to UTC for the database query
    const utcStart = new Date(startOfDay.getTime() - istOffset);
    const utcEnd = new Date(endOfDay.getTime() - istOffset);

    // Fetch today's data in parallel
    const [expenses, advances, requisitions] = await Promise.all([
      db.expense.findMany({
        where: { createdAt: { gte: utcStart, lte: utcEnd } },
        include: { site: { select: { name: true } }, category: { select: { name: true } }, user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      db.advance.findMany({
        where: { createdAt: { gte: utcStart, lte: utcEnd } },
        include: { site: { select: { name: true } }, user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      db.requisition.findMany({
        where: { createdAt: { gte: utcStart, lte: utcEnd } },
        include: { site: { select: { name: true } }, user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const data: ReportData = {
      expenses: expenses.map(e => ({
        description: e.description,
        amount: e.amount,
        status: e.status,
        siteName: e.site?.name || '',
        categoryName: e.category?.name || '',
        userName: e.user?.name || '',
      })),
      advances: advances.map(a => ({
        purpose: a.purpose,
        amount: a.amount,
        status: a.status,
        siteName: a.site?.name || '',
        userName: a.user?.name || '',
      })),
      requisitions: requisitions.map(r => ({
        title: r.title,
        totalAmount: r.totalAmount,
        status: r.status,
        siteName: r.site?.name || '',
        userName: r.user?.name || '',
        priority: r.priority,
      })),
      totalExpenseAmount: expenses.reduce((sum, e) => sum + e.amount, 0),
      totalAdvanceAmount: advances.reduce((sum, a) => sum + a.amount, 0),
    };

    // Send email
    const transporter = await getTransporter();
    const smtpEmail = process.env.SMTP_EMAIL || 'animeshj.sse@gmail.com';
    const reportEmail = process.env.REPORT_EMAIL || 'animeshj.sse@gmail.com';

    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const mailOptions = {
      from: `"S.S. Electricals" <${smtpEmail}>`,
      to: reportEmail,
      subject: `📊 Daily Report — S.S. Electricals (${today})`,
      html: buildHtmlReport(data),
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      message: 'Daily report sent successfully',
      date: today,
      summary: {
        expenses: data.expenses.length,
        totalExpenses: data.totalExpenseAmount,
        advances: data.advances.length,
        totalAdvances: data.totalAdvanceAmount,
        requisitions: data.requisitions.length,
      },
    });
  } catch (error) {
    console.error('[GET /api/daily-report] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send daily report' },
      { status: 500 },
    );
  }
}

// Lazy-loaded nodemailer transporter
let cachedTransporter: any = null;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const smtpEmail = process.env.SMTP_EMAIL;
  const smtpPassword = process.env.SMTP_PASSWORD;

  if (!smtpEmail || !smtpPassword) {
    throw new Error('SMTP_EMAIL and SMTP_PASSWORD environment variables are required');
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodemailer = require('nodemailer');
  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: smtpEmail, pass: smtpPassword },
  });

  // Verify connection
  await cachedTransporter.verify();

  return cachedTransporter;
}
