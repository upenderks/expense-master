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
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
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
  createBorrower,
  updateBorrower,
  deleteBorrower,
} from '../../src/lib/database';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Select } from '../../src/components/Select';
import DatePicker from '../../src/components/DatePicker';
import DateRangeFilter from '../../src/components/DateRangeFilter';
import { EmptyState } from '../../src/components/EmptyState';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { StatPill } from '../../src/components/StatPill';
import { formatCurrency, formatCompactCurrency } from '../../src/lib/formatters';

type Tab = 'borrowers' | 'transactions';

export default function Money() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { isEnabled } = useAppSettings();

  const settlementEnabled = isEnabled(FEATURE_KEYS.FEATURE_SETTLEMENT);

  const [activeTab, setActiveTab] = useState<Tab>('borrowers');
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [borrowerModal, setBorrowerModal] = useState(false);
  const [editingBorrower, setEditingBorrower] = useState<any>(null);
  const [transactionModal, setTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [borrowerForm, setBorrowerForm] = useState({
    name: '', phone: '', email: '', address: '', notes: '',
  });
  const [transactionForm, setTransactionForm] = useState({
    borrowerId: '' as number | string,
    type: 'given' as 'given' | 'received',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    if (!user) return;
    try {
      const filters = startDate || endDate
        ? { startDate: startDate || undefined, endDate: endDate || undefined }
        : undefined;
      const [borrowersData, transactionsData] = await Promise.all([
        getBorrowers(user.id),
        getTransactions(user.id, filters),
      ]);
      setBorrowers(borrowersData);
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [user, startDate, endDate]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  const openBorrowerModal = (borrower?: any) => {
    if (borrower) {
      setEditingBorrower(borrower);
      setBorrowerForm({
        name: borrower.name, phone: borrower.phone || '',
        email: borrower.email || '', address: borrower.address || '',
        notes: borrower.notes || '',
      });
    } else {
      setEditingBorrower(null);
      setBorrowerForm({ name: '', phone: '', email: '', address: '', notes: '' });
    }
    setBorrowerModal(true);
  };

  const handleSaveBorrower = async () => {
    if (!borrowerForm.name.trim()) {
      Alert.alert(t('error'), t('name_required'));
      return;
    }
    setSaving(true);
    try {
      if (editingBorrower) {
        await updateBorrower(
          editingBorrower.id, user!.id,
          borrowerForm.name, borrowerForm.phone,
          borrowerForm.email, borrowerForm.address, borrowerForm.notes
        );
      } else {
        await createBorrower(
          user!.id, borrowerForm.name, borrowerForm.phone,
          borrowerForm.email, borrowerForm.address, borrowerForm.notes
        );
      }
      setBorrowerModal(false);
      loadData();
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBorrower = (id: number, name: string) => {
    Alert.alert(
      t('delete_borrower'),
      `${name}? ${t('delete_borrower_confirm')}`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive',
          onPress: async () => { await deleteBorrower(id, user!.id); loadData(); },
        },
      ]
    );
  };

  const openTransactionModal = (transaction?: any) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setTransactionForm({
        borrowerId: transaction.borrower_id, type: transaction.type,
        amount: transaction.amount.toString(), date: transaction.date,
        description: transaction.description || '',
      });
    } else {
      setEditingTransaction(null);
      setTransactionForm({
        borrowerId: '', type: 'given', amount: '',
        date: new Date().toISOString().split('T')[0], description: '',
      });
    }
    setTransactionModal(true);
  };

  const handleSaveTransaction = async () => {
    if (!transactionForm.borrowerId || !transactionForm.amount) {
      Alert.alert(t('error'), t('select_borrower_amount'));
      return;
    }
    setSaving(true);
    try {
      if (editingTransaction) {
        await updateTransaction(
          editingTransaction.id, user!.id,
          Number(transactionForm.borrowerId), transactionForm.type,
          parseFloat(transactionForm.amount), transactionForm.date,
          transactionForm.description
        );
      } else {
        await createTransaction(
          user!.id, Number(transactionForm.borrowerId),
          transactionForm.type, parseFloat(transactionForm.amount),
          transactionForm.date, transactionForm.description
        );
      }
      setTransactionModal(false);
      loadData();
    } catch (error) {
      Alert.alert(t('error'), (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = (id: number) => {
    Alert.alert(t('delete_transaction'), t('are_you_sure'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => { await deleteTransaction(id, user!.id); loadData(); },
      },
    ]);
  };

  // const formatCurrency = (amount: number) =>
  //   '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // const formatShort = (amount: number) => {
  //   if (amount >= 100000) return '₹' + (amount / 100000).toFixed(1) + 'L';
  //   if (amount >= 1000) return '₹' + (amount / 1000).toFixed(1) + 'K';
  //   console.log('Amount:', '₹' + amount.toFixed(2));
  //   return '₹' + amount.toFixed(2);
  // };

  const totalGiven = transactions
    .filter((tx) => tx.type === 'given')
    .reduce((s, tx) => s + tx.amount, 0);

  const totalReceived = transactions
    .filter((tx) => tx.type === 'received')
    .reduce((s, tx) => s + tx.amount, 0);

  const outstanding = totalGiven - totalReceived;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

      {/* ── Screen Header ─────────────────────────────────────────── */}
      <ScreenHeader
        emoji="💰"
        title={t('tab_money')}
        subtitle={`${t('outstanding')}: ${formatCompactCurrency(Math.abs(outstanding))}`}
      >
        <View style={styles.headerStats}>
          <StatPill
            emoji="👥"
            label={t('borrowers')}
            value={String(borrowers.length)}
          />
          <StatPill
            emoji="💸"
            label={t('given')}
            value={formatCompactCurrency(totalGiven)}
          />
          {/* <StatPill
            emoji="💰"
            label={t('received')}
            value={formatShort(totalReceived)}
          /> */}
        </View>
      </ScreenHeader>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <View style={[styles.tabs, { backgroundColor: isDark ? '#334155' : '#e5e7eb' }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'borrowers' && [styles.activeTab, { backgroundColor: theme.colors.surface }],
          ]}
          onPress={() => setActiveTab('borrowers')}
        >
          <View style={styles.tabContent}>
            <Text style={styles.tabEmoji}>👥</Text>
            <Text style={[
              styles.tabLabel,
              { color: theme.colors.muted },
              activeTab === 'borrowers' && { color: theme.colors.text, fontWeight: '600' },
            ]}>
              {t('borrowers')}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'transactions' && [styles.activeTab, { backgroundColor: theme.colors.surface }],
          ]}
          onPress={() => setActiveTab('transactions')}
        >
          <View style={styles.tabContent}>
            <Text style={styles.tabEmoji}>💱</Text>
            <Text style={[
              styles.tabLabel,
              { color: theme.colors.muted },
              activeTab === 'transactions' && { color: theme.colors.text, fontWeight: '600' },
            ]}>
              {t('transactions')}
            </Text>
          </View>
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
        {activeTab === 'borrowers' ? (
          <>
            {borrowers.length === 0 ? (
              <Card>
                <EmptyState
                  emoji="👥"
                  title={t('no_borrowers_add')}
                  subtitle={t('app_tagline')}
                  actionHint={`+ ${t('add_borrower')}`}
                  onAction={() => openBorrowerModal()}
                />
              </Card>
            ) : (
              borrowers.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/borrower/${b.id}`)}
                >
                  <Card style={styles.itemCard}>
                    <View style={styles.borrowerHeader}>
                      <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
                        <Text style={styles.avatarText}>
                          {b.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.borrowerName, { color: theme.colors.text }]}>
                          {b.name}
                        </Text>
                        {b.phone && (
                          <Text style={[styles.borrowerMeta, { color: theme.colors.muted }]}>
                            📞 {b.phone}
                          </Text>
                        )}
                      </View>
                      <View style={[
                        styles.chevron,
                        { backgroundColor: isDark ? '#334155' : '#f3f4f6' },
                      ]}>
                        <Text style={[styles.chevronText, { color: theme.colors.muted }]}>›</Text>
                      </View>
                    </View>

                    <View style={[styles.balanceRow, { borderTopColor: theme.colors.border }]}>
                      <Text style={[styles.balanceLabel, { color: theme.colors.muted }]}>
                        {t('balance')}:
                      </Text>
                      <Text style={[
                        styles.balanceAmount,
                        b.balance > 0 ? styles.positive
                          : b.balance < 0 ? styles.negative
                          : { color: theme.colors.muted },
                      ]}>
                        {b.balance > 0
                          ? `${t('owes')} ${formatCurrency(b.balance)}`
                          : b.balance < 0
                          ? `${t('owed')} ${formatCurrency(Math.abs(b.balance))}`
                          : t('settled')}
                      </Text>
                    </View>

                    <Text style={[styles.tapHint, { color: theme.colors.primary }]}>
                      {t('tap_view_details')} →
                    </Text>
                  </Card>
                </TouchableOpacity>
              ))
            )}
            <Button
              title={`+ ${t('add_borrower')}`}
              onPress={() => openBorrowerModal()}
              style={styles.addBtn}
            />
          </>
        ) : (
          <>
            {/* Date Filter */}
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
                onClear={clearDateFilter}
              />
            </View>

            {/* Summary Cards */}
            <View style={styles.summaryRow}>
              <Card style={[
                styles.summaryCard,
                { backgroundColor: isDark ? theme.colors.dangerSoft : '#fef2f2' },
              ]}>
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
                <Text style={[styles.summaryLabel, { color: theme.colors.muted }]}>
                  {t('received')}
                </Text>
                <Text style={[styles.summaryValue, { color: '#059669' }]}>
                  {formatCurrency(totalReceived)}
                </Text>
              </Card>
            </View>

            {transactions.length === 0 ? (
              <Card>
                <EmptyState
                  emoji="💱"
                  title={startDate || endDate
                    ? t('no_transactions_date')
                    : t('no_transactions_yet')}
                  actionHint={`+ ${t('add_transaction')}`}
                  onAction={() => openTransactionModal()}
                />
              </Card>
            ) : (
              transactions.map((tx) => (
                <Card key={tx.id} style={styles.itemCard}>
                  <View style={styles.transactionHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.transactionName, { color: theme.colors.text }]}>
                        {tx.borrower_name}
                      </Text>
                      <View style={styles.transactionTypeRow}>
                        <Text style={styles.transactionTypeEmoji}>
                          {tx.type === 'given' ? '💸' : '💰'}
                        </Text>
                        <Text style={[styles.transactionType, { color: theme.colors.muted }]}>
                          {tx.type === 'given' ? t('money_given') : t('money_received')}
                        </Text>
                      </View>
                      <Text style={[styles.transactionDate, { color: theme.colors.muted }]}>
                        📅 {tx.date}
                      </Text>
                      {tx.description && (
                        <Text style={[styles.transactionDesc, { color: theme.colors.muted }]}>
                          {tx.description}
                        </Text>
                      )}
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[
                        styles.transactionAmount,
                        tx.type === 'given' ? styles.negative : styles.positive,
                      ]}>
                        {tx.type === 'given' ? '-' : '+'}{formatCurrency(tx.amount)}
                      </Text>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          onPress={() => openTransactionModal(tx)}
                          style={[
                            styles.editBtn,
                            { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' },
                          ]}
                        >
                          <Text style={styles.editBtnText}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteTransaction(tx.id)}>
                          <Text style={styles.deleteBtn}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Card>
              ))
            )}
            <Button
              title={`+ ${t('add_transaction')}`}
              onPress={() => openTransactionModal()}
              style={styles.addBtn}
            />
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Borrower Modal ─────────────────────────────────────────── */}
      <Modal visible={borrowerModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <ScrollView
            style={[styles.modalContent, { backgroundColor: theme.colors.modalBg }]}
            bounces={false}
          >
            <View style={styles.modalInner}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {editingBorrower ? t('edit_borrower') : t('add_borrower')}
              </Text>
              <Input label={`${t('name')} *`} value={borrowerForm.name} onChangeText={(v) => setBorrowerForm({ ...borrowerForm, name: v })} placeholder={t('name')} />
              <Input label={t('phone')} value={borrowerForm.phone} onChangeText={(v) => setBorrowerForm({ ...borrowerForm, phone: v })} placeholder={t('phone')} keyboardType="phone-pad" />
              <Input label={t('email')} value={borrowerForm.email} onChangeText={(v) => setBorrowerForm({ ...borrowerForm, email: v })} placeholder={t('email')} />
              <Input label={t('address')} value={borrowerForm.address} onChangeText={(v) => setBorrowerForm({ ...borrowerForm, address: v })} placeholder={t('address')} />
              <Input label={t('notes')} value={borrowerForm.notes} onChangeText={(v) => setBorrowerForm({ ...borrowerForm, notes: v })} placeholder={t('notes')} />
              <View style={styles.modalButtons}>
                <Button title={t('cancel')} variant="secondary" onPress={() => setBorrowerModal(false)} />
                <Button title={t('save')} onPress={handleSaveBorrower} loading={saving} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Transaction Modal ──────────────────────────────────────── */}
      <Modal visible={transactionModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {editingTransaction ? t('edit_transaction') : t('add_transaction')}
            </Text>

            <Select
              label={t('borrower')}
              value={transactionForm.borrowerId}
              onChange={(v) => setTransactionForm({ ...transactionForm, borrowerId: v })}
              options={borrowers.map((b) => ({ value: b.id, label: b.name }))}
            />

            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  { backgroundColor: isDark ? '#334155' : '#e5e7eb' },
                  transactionForm.type === 'given' && styles.typeActive,
                ]}
                onPress={() => setTransactionForm({ ...transactionForm, type: 'given' })}
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
                  transactionForm.type === 'received' && styles.typeActive,
                ]}
                onPress={() => setTransactionForm({ ...transactionForm, type: 'received' })}
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
              label={t('amount')}
              value={transactionForm.amount}
              onChangeText={(v) => setTransactionForm({ ...transactionForm, amount: v })}
              placeholder="0"
              keyboardType="numeric"
            />
            <DatePicker
              label={t('date')}
              value={transactionForm.date}
              onChange={(d) => setTransactionForm({ ...transactionForm, date: d })}
            />
            <Input
              label={t('description')}
              value={transactionForm.description}
              onChangeText={(v) => setTransactionForm({ ...transactionForm, description: v })}
              placeholder={t('optional_description')}
            />
            <View style={styles.modalButtons}>
              <Button title={t('cancel')} variant="secondary" onPress={() => setTransactionModal(false)} />
              <Button title={t('save')} onPress={handleSaveTransaction} loading={saving} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header stats
  headerStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  // Tabs - below header
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 8,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    elevation: 1,
  },
  tabContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabEmoji: { fontSize: 14 },
  tabLabel: { fontSize: 14 },

  empty: { textAlign: 'center', padding: 20 },
  itemCard: { marginHorizontal: 16, marginBottom: 12 },

  // Borrower
  borrowerHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  borrowerName: { fontSize: 16, fontWeight: '600' },
  borrowerMeta: { fontSize: 13, marginTop: 2 },
  chevron: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  chevronText: { fontSize: 20, fontWeight: '300' },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  balanceLabel: { fontSize: 14 },
  balanceAmount: { fontSize: 14, fontWeight: '600' },
  tapHint: { fontSize: 12, marginTop: 8, fontWeight: '500' },

  positive: { color: '#059669' },
  negative: { color: '#dc2626' },
  neutral: { color: '#6b7280' },

  addBtn: { marginHorizontal: 16, marginTop: 8 },

  // Summary
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, alignItems: 'center', padding: 12 },
  summaryLabel: { fontSize: 12 },
  summaryValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },

  // Transaction
  transactionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  transactionName: { fontSize: 15, fontWeight: '600' },
  transactionTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  transactionTypeEmoji: { fontSize: 13 },
  transactionType: { fontSize: 13 },
  transactionDate: { fontSize: 12, marginTop: 2 },
  transactionDesc: { fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  transactionAmount: { fontSize: 18, fontWeight: 'bold' },

  actionButtons: { flexDirection: 'row', gap: 4 },
  editBtn: { padding: 6, borderRadius: 6 },
  editBtnText: { fontSize: 14 },
  deleteBtn: { fontSize: 18, padding: 4 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalInner: { paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },

  // Type toggle
  typeToggle: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  typeActive: { backgroundColor: '#3b82f6' },
  typeContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeEmoji: { fontSize: 16 },
  typeText: { fontSize: 14, fontWeight: '500' },
  typeTextActive: { color: '#fff' },
});