import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useAppSettings, FEATURE_KEYS } from '../../src/context/AppSettingsContext';
import {
  getBorrowers,
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  updateBorrower,
  deleteBorrower,
  settleBorrower,
  getSettlements,
  getSettlementTransactions,
  deleteSettlement,
} from '../../src/lib/database';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import DatePicker from '../../src/components/DatePicker';
import DateRangeFilter from '../../src/components/DateRangeFilter';
import { HorizontalBarChart } from '../../src/components/charts/HorizontalBarChart';

type ViewTab = 'active' | 'settled';

export default function BorrowerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { isEnabled } = useAppSettings();
  const borrowerId = Number(id);

  const settlementEnabled = isEnabled(FEATURE_KEYS.FEATURE_SETTLEMENT);
  const chartsEnabled = isEnabled(FEATURE_KEYS.FEATURE_CHARTS);

  const [borrower, setBorrower] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeViewTab, setActiveViewTab] = useState<ViewTab>('active');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transactionModal, setTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editBorrowerModal, setEditBorrowerModal] = useState(false);
  const [settleModal, setSettleModal] = useState(false);
  const [settleNotes, setSettleNotes] = useState('');
  const [settleSaving, setSettleSaving] = useState(false);
  const [expandedSettlement, setExpandedSettlement] = useState<number | null>(null);
  const [settlementTxs, setSettlementTxs] = useState<any[]>([]);
  const [loadingSettlementTxs, setLoadingSettlementTxs] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
    type: 'given' as 'given' | 'received',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });
  const [borrowerForm, setBorrowerForm] = useState({
    name: '', phone: '', email: '', address: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  // ── Load Data ───────────────────────────────────────────────────────

  const loadData = async () => {
    if (!user || !borrowerId) return;
    try {
      const allBorrowers = await getBorrowers(user.id);
      const found = allBorrowers.find((b: any) => b.id === borrowerId);
      setBorrower(found || null);
      const filters: any = { borrowerId };
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      const txs = await getTransactions(user.id, filters);
      setTransactions(txs);
      const setts = await getSettlements(user.id, borrowerId);
      setSettlements(setts);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user, borrowerId, startDate, endDate]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const clearDateFilter = () => { setStartDate(''); setEndDate(''); };

  // ── Transaction handlers ────────────────────────────────────────────

  const openTransactionModal = (transaction?: any) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setTransactionForm({
        type: transaction.type,
        amount: String(transaction.amount),
        date: transaction.date,
        description: transaction.description || '',
      });
    } else {
      setEditingTransaction(null);
      setTransactionForm({
        type: 'given', amount: '',
        date: new Date().toISOString().split('T')[0], description: '',
      });
    }
    setTransactionModal(true);
  };

  const handleSaveTransaction = async () => {
    if (!transactionForm.amount) {
      Alert.alert(t('error'), t('enter_amount'));
      return;
    }
    setSaving(true);
    try {
      if (editingTransaction) {
        await updateTransaction(
          editingTransaction.id, user!.id, borrowerId,
          transactionForm.type, parseFloat(transactionForm.amount),
          transactionForm.date, transactionForm.description
        );
      } else {
        await createTransaction(
          user!.id, borrowerId, transactionForm.type,
          parseFloat(transactionForm.amount),
          transactionForm.date, transactionForm.description
        );
      }
      setTransactionModal(false);
      await loadData();
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = (txId: number) => {
    Alert.alert(t('delete_transaction'), t('are_you_sure'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          await deleteTransaction(txId, user!.id);
          await loadData();
        },
      },
    ]);
  };

  // ── Settlement handlers ────────────────────────────────────────────

  const handleOpenSettle = () => { setSettleNotes(''); setSettleModal(true); };

  const handleSettleBorrower = async () => {
    setSettleSaving(true);
    try {
      await settleBorrower(user!.id, borrowerId, settleNotes);
      setSettleModal(false);
      Alert.alert(
        `✅ ${t('account_settled')}`,
        t('all_transactions_settled')
      );
      await loadData();
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setSettleSaving(false);
    }
  };

  const handleUndoSettlement = (settlementId: number) => {
    Alert.alert(t('undo_settlement'), t('undo_settlement_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('undo'), style: 'destructive',
        onPress: async () => {
          try {
            await deleteSettlement(settlementId, user!.id);
            await loadData();
            Alert.alert(`✅ ${t('undo_settlement')}`, t('settlement_undone'));
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
      setSettlementTxs([]);
      return;
    }
    setExpandedSettlement(settlement.id);
    setLoadingSettlementTxs(true);
    try {
      const txs = await getSettlementTransactions(
        user!.id, borrowerId, settlement.settled_at
      );
      setSettlementTxs(txs);
    } catch (error) {
      setSettlementTxs([]);
    } finally {
      setLoadingSettlementTxs(false);
    }
  };

  // ── Borrower handlers ──────────────────────────────────────────────

  const openEditBorrower = () => {
    if (!borrower) return;
    setBorrowerForm({
      name: borrower.name, phone: borrower.phone || '',
      email: borrower.email || '', address: borrower.address || '',
      notes: borrower.notes || '',
    });
    setEditBorrowerModal(true);
  };

  const handleSaveBorrower = async () => {
    if (!borrowerForm.name.trim()) {
      Alert.alert(t('error'), t('name_required'));
      return;
    }
    setSaving(true);
    try {
      await updateBorrower(
        borrowerId, user!.id, borrowerForm.name.trim(),
        borrowerForm.phone, borrowerForm.email,
        borrowerForm.address, borrowerForm.notes
      );
      setEditBorrowerModal(false);
      await loadData();
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBorrower = () => {
    Alert.alert(
      t('delete_borrower'),
      `${borrower?.name}? ${t('delete_borrower_full')}`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive',
          onPress: async () => {
            await deleteBorrower(borrowerId, user!.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleCall = () => {
    if (borrower?.phone) Linking.openURL(`tel:${borrower.phone}`);
  };
  const handleWhatsApp = () => {
    if (borrower?.phone) {
      const phone = borrower.phone.replace(/[^0-9]/g, '');
      Linking.openURL(
        `whatsapp://send?phone=${phone}&text=${encodeURIComponent(`Hi ${borrower.name}`)}`
      );
    }
  };
  const handleEmail = () => {
    if (borrower?.email) Linking.openURL(`mailto:${borrower.email}`);
  };

  // ── Formatting ─────────────────────────────────────────────────────

  const formatCurrency = (amount: number) =>
    '₹' + Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const formatShort = (amount: number) => {
    if (amount >= 100000) return '₹' + (amount / 100000).toFixed(1) + 'L';
    if (amount >= 1000) return '₹' + (amount / 1000).toFixed(1) + 'K';
    return '₹' + amount.toFixed(0);
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch { return dateStr; }
  };

  const totalGiven = transactions
    .filter((tx) => tx.type === 'given')
    .reduce((s, tx) => s + Number(tx.amount || 0), 0);
  const totalReceived = transactions
    .filter((tx) => tx.type === 'received')
    .reduce((s, tx) => s + Number(tx.amount || 0), 0);
  const outstanding = totalGiven - totalReceived;

  const chartData = [
    { label: t('given'), value: totalGiven, color: '#dc2626' },
    { label: t('received'), value: totalReceived, color: '#059669' },
  ];
  const canSettle = transactions.length > 0;

  // ── Loading / Not found ────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.loadingText, { color: theme.colors.muted }]}>
          {t('loading')}
        </Text>
      </View>
    );
  }

  if (!borrower) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.loadingText, { color: theme.colors.muted }]}>
          Borrower not found
        </Text>
        <Button
          title={t('back')}
          onPress={() => router.back()}
          style={{ marginTop: 16 }}
        />
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

      {/* Header */}
      <View style={[
        styles.header,
        { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
      ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: theme.colors.primary }]}>
            ← {t('back')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openEditBorrower}>
          <Text style={[styles.editHeaderBtn, { color: theme.colors.primary }]}>
            ✏️ {t('edit')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.avatarText}>
                {borrower.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.colors.text }]}>
                {borrower.name}
              </Text>
              {borrower.phone && (
                <Text style={[styles.profileMeta, { color: theme.colors.muted }]}>
                  📞 {borrower.phone}
                </Text>
              )}
              {borrower.email && (
                <Text style={[styles.profileMeta, { color: theme.colors.muted }]}>
                  ✉️ {borrower.email}
                </Text>
              )}
              {borrower.address && (
                <Text style={[styles.profileMeta, { color: theme.colors.muted }]}>
                  📍 {borrower.address}
                </Text>
              )}
              {borrower.notes && (
                <Text style={[styles.profileNotes, { color: theme.colors.muted }]}>
                  📝 {borrower.notes}
                </Text>
              )}
            </View>
          </View>

          {/* Quick Actions */}
          <View style={[styles.quickActions, { borderTopColor: theme.colors.border }]}>
            {borrower.phone && (
              <TouchableOpacity
                style={[styles.quickActionBtn, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }]}
                onPress={handleCall}
              >
                <Text style={styles.quickActionIcon}>📞</Text>
                <Text style={[styles.quickActionText, { color: theme.colors.text }]}>
                  {t('call')}
                </Text>
              </TouchableOpacity>
            )}
            {borrower.phone && (
              <TouchableOpacity
                style={[styles.quickActionBtn, { backgroundColor: isDark ? '#064e3b' : '#ecfdf5' }]}
                onPress={handleWhatsApp}
              >
                <Text style={styles.quickActionIcon}>💬</Text>
                <Text style={[styles.quickActionText, { color: theme.colors.text }]}>
                  {t('whatsapp')}
                </Text>
              </TouchableOpacity>
            )}
            {borrower.email && (
              <TouchableOpacity
                style={[styles.quickActionBtn, { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }]}
                onPress={handleEmail}
              >
                <Text style={styles.quickActionIcon}>✉️</Text>
                <Text style={[styles.quickActionText, { color: theme.colors.text }]}>
                  {t('email')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Balance Summary */}
        <View style={styles.summaryGrid}>
          <Card style={[
            styles.summaryCard,
            { backgroundColor: isDark ? theme.colors.dangerSoft : '#fef2f2' },
          ]}>
            <Text style={styles.summaryEmoji}>💸</Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.muted }]}>
              {t('given')}
            </Text>
            <Text style={[styles.summaryValue, { color: '#dc2626' }]}>
              {formatCurrency(totalGiven)}
            </Text>
          </Card>
          <Card style={[
            styles.summaryCard,
            { backgroundColor: isDark ? theme.colors.successSoft : '#ecfdf5' },
          ]}>
            <Text style={styles.summaryEmoji}>💰</Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.muted }]}>
              {t('received')}
            </Text>
            <Text style={[styles.summaryValue, { color: '#059669' }]}>
              {formatCurrency(totalReceived)}
            </Text>
          </Card>
        </View>

        {/* Outstanding Badge */}
        <Card style={[
          styles.outstandingCard,
          {
            backgroundColor: outstanding > 0
              ? isDark ? theme.colors.dangerSoft : '#fef2f2'
              : outstanding < 0
              ? isDark ? theme.colors.successSoft : '#ecfdf5'
              : isDark ? '#1e293b' : '#f0fdf4',
          },
        ]}>
          <Text style={[styles.outstandingLabel, { color: theme.colors.text }]}>
            {outstanding > 0
              ? `⚠️ ${t('they_owe_you')}`
              : outstanding < 0
              ? `⚠️ ${t('you_owe_them')}`
              : `✅ ${t('all_settled')}`}
          </Text>
          <Text style={[
            styles.outstandingValue,
            { color: outstanding > 0 ? '#dc2626' : outstanding < 0 ? '#059669' : '#059669' },
          ]}>
            {formatCurrency(Math.abs(outstanding))}
          </Text>
          <Text style={[styles.outstandingMeta, { color: theme.colors.muted }]}>
            {transactions.length}{' '}
            {transactions.length !== 1
              ? t('active_transactions')
              : t('active_transaction')}
            {settlements.length > 0
              ? ` • ${settlements.length} ${settlements.length !== 1 ? t('settlements_label') : t('settlement')}`
              : ''}
          </Text>
        </Card>

        {/* Settle Button */}
        {canSettle && settlementEnabled && (
          <TouchableOpacity
            style={[
              styles.settleButton,
              {
                backgroundColor: isDark ? '#064e3b' : '#f0fdf4',
                borderColor: isDark ? '#059669' : '#86efac',
              },
            ]}
            onPress={handleOpenSettle}
            activeOpacity={0.8}
          >
            <Text style={styles.settleButtonIcon}>🤝</Text>
            <View>
              <Text style={[styles.settleButtonText, { color: '#059669' }]}>
                {t('settle_account')}
              </Text>
              <Text style={[styles.settleButtonDesc, { color: theme.colors.muted }]}>
                {t('settle_account_desc')}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Chart */}
        {chartsEnabled && (totalGiven > 0 || totalReceived > 0) && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              📊 {t('given_vs_received')}
            </Text>
            <HorizontalBarChart data={chartData} formatValue={formatShort} />
          </Card>
        )}

        {/* Quick Add Buttons */}
        <View style={styles.quickAddRow}>
          <TouchableOpacity
            style={[styles.quickAddBtn, { backgroundColor: '#dc2626' }]}
            onPress={() => {
              setTransactionForm({
                type: 'given', amount: '',
                date: new Date().toISOString().split('T')[0], description: '',
              });
              setEditingTransaction(null);
              setTransactionModal(true);
            }}
          >
            <Text style={styles.quickAddIcon}>💸</Text>
            <Text style={styles.quickAddText}>{t('give_money')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickAddBtn, { backgroundColor: '#059669' }]}
            onPress={() => {
              setTransactionForm({
                type: 'received', amount: '',
                date: new Date().toISOString().split('T')[0], description: '',
              });
              setEditingTransaction(null);
              setTransactionModal(true);
            }}
          >
            <Text style={styles.quickAddIcon}>💰</Text>
            <Text style={styles.quickAddText}>{t('receive_money')}</Text>
          </TouchableOpacity>
        </View>

        {/* View Toggle */}
        <View style={[styles.viewToggle, { backgroundColor: isDark ? '#334155' : '#e5e7eb' }]}>
          <TouchableOpacity
            style={[
              styles.viewToggleBtn,
              activeViewTab === 'active' && [
                styles.viewToggleActive,
                { backgroundColor: theme.colors.surface },
              ],
            ]}
            onPress={() => setActiveViewTab('active')}
          >
            {/* Emoji + text separated for Hindi */}
            <View style={styles.viewToggleContent}>
              <Text style={styles.viewToggleEmoji}>📋</Text>
              <Text style={[
                styles.viewToggleText,
                { color: theme.colors.muted },
                activeViewTab === 'active' && {
                  color: theme.colors.text, fontWeight: '600',
                },
              ]}>
                {t('active_tab')} ({transactions.length})
              </Text>
            </View>
          </TouchableOpacity>

          {/* Only show Settled tab if settlement enabled */}
          {settlementEnabled && (
            <TouchableOpacity
              style={[
                styles.viewToggleBtn,
                activeViewTab === 'settled' && [
                  styles.viewToggleActive,
                  { backgroundColor: theme.colors.surface },
                ],
              ]}
              onPress={() => setActiveViewTab('settled')}
            >
              <View style={styles.viewToggleContent}>
                <Text style={styles.viewToggleEmoji}>✅</Text>
                <Text style={[
                  styles.viewToggleText,
                  { color: theme.colors.muted },
                  activeViewTab === 'settled' && {
                    color: theme.colors.text, fontWeight: '600',
                  },
                ]}>
                  {t('settled_tab')} ({settlements.length})
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Active Transactions */}
        {activeViewTab === 'active' && (
          <>
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
                onClear={clearDateFilter}
                title={`📅 ${t('filter_transactions')}`}
                autoSetDefaults={false}
              />
            </View>

            <Card style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                📋 {t('active_transactions_title')} ({transactions.length})
              </Text>
              {transactions.length === 0 ? (
                <Text style={[styles.empty, { color: theme.colors.muted }]}>
                  {t('no_active_transactions')}
                  {startDate || endDate ? ` ${t('no_transactions_date')}` : ''}
                </Text>
              ) : (
                transactions.map((tx) => (
                  <View
                    key={tx.id}
                    style={[styles.txRow, { borderBottomColor: theme.colors.border }]}
                  >
                    <View style={[
                      styles.txIcon,
                      {
                        backgroundColor: tx.type === 'given'
                          ? isDark ? '#450a0a' : '#fef2f2'
                          : isDark ? '#064e3b' : '#ecfdf5',
                      },
                    ]}>
                      <Text style={styles.txIconText}>
                        {tx.type === 'given' ? '↗️' : '↙️'}
                      </Text>
                    </View>
                    <View style={styles.txInfo}>
                      {/* Emoji + text separated for Hindi */}
                      <View style={styles.txTypeRow}>
                        <Text style={styles.txTypeEmoji}>
                          {tx.type === 'given' ? '💸' : '💰'}
                        </Text>
                        <Text style={[styles.txType, { color: theme.colors.text }]}>
                          {tx.type === 'given' ? t('money_given') : t('money_received')}
                        </Text>
                      </View>
                      <Text style={[styles.txDate, { color: theme.colors.muted }]}>
                        📅 {tx.date}
                      </Text>
                      {tx.description && (
                        <Text style={[styles.txDesc, { color: theme.colors.muted }]}>
                          {tx.description}
                        </Text>
                      )}
                    </View>
                    <View style={styles.txRight}>
                      <Text style={[
                        styles.txAmount,
                        tx.type === 'given' ? styles.negative : styles.positive,
                      ]}>
                        {tx.type === 'given' ? '-' : '+'}{formatCurrency(tx.amount)}
                      </Text>
                      <View style={styles.txActions}>
                        <TouchableOpacity
                          onPress={() => openTransactionModal(tx)}
                          style={[
                            styles.txEditBtn,
                            { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' },
                          ]}
                        >
                          <Text style={styles.txEditBtnText}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteTransaction(tx.id)}>
                          <Text style={styles.txDeleteBtn}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </Card>
          </>
        )}

        {/* Settlement History */}
        {settlementEnabled && activeViewTab === 'settled' && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              ✅ {t('settlement_history')} ({settlements.length})
            </Text>
            {settlements.length === 0 ? (
              <Text style={[styles.empty, { color: theme.colors.muted }]}>
                {t('no_settlements_yet')}
              </Text>
            ) : (
              settlements.map((s) => (
                <View
                  key={s.id}
                  style={[
                    styles.settlementRow,
                    {
                      backgroundColor: isDark ? '#1e293b' : '#f9fafb',
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  {/* Header */}
                  <TouchableOpacity
                    onPress={() => handleToggleSettlement(s)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.settlementHeader}>
                      <View style={[
                        styles.settlementBadge,
                        { backgroundColor: isDark ? '#064e3b' : '#d1fae5' },
                      ]}>
                        <Text style={styles.settlementBadgeText}>🤝</Text>
                      </View>
                      <View style={styles.settlementInfo}>
                        <Text style={[styles.settlementDate, { color: theme.colors.text }]}>
                          {t('settled_on')} {formatDateTime(s.settled_at)}
                        </Text>
                        <Text style={[styles.settlementMeta, { color: theme.colors.muted }]}>
                          {s.transaction_count}{' '}
                          {s.transaction_count !== 1
                            ? t('active_transactions')
                            : t('active_transaction')}{' '}
                          •{' '}
                          {expandedSettlement === s.id
                            ? `${t('tap_to_collapse')} ▲`
                            : `${t('tap_to_expand')} ▼`}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleUndoSettlement(s.id)}
                        style={[
                          styles.undoBtn,
                          {
                            backgroundColor: isDark ? '#451a03' : '#fff7ed',
                            borderColor: isDark ? '#92400e' : '#fed7aa',
                          },
                        ]}
                      >
                        <Text style={[styles.undoBtnText, { color: '#ea580c' }]}>
                          ↩️ {t('undo')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>

                  {/* Summary */}
                  <View style={styles.settlementDetails}>
                    {[
                      { label: t('given'), value: s.total_given, color: '#dc2626' },
                      { label: t('received'), value: s.total_received, color: '#059669' },
                      {
                        label: t('balance'),
                        value: Math.abs(s.balance),
                        color: s.balance > 0 ? '#dc2626'
                          : s.balance < 0 ? '#059669'
                          : theme.colors.muted,
                      },
                    ].map((item, i) => (
                      <View
                        key={i}
                        style={[
                          styles.settlementDetailItem,
                          { backgroundColor: isDark ? '#0f172a' : '#fff' },
                        ]}
                      >
                        <Text style={[styles.settlementDetailLabel, { color: theme.colors.muted }]}>
                          {item.label}
                        </Text>
                        <Text style={[styles.settlementDetailValue, { color: item.color }]}>
                          {formatCurrency(item.value)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {s.notes && (
                    <Text style={[styles.settlementNotes, { color: theme.colors.muted }]}>
                      📝 {s.notes}
                    </Text>
                  )}

                  {/* Expanded Transactions */}
                  {expandedSettlement === s.id && (
                    <View style={styles.settledTxContainer}>
                      <View style={[
                        styles.settledTxDivider,
                        { backgroundColor: theme.colors.border },
                      ]} />
                      <Text style={[styles.settledTxTitle, { color: theme.colors.text }]}>
                        📋 {t('settled_transactions')}
                      </Text>

                      {loadingSettlementTxs ? (
                        <Text style={[styles.settledTxLoading, { color: theme.colors.muted }]}>
                          {t('loading_transactions')}
                        </Text>
                      ) : settlementTxs.length === 0 ? (
                        <Text style={[styles.settledTxEmpty, { color: theme.colors.muted }]}>
                          {t('no_transactions_found')}
                        </Text>
                      ) : (
                        settlementTxs.map((stx) => (
                          <View
                            key={stx.id}
                            style={[
                              styles.settledTxRow,
                              { borderBottomColor: theme.colors.border },
                            ]}
                          >
                            <View style={[
                              styles.settledTxDot,
                              {
                                backgroundColor: stx.type === 'given'
                                  ? isDark ? '#450a0a' : '#fecaca'
                                  : isDark ? '#064e3b' : '#bbf7d0',
                              },
                            ]}>
                              <Text style={[styles.settledTxDotText, { color: theme.colors.text }]}>
                                {stx.type === 'given' ? '↗' : '↙'}
                              </Text>
                            </View>
                            <View style={styles.settledTxInfo}>
                              {/* Emoji + text separated for Hindi */}
                              <View style={styles.settledTxTypeRow}>
                                <Text style={styles.settledTxTypeEmoji}>
                                  {stx.type === 'given' ? '💸' : '💰'}
                                </Text>
                                <Text style={[styles.settledTxType, { color: theme.colors.text }]}>
                                  {stx.type === 'given' ? t('money_given') : t('money_received')}
                                </Text>
                              </View>
                              <Text style={[styles.settledTxDate, { color: theme.colors.muted }]}>
                                {stx.date}
                              </Text>
                              {stx.description && (
                                <Text style={[styles.settledTxDesc, { color: theme.colors.muted }]}>
                                  {stx.description}
                                </Text>
                              )}
                            </View>
                            <Text style={[
                              styles.settledTxAmount,
                              { color: stx.type === 'given' ? '#dc2626' : '#059669' },
                            ]}>
                              {stx.type === 'given' ? '-' : '+'}{formatCurrency(stx.amount)}
                            </Text>
                          </View>
                        ))
                      )}

                      {settlementTxs.length > 0 && (
                        <View style={[
                          styles.settledTxTotalRow,
                          { borderTopColor: isDark ? '#475569' : '#d1d5db' },
                        ]}>
                          <Text style={[styles.settledTxTotalLabel, { color: theme.colors.text }]}>
                            {t('net_balance')}
                          </Text>
                          <Text style={[
                            styles.settledTxTotalValue,
                            {
                              color: s.balance > 0 ? '#dc2626'
                                : s.balance < 0 ? '#059669'
                                : theme.colors.muted,
                            },
                          ]}>
                            {s.balance > 0
                              ? `${t('owed')} ${formatCurrency(s.balance)}`
                              : s.balance < 0
                              ? `${t('overpaid')} ${formatCurrency(Math.abs(s.balance))}`
                              : t('fully_settled')}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ))
            )}
          </Card>
        )}

        {/* Danger Zone */}
        <Card style={[
          styles.dangerCard,
          {
            backgroundColor: isDark ? '#450a0a' : '#fef2f2',
            borderColor: isDark ? '#dc2626' : '#fecaca',
          },
        ]}>
          <Text style={styles.dangerTitle}>⚠️ {t('danger_zone')}</Text>
          <Text style={[styles.dangerDesc, { color: theme.colors.muted }]}>
            {t('delete_borrower_full')}
          </Text>
          <Button
            title={`🗑️ ${t('delete_borrower')}`}
            variant="danger"
            onPress={handleDeleteBorrower}
          />
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Transaction Modal ──────────────────────────────────────── */}
      <Modal visible={transactionModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {editingTransaction ? t('edit_transaction') : t('add_transaction')}
            </Text>

            {/* Type Toggle - emoji + text separated */}
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  { backgroundColor: isDark ? '#334155' : '#e5e7eb' },
                  transactionForm.type === 'given' && styles.typeGivenActive,
                ]}
                onPress={() =>
                  setTransactionForm({ ...transactionForm, type: 'given' })
                }
              >
                <View style={styles.typeContent}>
                  <Text style={styles.typeEmoji}>💸</Text>
                  <Text style={[
                    styles.typeText,
                    { color: theme.colors.muted },
                    transactionForm.type === 'given' && styles.typeTextActive,
                  ]}>
                    {t('given')}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  { backgroundColor: isDark ? '#334155' : '#e5e7eb' },
                  transactionForm.type === 'received' && styles.typeReceivedActive,
                ]}
                onPress={() =>
                  setTransactionForm({ ...transactionForm, type: 'received' })
                }
              >
                <View style={styles.typeContent}>
                  <Text style={styles.typeEmoji}>💰</Text>
                  <Text style={[
                    styles.typeText,
                    { color: theme.colors.muted },
                    transactionForm.type === 'received' && styles.typeTextActive,
                  ]}>
                    {t('received')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <Input
              label={`${t('amount')} *`}
              value={transactionForm.amount}
              onChangeText={(v) =>
                setTransactionForm({ ...transactionForm, amount: v })
              }
              placeholder="0"
              keyboardType="numeric"
            />
            <DatePicker
              label={t('date')}
              value={transactionForm.date}
              onChange={(d) =>
                setTransactionForm({ ...transactionForm, date: d })
              }
            />
            <Input
              label={t('description')}
              value={transactionForm.description}
              onChangeText={(v) =>
                setTransactionForm({ ...transactionForm, description: v })
              }
              placeholder={t('optional_description')}
            />

            <View style={styles.modalButtons}>
              <Button
                title={t('cancel')}
                variant="secondary"
                onPress={() => setTransactionModal(false)}
              />
              <Button
                title={t('save')}
                onPress={handleSaveTransaction}
                loading={saving}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Settle Modal ───────────────────────────────────────────── */}
      <Modal visible={settleModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              🤝 {t('settle_account')}
            </Text>

            <Card style={[
              styles.settlePreviewCard,
              { backgroundColor: isDark ? '#064e3b' : '#f0fdf4' },
            ]}>
              <Text style={[styles.settlePreviewTitle, { color: '#059669' }]}>
                {t('settlement_summary')}
              </Text>
              <View style={styles.settlePreviewRow}>
                <Text style={[styles.settlePreviewLabel, { color: theme.colors.text }]}>
                  {t('total_given')}
                </Text>
                <Text style={[styles.settlePreviewValue, { color: '#dc2626' }]}>
                  {formatCurrency(totalGiven)}
                </Text>
              </View>
              <View style={styles.settlePreviewRow}>
                <Text style={[styles.settlePreviewLabel, { color: theme.colors.text }]}>
                  {t('total_received')}
                </Text>
                <Text style={[styles.settlePreviewValue, { color: '#059669' }]}>
                  {formatCurrency(totalReceived)}
                </Text>
              </View>
              <View style={[
                styles.settlePreviewRow,
                {
                  borderTopWidth: 1,
                  borderTopColor: isDark ? '#059669' : '#d1fae5',
                  paddingTop: 10,
                  marginTop: 6,
                },
              ]}>
                <Text style={[
                  styles.settlePreviewLabel,
                  { fontWeight: '700', color: theme.colors.text },
                ]}>
                  {t('outstanding')}
                </Text>
                <Text style={[
                  styles.settlePreviewValue,
                  {
                    fontSize: 18,
                    color: outstanding > 0 ? '#dc2626'
                      : outstanding < 0 ? '#059669'
                      : theme.colors.muted,
                  },
                ]}>
                  {formatCurrency(Math.abs(outstanding))}
                </Text>
              </View>
              <Text style={[styles.settlePreviewMeta, { color: theme.colors.muted }]}>
                {transactions.length}{' '}
                {transactions.length !== 1
                  ? t('transactions_will_settle')
                  : t('transaction_will_settle')}
              </Text>
            </Card>

            <Input
              label={t('settlement_notes')}
              value={settleNotes}
              onChangeText={setSettleNotes}
              placeholder={t('settlement_notes_placeholder')}
            />

            <Text style={[
              styles.settleWarning,
              {
                color: isDark ? '#fcd34d' : '#92400e',
                backgroundColor: isDark ? '#451a03' : '#fffbeb',
                borderColor: isDark ? '#92400e' : '#fde68a',
              },
            ]}>
              ⚠️ {t('settle_warning')}
            </Text>

            <View style={styles.modalButtons}>
              <Button
                title={t('cancel')}
                variant="secondary"
                onPress={() => setSettleModal(false)}
              />
              <Button
                title={`🤝 ${t('settle_now')}`}
                variant="success"
                onPress={handleSettleBorrower}
                loading={settleSaving}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit Borrower Modal ────────────────────────────────────── */}
      <Modal visible={editBorrowerModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <ScrollView
            style={[styles.modalScrollContent, { backgroundColor: theme.colors.modalBg }]}
            bounces={false}
          >
            <View style={styles.modalInner}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {t('edit_borrower')}
              </Text>
              <Input
                label={`${t('name')} *`}
                value={borrowerForm.name}
                onChangeText={(v) => setBorrowerForm({ ...borrowerForm, name: v })}
                placeholder={t('name')}
              />
              <Input
                label={t('phone')}
                value={borrowerForm.phone}
                onChangeText={(v) => setBorrowerForm({ ...borrowerForm, phone: v })}
                placeholder={t('phone')}
                keyboardType="phone-pad"
              />
              <Input
                label={t('email')}
                value={borrowerForm.email}
                onChangeText={(v) => setBorrowerForm({ ...borrowerForm, email: v })}
                placeholder={t('email')}
              />
              <Input
                label={t('address')}
                value={borrowerForm.address}
                onChangeText={(v) => setBorrowerForm({ ...borrowerForm, address: v })}
                placeholder={t('address')}
              />
              <Input
                label={t('notes')}
                value={borrowerForm.notes}
                onChangeText={(v) => setBorrowerForm({ ...borrowerForm, notes: v })}
                placeholder={t('notes')}
              />
              <View style={styles.modalButtons}>
                <Button
                  title={t('cancel')}
                  variant="secondary"
                  onPress={() => setEditBorrowerModal(false)}
                />
                <Button
                  title={t('save')}
                  onPress={handleSaveBorrower}
                  loading={saving}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { paddingVertical: 6 },
  backBtnText: { fontSize: 16, fontWeight: '600' },
  editHeaderBtn: { fontSize: 15, fontWeight: '600' },

  // Profile
  profileCard: { margin: 16, marginBottom: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  profileInfo: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 22, fontWeight: '700' },
  profileMeta: { fontSize: 13, marginTop: 3 },
  profileNotes: { fontSize: 13, marginTop: 3, fontStyle: 'italic' },

  // Quick actions
  quickActions: { flexDirection: 'row', gap: 8, marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  quickActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  quickActionIcon: { fontSize: 16 },
  quickActionText: { fontSize: 13, fontWeight: '600' },

  // Summary
  summaryGrid: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  summaryEmoji: { fontSize: 22, marginBottom: 4 },
  summaryLabel: { fontSize: 11 },
  summaryValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },

  // Outstanding
  outstandingCard: { marginHorizontal: 16, marginBottom: 12, alignItems: 'center', paddingVertical: 18 },
  outstandingLabel: { fontSize: 13, fontWeight: '600' },
  outstandingValue: { fontSize: 32, fontWeight: '800', marginTop: 4 },
  outstandingMeta: { fontSize: 12, marginTop: 6 },

  // Settle button
  settleButton: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 16, borderWidth: 1.5, borderRadius: 14, padding: 16 },
  settleButtonIcon: { fontSize: 28 },
  settleButtonText: { fontSize: 16, fontWeight: '700' },
  settleButtonDesc: { fontSize: 12, marginTop: 2 },

  // Section
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 14 },
  empty: { textAlign: 'center', paddingVertical: 20 },

  // View toggle
  viewToggle: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, borderRadius: 8, padding: 4 },
  viewToggleBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 6 },
  viewToggleActive: {},
  viewToggleContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewToggleEmoji: { fontSize: 13 },
  viewToggleText: { fontSize: 13, fontWeight: '500' },
  viewToggleTextActive: {},

  // Quick add
  quickAddRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  quickAddBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  quickAddIcon: { fontSize: 18 },
  quickAddText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Transaction rows
  txRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1 },
  txIcon: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  txIconText: { fontSize: 16 },
  txInfo: { flex: 1, marginLeft: 10 },
  txTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  txTypeEmoji: { fontSize: 13 },
  txType: { fontSize: 14, fontWeight: '500' },
  txDate: { fontSize: 12, marginTop: 2 },
  txDesc: { fontSize: 12, marginTop: 3, fontStyle: 'italic' },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 16, fontWeight: '700' },
  txActions: { flexDirection: 'row', gap: 4, marginTop: 6 },
  txEditBtn: { padding: 4, borderRadius: 6 },
  txEditBtnText: { fontSize: 12 },
  txDeleteBtn: { fontSize: 16, padding: 4 },

  positive: { color: '#059669' },
  negative: { color: '#dc2626' },

  // Settlement rows
  settlementRow: { borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1 },
  settlementHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  settlementBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  settlementBadgeText: { fontSize: 18 },
  settlementInfo: { flex: 1, marginLeft: 10 },
  settlementDate: { fontSize: 14, fontWeight: '600' },
  settlementMeta: { fontSize: 12, marginTop: 2 },
  undoBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  undoBtnText: { fontSize: 12, fontWeight: '600' },
  settlementDetails: { flexDirection: 'row', gap: 8 },
  settlementDetailItem: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center' },
  settlementDetailLabel: { fontSize: 10 },
  settlementDetailValue: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  settlementNotes: { fontSize: 12, fontStyle: 'italic', marginTop: 10 },

  // Settled transaction list
  settledTxContainer: { marginTop: 12 },
  settledTxDivider: { height: 1, marginBottom: 12 },
  settledTxTitle: { fontSize: 13, fontWeight: '700', marginBottom: 10 },
  settledTxLoading: { textAlign: 'center', fontSize: 13, paddingVertical: 12 },
  settledTxEmpty: { textAlign: 'center', fontSize: 13, paddingVertical: 12 },
  settledTxRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1 },
  settledTxDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  settledTxDotText: { fontSize: 13, fontWeight: '700' },
  settledTxInfo: { flex: 1, marginLeft: 10 },
  settledTxTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settledTxTypeEmoji: { fontSize: 12 },
  settledTxType: { fontSize: 13, fontWeight: '500' },
  settledTxDate: { fontSize: 11, marginTop: 2 },
  settledTxDesc: { fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  settledTxAmount: { fontSize: 14, fontWeight: '700' },
  settledTxTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1.5 },
  settledTxTotalLabel: { fontSize: 13, fontWeight: '700' },
  settledTxTotalValue: { fontSize: 15, fontWeight: '800' },

  // Danger zone
  dangerCard: { marginHorizontal: 16, marginBottom: 16, borderWidth: 1 },
  dangerTitle: { fontSize: 15, fontWeight: '700', color: '#dc2626', marginBottom: 6 },
  dangerDesc: { fontSize: 13, marginBottom: 14 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalScrollContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  modalInner: { padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },

  // Type toggle
  typeToggle: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  typeGivenActive: { backgroundColor: '#dc2626' },
  typeReceivedActive: { backgroundColor: '#059669' },
  typeContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeEmoji: { fontSize: 16 },
  typeText: { fontSize: 14, fontWeight: '500' },
  typeTextActive: { color: '#fff' },

  // Settle modal
  settlePreviewCard: { marginBottom: 16, borderWidth: 0 },
  settlePreviewTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  settlePreviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  settlePreviewLabel: { fontSize: 14 },
  settlePreviewValue: { fontSize: 15, fontWeight: '700' },
  settlePreviewMeta: { fontSize: 12, marginTop: 10, textAlign: 'center' },
  settleWarning: { fontSize: 12, padding: 12, borderRadius: 8, lineHeight: 18, marginTop: 8, borderWidth: 1 },
});