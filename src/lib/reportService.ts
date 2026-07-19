import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

export interface ExpenseReportData {
  userName: string;
  startDate: string;
  endDate: string;
  totalExpenses: number;
  expenses: {
    id: number;
    date: string;
    category_name: string;
    category_color: string;
    amount: number;
    description?: string;
  }[];
  categories: {
    id: number;
    name: string;
    color: string;
    total: number;
  }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatDate(date: string): string {
  if (!date) return '';
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '107, 114, 128';
}

// ── Pie Chart SVG ─────────────────────────────────────────────────────────────

function generatePieChartSVG(categories: ExpenseReportData['categories']): string {
  const filtered = categories.filter((c) => c.total > 0);
  if (filtered.length === 0) return '<p style="text-align:center;color:#9ca3af;">No data</p>';

  const total = filtered.reduce((s, c) => s + c.total, 0);
  const cx = 150;
  const cy = 150;
  const r = 120;
  let startAngle = -Math.PI / 2;
  let paths = '';

  filtered.forEach((cat) => {
    const angle = (cat.total / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    paths += `
      <path
        d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z"
        fill="${cat.color}"
        stroke="#fff"
        stroke-width="2"
      />`;
    startAngle = endAngle;
  });

  // Legend
  let legend = '';
  filtered.forEach((cat) => {
    const pct = ((cat.total / total) * 100).toFixed(1);
    legend += `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="width:14px;height:14px;border-radius:3px;background:${cat.color};flex-shrink:0;"></div>
        <span style="font-size:13px;color:#374151;flex:1;">${cat.name}</span>
        <span style="font-size:13px;font-weight:600;color:#111827;">${pct}%</span>
        <span style="font-size:13px;color:#6b7280;min-width:80px;text-align:right;">${formatCurrency(cat.total)}</span>
      </div>`;
  });

  return `
    <div style="display:flex;align-items:center;gap:32px;flex-wrap:wrap;justify-content:center;">
      <svg width="300" height="300" viewBox="0 0 300 300">
        ${paths}
        <circle cx="${cx}" cy="${cy}" r="50" fill="white"/>
        <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="13" fill="#6b7280">Total</text>
        <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="14" font-weight="bold" fill="#111827">
          ${formatCurrency(total)}
        </text>
      </svg>
      <div style="min-width:220px;">${legend}</div>
    </div>`;
}

// ── Bar Chart SVG ─────────────────────────────────────────────────────────────

function generateBarChartSVG(expenses: ExpenseReportData['expenses']): string {
  if (expenses.length === 0) return '<p style="text-align:center;color:#9ca3af;">No data</p>';

  // Group by month
  const monthMap: Record<string, number> = {};
  expenses.forEach((e) => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap[key] = (monthMap[key] || 0) + e.amount;
  });

  const months = Object.keys(monthMap).sort();
  if (months.length === 0) return '';

  const maxVal = Math.max(...Object.values(monthMap));
  const svgWidth = Math.max(500, months.length * 80);
  const svgHeight = 220;
  const barWidth = 50;
  const gap = (svgWidth - months.length * barWidth) / (months.length + 1);
  const chartHeight = 160;
  const topPad = 20;

  let bars = '';
  months.forEach((month, i) => {
    const val = monthMap[month];
    const barH = Math.max(4, (val / maxVal) * chartHeight);
    const x = gap + i * (barWidth + gap);
    const y = topPad + chartHeight - barH;

    // Month label (MMM-YY)
    const [yr, mo] = month.split('-');
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const label = `${monthNames[parseInt(mo) - 1]}'${yr.slice(2)}`;

    bars += `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="#3b82f6" rx="4"/>
      <text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" font-size="10" fill="#374151">
        ${formatCurrency(val)}
      </text>
      <text x="${x + barWidth / 2}" y="${svgHeight - 5}" text-anchor="middle" font-size="10" fill="#6b7280">
        ${label}
      </text>`;
  });

  return `
    <div style="overflow-x:auto;">
      <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
        <line x1="0" y1="${topPad + chartHeight}" x2="${svgWidth}" y2="${topPad + chartHeight}" stroke="#e5e7eb" stroke-width="1"/>
        ${bars}
      </svg>
    </div>`;
}

// ── HTML Template ─────────────────────────────────────────────────────────────

function generateHTML(data: ExpenseReportData): string {
  const {
    userName,
    startDate,
    endDate,
    totalExpenses,
    expenses,
    categories,
  } = data;

  const generatedOn = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const dateRange =
    startDate && endDate
      ? `${formatDate(startDate)} – ${formatDate(endDate)}`
      : startDate
      ? `From ${formatDate(startDate)}`
      : endDate
      ? `Until ${formatDate(endDate)}`
      : 'All Time';

  // Category table rows
  const categoryRows = categories
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((cat, i) => {
      const pct = totalExpenses > 0 ? ((cat.total / totalExpenses) * 100).toFixed(1) : '0.0';
      return `
        <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
          <td style="padding:10px 12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:12px;height:12px;border-radius:3px;background:${cat.color};"></div>
              ${cat.name}
            </div>
          </td>
          <td style="padding:10px 12px;text-align:right;font-weight:600;">${formatCurrency(cat.total)}</td>
          <td style="padding:10px 12px;text-align:right;">${pct}%</td>
          <td style="padding:10px 12px;">
            <div style="background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden;">
              <div style="background:${cat.color};width:${pct}%;height:100%;border-radius:4px;"></div>
            </div>
          </td>
        </tr>`;
    })
    .join('');

  // Expense detail rows
  const expenseRows = expenses
    .map((e, i) => `
      <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
        <td style="padding:8px 12px;color:#6b7280;font-size:13px;">${formatDate(e.date)}</td>
        <td style="padding:8px 12px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:10px;height:10px;border-radius:2px;background:${e.category_color};"></div>
            <span style="font-size:13px;">${e.category_name}</span>
          </div>
        </td>
        <td style="padding:8px 12px;font-size:13px;color:#6b7280;font-style:italic;">${e.description || '-'}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:600;color:#dc2626;font-size:13px;">
          -${formatCurrency(e.amount)}
        </td>
      </tr>`)
    .join('');

  const pieChart = generatePieChartSVG(categories);
  const barChart = generateBarChartSVG(expenses);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Expense Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f7fa; color: #111827; }
        .page { max-width: 800px; margin: 0 auto; padding: 32px 24px; }

        /* Header */
        .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border-radius: 16px; padding: 28px 32px; margin-bottom: 24px; }
        .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .app-name { font-size: 13px; opacity: 0.8; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
        .report-title { font-size: 26px; font-weight: 700; }
        .header-badge { background: rgba(255,255,255,0.2); border-radius: 8px; padding: 8px 14px; text-align: center; }
        .header-meta { margin-top: 16px; display: flex; gap: 24px; flex-wrap: wrap; }
        .meta-item { font-size: 13px; opacity: 0.85; }
        .meta-item strong { display: block; font-size: 15px; opacity: 1; }

        /* Summary cards */
        .summary-grid { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
        .summary-card { flex: 1; min-width: 140px; background: white; border-radius: 12px; padding: 18px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .summary-label { font-size: 12px; color: #6b7280; margin-bottom: 6px; }
        .summary-value { font-size: 22px; font-weight: 700; }

        /* Section */
        .section { background: white; border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .section-title { font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid #f3f4f6; display: flex; align-items: center; gap: 8px; }

        /* Table */
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
        th:last-child, td:last-child { text-align: right; }

        /* Footer */
        .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="page">

        <!-- HEADER -->
        <div class="header">
          <div class="header-top">
            <div>
              <div class="app-name">📓 DigiDiary</div>
              <div class="report-title">Expense Report</div>
            </div>
            <div class="header-badge">
              <div style="font-size:11px;opacity:0.8;">Generated</div>
              <div style="font-size:13px;font-weight:600;">${generatedOn}</div>
            </div>
          </div>
          <div class="header-meta">
            <div class="meta-item">
              <strong>${userName}</strong>
              Account
            </div>
            <div class="meta-item">
              <strong>${dateRange}</strong>
              Period
            </div>
            <div class="meta-item">
              <strong>${expenses.length}</strong>
              Transactions
            </div>
          </div>
        </div>

        <!-- SUMMARY CARDS -->
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Total Expenses</div>
            <div class="summary-value" style="color:#dc2626;">${formatCurrency(totalExpenses)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Categories Used</div>
            <div class="summary-value" style="color:#3b82f6;">${categories.filter((c) => c.total > 0).length}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Avg per Expense</div>
            <div class="summary-value" style="color:#8b5cf6;">
              ${expenses.length > 0 ? formatCurrency(totalExpenses / expenses.length) : '₹0'}
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Highest Category</div>
            <div class="summary-value" style="color:#f59e0b;font-size:16px;">
              ${categories.filter((c) => c.total > 0).sort((a, b) => b.total - a.total)[0]?.name || '-'}
            </div>
          </div>
        </div>

        <!-- PIE CHART -->
        <div class="section">
          <div class="section-title">🥧 Expense by Category</div>
          ${pieChart}
        </div>

        <!-- BAR CHART -->
        <div class="section">
          <div class="section-title">📊 Monthly Trend</div>
          ${barChart}
        </div>

        <!-- CATEGORY TABLE -->
        <div class="section">
          <div class="section-title">🏷️ Category Summary</div>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th style="text-align:right;">Amount</th>
                <th style="text-align:right;">Share</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              ${categoryRows}
              <tr style="border-top:2px solid #e5e7eb;">
                <td style="padding:10px 12px;font-weight:700;">Total</td>
                <td style="padding:10px 12px;text-align:right;font-weight:700;color:#dc2626;">${formatCurrency(totalExpenses)}</td>
                <td style="padding:10px 12px;text-align:right;font-weight:700;">100%</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- EXPENSE DETAIL TABLE -->
        <div class="section">
          <div class="section-title">📋 All Expenses (${expenses.length})</div>
          ${
            expenses.length === 0
              ? '<p style="text-align:center;color:#9ca3af;padding:20px;">No expenses found</p>'
              : `<table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th style="text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>${expenseRows}</tbody>
            </table>`
          }
        </div>

        <!-- FOOTER -->
        <div class="footer">
          Generated by Expense Master App • ${generatedOn}
        </div>

      </div>
    </body>
    </html>`;
}

// ── Main export function ──────────────────────────────────────────────────────

export async function generateExpenseReport(data: ExpenseReportData): Promise<void> {
  try {
    // 1. Generate HTML
    const html = generateHTML(data);

    // 2. Print to PDF
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    // 3. Copy to cache with proper name
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const fileName = `expense-report-${timestamp}.pdf`;
    const destPath = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.copyAsync({ from: uri, to: destPath });

    // 4. Share PDF
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(destPath, {
        mimeType: 'application/pdf',
        dialogTitle: 'Save or Share Expense Report',
        UTI: 'com.adobe.pdf',
      });
    } else {
      throw new Error('Sharing not available on this device');
    }
  } catch (error) {
    console.error('Report generation error:', error);
    throw error;
  }
}