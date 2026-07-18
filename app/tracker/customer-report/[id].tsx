import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';
import {
  getCustomerReportData,
  createAssetPayment,
  deleteAssetPayment,
  getAssetPayments,
  settleAssetCustomer,
  getAssetCustomerSettlements,
  getAssetSettlementJobs,
  undoAssetCustomerSettlement,
} from '../../../src/lib/database';
import { Card } from '../../../src/components/Card';
import { Button } from '../../../src/components/Button';
import { Input } from '../../../src/components/Input';
import DatePicker from '../../../src/components/DatePicker';
import DateRangeFilter from '../../../src/components/DateRangeFilter';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return dateStr; }
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return dateStr; }
}

type ActiveTab = 'active' | 'settlements';

export default function CustomerReport() {
  const { id, customerName } = useLocalSearchParams<{
    id: string;
    customerName: string;
  }>();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const customerId = Number(id);

  const [reportData, setReportData] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('active');

  // Settlement modal
  const [settleModal, setSettleModal] = useState(false);
  const [settleNotes, setSettleNotes] = useState('');
  const [settleSaving, setSettleSaving] = useState(false);

  // Expanded settlement
  const [expandedSettlement, setExpandedSettlement] = useState<number | null>(null);
  const [settlementJobs, setSettlementJobs] = useState<any[]>([]);
  const [loadingSettlementJobs, setLoadingSettlementJobs] = useState(false);

  // Payment modal
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [paymentSaving, setPaymentSaving] = useState(false);

  const loadData = async () => {
    if (!user) return;
    try {
      const [data, pays, setts] = await Promise.all([
        getCustomerReportData(user.id, customerId, {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
        getAssetPayments(user.id, customerId),
        getAssetCustomerSettlements(user.id, customerId),
      ]);
      setReportData(data);
      setPayments(pays.filter((p: any) => !p.is_settled));
      setSettlements(setts);
    } catch (error) {
      console.error('Report load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user, customerId, startDate, endDate]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Settlement ──────────────────────────────────────────────────────

  const handleSettle = async () => {
    setSettleSaving(true);
    try {
      await settleAssetCustomer(user!.id, customerId, settleNotes);
      setSettleModal(false);
      setSettleNotes('');
      Alert.alert('✅ Account Settled', 'All completed jobs and payments have been settled. They will no longer appear in the dashboard totals.');
      await loadData();
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setSettleSaving(false);
    }
  };

  const handleUndoSettlement = (settlementId: number) => {
    Alert.alert('Undo Settlement', 'This will restore all jobs and payments from this settlement. Continue?', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('undo'), style: 'destructive',
        onPress: async () => {
          try {
            await undoAssetCustomerSettlement(settlementId, user!.id);
            setExpandedSettlement(null);
            setSettlementJobs([]);
            await loadData();
            Alert.alert('✅ Undone', 'Settlement has been reversed.');
          } catch (error) {
            Alert.alert(t('error'), (error as Error).message);
          }
        },
      },
    ]);
  };

  const handleToggleSettlement = async (settlement: any) => {
    if (expandedSettlement === settlement.id) {
      setExpandedSettlement(null);
      setSettlementJobs([]);
      return;
    }
    setExpandedSettlement(settlement.id);
    setLoadingSettlementJobs(true);
    try {
      const jobs = await getAssetSettlementJobs(settlement.id);
      setSettlementJobs(jobs);
    } catch { setSettlementJobs([]); }
    finally { setLoadingSettlementJobs(false); }
  };

  // ── Payment ─────────────────────────────────────────────────────────

  const handleAddPayment = async () => {
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      Alert.alert(t('error'), t('payment_invalid'));
      return;
    }
    setPaymentSaving(true);
    try {
      await createAssetPayment(
        user!.id, customerId,
        Number(paymentForm.amount),
        paymentForm.paymentDate,
        paymentForm.notes
      );
      setPaymentModal(false);
      setPaymentForm({ amount: '', paymentDate: new Date().toISOString().split('T')[0], notes: '' });
      await loadData();
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleDeletePayment = (paymentId: number) => {
    Alert.alert(t('delete'), t('are_you_sure'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => { await deleteAssetPayment(paymentId, user!.id); await loadData(); },
      },
    ]);
  };

  const formatCurrency = (amount: number) =>
    '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // ── PDF ─────────────────────────────────────────────────────────────

  const handleGeneratePdf = async () => {
    if (!reportData) return;
    setGeneratingPdf(true);
    try {
      const { customer, jobs, totalJobs, totalHours, totalAmount, totalPaid, outstanding } = reportData;
      const generatedOn = new Date().toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

      const jobRows = jobs.map((job: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
          <td style="padding:8px 12px;font-size:13px;">${formatDateTime(job.start_time)}</td>
          <td style="padding:8px 12px;font-size:13px;">${job.asset_name}</td>
          <td style="padding:8px 12px;font-size:13px;text-align:center;">${formatDuration(job.duration_minutes)}</td>
          <td style="padding:8px 12px;font-size:13px;text-align:right;">₹${job.hourly_rate}/hr</td>
          <td style="padding:8px 12px;font-size:13px;text-align:right;font-weight:700;color:#059669;">${formatCurrency(job.total_amount)}</td>
        </tr>
      `).join('');

      const paymentRows = payments.map((p: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
          <td style="padding:8px 12px;font-size:13px;">${p.payment_date}</td>
          <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#059669;">${formatCurrency(p.amount)}</td>
          <td style="padding:8px 12px;font-size:13px;">${p.notes || '-'}</td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html><html><head><meta charset="UTF-8"/>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family:-apple-system,sans-serif; background:#f5f7fa; }
          .page { max-width:800px; margin:0 auto; padding:32px 24px; }
          .header { background:linear-gradient(135deg,#3b82f6,#1d4ed8); color:white; border-radius:16px; padding:28px 32px; margin-bottom:24px; }
          .summary-grid { display:flex; gap:16px; margin-bottom:24px; flex-wrap:wrap; }
          .summary-card { flex:1; min-width:140px; background:#fff; border-radius:12px; padding:16px; box-shadow:0 1px 4px rgba(0,0,0,0.08); }
          .summary-label { font-size:12px; color:#6b7280; margin-bottom:6px; }
          .summary-value { font-size:20px; font-weight:700; }
          .section { background:#fff; border-radius:12px; padding:20px; margin-bottom:24px; box-shadow:0 1px 4px rgba(0,0,0,0.08); }
          .section-title { font-size:16px; font-weight:600; margin-bottom:16px; padding-bottom:10px; border-bottom:2px solid #f3f4f6; }
          table { width:100%; border-collapse:collapse; }
          th { background:#f3f4f6; padding:10px 12px; text-align:left; font-size:12px; color:#6b7280; }
          .footer { text-align:center; color:#9ca3af; font-size:12px; margin-top:24px; }
        </style></head><body>
        <div class="page">
          <div class="header">
            <div style="font-size:24px;font-weight:700;">⏱️ ${t('customer_report')}</div>
            <div style="font-size:14px;opacity:0.85;margin-top:4px;">${customer?.name} ${customer?.phone ? '• ' + customer.phone : ''}</div>
            <div style="font-size:13px;opacity:0.7;margin-top:4px;">${generatedOn}</div>
          </div>
          <div class="summary-grid">
            <div class="summary-card"><div class="summary-label">${t('total_jobs')}</div><div class="summary-value" style="color:#3b82f6;">${totalJobs}</div></div>
            <div class="summary-card"><div class="summary-label">${t('total_hours')}</div><div class="summary-value" style="color:#8b5cf6;">${totalHours.toFixed(1)}h</div></div>
            <div class="summary-card"><div class="summary-label">${t('total_billed')}</div><div class="summary-value" style="color:#059669;">${formatCurrency(totalAmount)}</div></div>
            <div class="summary-card"><div class="summary-label">${t('outstanding_amount')}</div><div class="summary-value" style="color:${outstanding > 0 ? '#dc2626' : '#059669'};">${formatCurrency(outstanding)}</div></div>
          </div>
          <div class="section">
            <div class="section-title">📋 ${t('job_history')} (${totalJobs})</div>
            ${jobs.length === 0 ? `<p style="text-align:center;color:#9ca3af;padding:20px;">${t('no_jobs_period')}</p>` :
              `<table><thead><tr>
                <th>${t('date')}</th><th>${t('asset_label')}</th>
                <th style="text-align:center;">${t('duration')}</th>
                <th style="text-align:right;">${t('rate')}</th>
                <th style="text-align:right;">${t('amount')}</th>
              </tr></thead><tbody>${jobRows}</tbody>
              <tfoot><tr>
                <td colspan="4" style="padding:10px 12px;font-weight:700;text-align:right;">${t('total')}</td>
                <td style="padding:10px 12px;text-align:right;font-weight:800;color:#059669;">${formatCurrency(totalAmount)}</td>
              </tr></tfoot></table>`}
          </div>
          <div class="section">
            <div class="section-title">💰 ${t('payment_history')}</div>
            ${payments.length === 0 ? `<p style="text-align:center;color:#9ca3af;padding:20px;">${t('no_payments_yet')}</p>` :
              `<table><thead><tr><th>${t('date')}</th><th>${t('amount')}</th><th>${t('notes')}</th></tr></thead>
              <tbody>${paymentRows}</tbody>
              <tfoot><tr>
                <td style="padding:10px 12px;font-weight:700;">${t('total_paid')}</td>
                <td style="padding:10px 12px;font-weight:800;color:#059669;">${formatCurrency(totalPaid)}</td>
                <td></td>
              </tr></tfoot></table>`}
          </div>
          <div class="footer">Asset Tracker • ${generatedOn}</div>
        </div></body></html>
      `;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${customer?.name} ${t('customer_report')}`, UTI: 'com.adobe.pdf' });
      }
    } catch (error) {
      Alert.alert(t('error'), String(error));
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const { totalJobs, totalHours, totalAmount, totalPaid, outstanding, jobs } = reportData || {};
  const canSettle = (jobs || []).length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← {t('back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{customerName}</Text>
          <Text style={styles.headerSub}>{t('customer_report')}</Text>
        </View>
        <TouchableOpacity onPress={handleGeneratePdf} style={styles.pdfBtn} disabled={generatingPdf}>
          {generatingPdf
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.pdfBtnText}>{t('generate_pdf')}</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}>

        {/* Date Filter */}
        <View style={{ padding: 16, paddingBottom: 0 }}>
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
            onClear={() => { setStartDate(''); setEndDate(''); }}
            autoSetDefaults={false}
          />
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          {[
            { label: t('total_jobs'), value: String(totalJobs || 0), color: theme.colors.primary, emoji: '📋', bg: isDark ? '#1e3a5f' : '#eff6ff' },
            { label: t('total_hours'), value: `${(totalHours || 0).toFixed(1)}h`, color: '#8b5cf6', emoji: '⏱️', bg: isDark ? '#2e1065' : '#f3e8ff' },
            { label: t('total_billed'), value: formatCurrency(totalAmount || 0), color: '#059669', emoji: '💰', bg: isDark ? '#064e3b' : '#ecfdf5' },
            { label: t('total_paid'), value: formatCurrency(totalPaid || 0), color: theme.colors.primary, emoji: '✅', bg: isDark ? '#1e3a5f' : '#eff6ff' },
          ].map((item, i) => (
            <Card key={i} style={[styles.summaryCard, { backgroundColor: item.bg }]}>
              <Text style={styles.summaryEmoji}>{item.emoji}</Text>
              <Text style={[styles.summaryLabel, { color: theme.colors.muted }]}>{item.label}</Text>
              <Text style={[styles.summaryValue, { color: item.color }]}>{item.value}</Text>
            </Card>
          ))}
        </View>

        {/* Outstanding */}
        <Card style={[
          styles.outstandingCard,
          {
            backgroundColor: outstanding > 0
              ? isDark ? '#450a0a' : '#fef2f2'
              : isDark ? '#064e3b' : '#ecfdf5',
          },
        ]}>
          <Text style={[styles.outstandingLabel, { color: theme.colors.text }]}>
            {outstanding > 0 ? `⚠️ ${t('outstanding_amount')}` : `✅ ${t('no_outstanding')}`}
          </Text>
          <Text style={[styles.outstandingValue, { color: outstanding > 0 ? '#dc2626' : '#059669' }]}>
            {formatCurrency(Math.abs(outstanding || 0))}
          </Text>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <View style={{ flex: 1 }}>
            <Button title={t('record_payment')} variant="success" onPress={() => setPaymentModal(true)} />
          </View>
          {canSettle && (
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                style={[styles.settleBtn, { backgroundColor: isDark ? '#064e3b' : '#f0fdf4', borderColor: isDark ? '#059669' : '#86efac' }]}
                onPress={() => setSettleModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.settleBtnIcon}>🤝</Text>
                <View>
                  <Text style={[styles.settleBtnText, { color: '#059669' }]}>Settle Account</Text>
                  <Text style={[styles.settleBtnDesc, { color: theme.colors.muted }]}>Mark as settled</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Tab Toggle: Active / Settlements */}
        <View style={[styles.tabToggle, { backgroundColor: isDark ? '#334155' : '#e5e7eb' }]}>
          <TouchableOpacity
            style={[styles.tabToggleBtn, activeTab === 'active' && [styles.tabToggleActive, { backgroundColor: theme.colors.surface }]]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[styles.tabToggleText, { color: theme.colors.muted }, activeTab === 'active' && { color: theme.colors.text, fontWeight: '600' }]}>
              📋 Active ({totalJobs || 0})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabToggleBtn, activeTab === 'settlements' && [styles.tabToggleActive, { backgroundColor: theme.colors.surface }]]}
            onPress={() => setActiveTab('settlements')}
          >
            <Text style={[styles.tabToggleText, { color: theme.colors.muted }, activeTab === 'settlements' && { color: theme.colors.text, fontWeight: '600' }]}>
              🤝 Settled ({settlements.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── ACTIVE TAB ─────────────────────────────────────────── */}
        {activeTab === 'active' && (
          <>
            {/* Job History */}
            <Card style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                📋 {t('job_history')} ({totalJobs || 0})
              </Text>
              {(jobs || []).length === 0 ? (
                <Text style={[styles.empty, { color: theme.colors.muted }]}>{t('no_jobs_period')}</Text>
              ) : (
                (jobs || []).map((job: any) => (
                  <View key={job.id} style={[styles.jobRow, { borderBottomColor: theme.colors.border }]}>
                    <View style={styles.jobLeft}>
                      <Text style={[styles.jobAsset, { color: theme.colors.text }]}>{job.asset_name}</Text>
                      <Text style={[styles.jobDate, { color: theme.colors.muted }]}>🕐 {formatDateTime(job.start_time)}</Text>
                      <Text style={[styles.jobDuration, { color: theme.colors.muted }]}>⏱ {formatDuration(job.duration_minutes)} • ₹{job.hourly_rate}/hr</Text>
                      {job.notes && <Text style={[styles.jobNotes, { color: theme.colors.muted }]}>📝 {job.notes}</Text>}
                    </View>
                    <Text style={[styles.jobAmount, { color: '#059669' }]}>{formatCurrency(job.total_amount)}</Text>
                  </View>
                ))
              )}
            </Card>

            {/* Payment History */}
            <Card style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                💰 {t('payment_history')} ({payments.length})
              </Text>
              {payments.length === 0 ? (
                <Text style={[styles.empty, { color: theme.colors.muted }]}>{t('no_payments_yet')}</Text>
              ) : (
                payments.map((p) => (
                  <View key={p.id} style={[styles.jobRow, { borderBottomColor: theme.colors.border }]}>
                    <View style={styles.jobLeft}>
                      <Text style={[styles.jobAsset, { color: '#059669' }]}>{formatCurrency(p.amount)}</Text>
                      <Text style={[styles.jobDate, { color: theme.colors.muted }]}>📅 {p.payment_date}</Text>
                      {p.notes && <Text style={[styles.jobNotes, { color: theme.colors.muted }]}>📝 {p.notes}</Text>}
                    </View>
                    <TouchableOpacity onPress={() => handleDeletePayment(p.id)}>
                      <Text style={{ fontSize: 18, padding: 4 }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </Card>
          </>
        )}

        {/* ── SETTLEMENTS TAB ────────────────────────────────────── */}
        {activeTab === 'settlements' && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              🤝 Settlement History ({settlements.length})
            </Text>
            {settlements.length === 0 ? (
              <Text style={[styles.empty, { color: theme.colors.muted }]}>
                No settlements yet. Use "Settle Account" to settle active jobs.
              </Text>
            ) : (
              settlements.map((s) => (
                <View
                  key={s.id}
                  style={[styles.settlementRow, { backgroundColor: isDark ? '#1e293b' : '#f9fafb', borderColor: theme.colors.border }]}
                >
                  {/* Header - tappable */}
                  <TouchableOpacity onPress={() => handleToggleSettlement(s)} activeOpacity={0.7}>
                    <View style={styles.settlementHeader}>
                      <View style={[styles.settlementBadge, { backgroundColor: isDark ? '#064e3b' : '#d1fae5' }]}>
                        <Text style={{ fontSize: 18 }}>🤝</Text>
                      </View>
                      <View style={styles.settlementInfo}>
                        <Text style={[styles.settlementDate, { color: theme.colors.text }]}>
                          Settled on {formatDateDisplay(s.settled_at)}
                        </Text>
                        <Text style={[styles.settlementMeta, { color: theme.colors.muted }]}>
                          {s.job_count} job{s.job_count !== 1 ? 's' : ''} •{' '}
                          {expandedSettlement === s.id ? 'Tap to collapse ▲' : 'Tap to expand ▼'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleUndoSettlement(s.id)}
                        style={[styles.undoBtn, { backgroundColor: isDark ? '#451a03' : '#fff7ed', borderColor: isDark ? '#92400e' : '#fed7aa' }]}
                      >
                        <Text style={[styles.undoBtnText, { color: '#ea580c' }]}>↩️ {t('undo')}</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>

                  {/* Summary */}
                  <View style={styles.settlementDetails}>
                    {[
                      { label: t('billed'), value: s.total_billed, color: '#dc2626' },
                      { label: t('total_paid'), value: s.total_paid, color: '#059669' },
                      { label: t('balance'), value: Math.abs(s.balance), color: s.balance > 0 ? '#dc2626' : '#059669' },
                    ].map((item, i) => (
                      <View key={i} style={[styles.settlementDetailItem, { backgroundColor: isDark ? '#0f172a' : '#fff' }]}>
                        <Text style={[styles.settlementDetailLabel, { color: theme.colors.muted }]}>{item.label}</Text>
                        <Text style={[styles.settlementDetailValue, { color: item.color }]}>{formatCurrency(item.value)}</Text>
                      </View>
                    ))}
                  </View>

                  {s.notes && <Text style={[styles.settlementNotes, { color: theme.colors.muted }]}>📝 {s.notes}</Text>}

                  {/* Expanded Jobs */}
                  {expandedSettlement === s.id && (
                    <View style={styles.expandedContainer}>
                      <View style={[styles.expandedDivider, { backgroundColor: theme.colors.border }]} />
                      <Text style={[styles.expandedTitle, { color: theme.colors.text }]}>📋 Settled Jobs</Text>
                      {loadingSettlementJobs ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} style={{ padding: 16 }} />
                      ) : settlementJobs.length === 0 ? (
                        <Text style={[styles.empty, { color: theme.colors.muted }]}>No jobs found</Text>
                      ) : (
                        settlementJobs.map((job) => (
                          <View key={job.id} style={[styles.jobRow, { borderBottomColor: theme.colors.border }]}>
                            <View style={styles.jobLeft}>
                              <Text style={[styles.jobAsset, { color: theme.colors.text }]}>{job.asset_name}</Text>
                              <Text style={[styles.jobDate, { color: theme.colors.muted }]}>🕐 {formatDateTime(job.start_time)}</Text>
                              <Text style={[styles.jobDuration, { color: theme.colors.muted }]}>⏱ {formatDuration(job.duration_minutes)}</Text>
                            </View>
                            <Text style={[styles.jobAmount, { color: '#059669' }]}>{formatCurrency(job.total_amount)}</Text>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              ))
            )}
          </Card>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Settle Modal ─────────────────────────────────────────── */}
      <Modal visible={settleModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>🤝 Settle Account</Text>

            {/* Preview */}
            <Card style={[styles.settlePreview, { backgroundColor: isDark ? '#064e3b' : '#f0fdf4' }]}>
              <Text style={[styles.settlePreviewTitle, { color: '#059669' }]}>Settlement Summary</Text>
              {[
                { label: t('total_billed'), value: totalAmount || 0, color: '#dc2626' },
                { label: t('total_paid'), value: totalPaid || 0, color: '#059669' },
                { label: t('outstanding_amount'), value: Math.abs(outstanding || 0), color: (outstanding || 0) > 0 ? '#dc2626' : '#059669' },
              ].map((row, i) => (
                <View key={i} style={styles.settlePreviewRow}>
                  <Text style={[styles.settlePreviewLabel, { color: theme.colors.text }]}>{row.label}</Text>
                  <Text style={[styles.settlePreviewValue, { color: row.color }]}>{formatCurrency(row.value)}</Text>
                </View>
              ))}
              <Text style={[styles.settlePreviewMeta, { color: theme.colors.muted }]}>
                {totalJobs} job{totalJobs !== 1 ? 's' : ''} will be settled
              </Text>
            </Card>

            <Input
              label="Settlement Notes (optional)"
              value={settleNotes}
              onChangeText={setSettleNotes}
              placeholder="e.g., Settled via cash on 15 Jul"
            />

            <Text style={[styles.settleWarning, { color: isDark ? '#fcd34d' : '#92400e', backgroundColor: isDark ? '#451a03' : '#fffbeb', borderColor: isDark ? '#92400e' : '#fde68a' }]}>
              ⚠️ This will mark all completed jobs and payments as settled. They will be hidden from dashboard totals. You can undo this from Settlement History.
            </Text>

            <View style={styles.modalButtons}>
              <Button title={t('cancel')} variant="secondary" onPress={() => setSettleModal(false)} />
              <Button title="🤝 Settle Now" variant="success" onPress={handleSettle} loading={settleSaving} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Payment Modal ─────────────────────────────────────────── */}
      <Modal visible={paymentModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>💰 {t('add_payment')}</Text>
            <Input label={t('payment_amount')} value={paymentForm.amount} onChangeText={(v) => setPaymentForm({ ...paymentForm, amount: v })} placeholder="0" keyboardType="numeric" />
            <DatePicker label={t('payment_date')} value={paymentForm.paymentDate} onChange={(d) => setPaymentForm({ ...paymentForm, paymentDate: d })} />
            <Input label={t('notes')} value={paymentForm.notes} onChangeText={(v) => setPaymentForm({ ...paymentForm, notes: v })} placeholder={t('payment_notes')} />
            <View style={styles.modalButtons}>
              <Button title={t('cancel')} variant="secondary" onPress={() => setPaymentModal(false)} />
              <Button title={t('save')} variant="success" onPress={handleAddPayment} loading={paymentSaving} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 60 },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  pdfBtn: { width: 70, alignItems: 'flex-end' },
  pdfBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  summaryCard: { width: '47%', padding: 14, alignItems: 'center' },
  summaryEmoji: { fontSize: 20, marginBottom: 4 },
  summaryLabel: { fontSize: 10, textAlign: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '800', marginTop: 2 },

  outstandingCard: { marginHorizontal: 16, marginBottom: 16, alignItems: 'center', paddingVertical: 16 },
  outstandingLabel: { fontSize: 13, fontWeight: '600' },
  outstandingValue: { fontSize: 28, fontWeight: '900', marginTop: 6 },

  // Action row
  actionRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 16 },
  settleBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 14 },
  settleBtnIcon: { fontSize: 24 },
  settleBtnText: { fontSize: 14, fontWeight: '700' },
  settleBtnDesc: { fontSize: 11, marginTop: 2 },

  // Tab toggle
  tabToggle: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, borderRadius: 8, padding: 4 },
  tabToggleBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 6 },
  tabToggleActive: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1 },
  tabToggleText: { fontSize: 13, fontWeight: '500' },

  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 14 },
  empty: { textAlign: 'center', paddingVertical: 20 },

  jobRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1 },
  jobLeft: { flex: 1 },
  jobAsset: { fontSize: 14, fontWeight: '600' },
  jobDate: { fontSize: 12, marginTop: 2 },
  jobDuration: { fontSize: 12, marginTop: 2 },
  jobNotes: { fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  jobAmount: { fontSize: 16, fontWeight: '800', marginLeft: 8 },

  // Settlement rows
  settlementRow: { borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1 },
  settlementHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  settlementBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  settlementInfo: { flex: 1, marginLeft: 10 },
  settlementDate: { fontSize: 14, fontWeight: '600' },
  settlementMeta: { fontSize: 12, marginTop: 2 },
  undoBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  undoBtnText: { fontSize: 12, fontWeight: '600' },
  settlementDetails: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  settlementDetailItem: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center' },
  settlementDetailLabel: { fontSize: 10 },
  settlementDetailValue: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  settlementNotes: { fontSize: 12, fontStyle: 'italic', marginTop: 6 },
  expandedContainer: { marginTop: 10 },
  expandedDivider: { height: 1, marginBottom: 10 },
  expandedTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },

  // Settle preview
  settlePreview: { marginBottom: 16, padding: 14 },
  settlePreviewTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  settlePreviewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  settlePreviewLabel: { fontSize: 14 },
  settlePreviewValue: { fontSize: 15, fontWeight: '700' },
  settlePreviewMeta: { fontSize: 12, marginTop: 10, textAlign: 'center' },
  settleWarning: { fontSize: 12, padding: 12, borderRadius: 8, lineHeight: 18, marginTop: 8, borderWidth: 1 },
});