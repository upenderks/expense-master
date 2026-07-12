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

type Tab = 'borrowers' | 'transactions';

export default function Money() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();

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
      Alert.alert('Error', 'Name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingBorrower) {
        await updateBorrower(editingBorrower.id, user!.id, borrowerForm.name, borrowerForm.phone, borrowerForm.email, borrowerForm.address, borrowerForm.notes);
      } else {
        await createBorrower(user!.id, borrowerForm.name, borrowerForm.phone, borrowerForm.email, borrowerForm.address, borrowerForm.notes);
      }
      setBorrowerModal(false);
      loadData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBorrower = (id: number, name: string) => {
    Alert.alert('Delete Borrower', `Delete ${name}? This will also delete all transactions.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteBorrower(id, user!.id); loadData(); },
      },
    ]);
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
      Alert.alert('Error', 'Please select borrower and enter amount');
      return;
    }
    setSaving(true);
    try {
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, user!.id, Number(transactionForm.borrowerId), transactionForm.type, parseFloat(transactionForm.amount), transactionForm.date, transactionForm.description);
      } else {
        await createTransaction(user!.id, Number(transactionForm.borrowerId), transactionForm.type, parseFloat(transactionForm.amount), transactionForm.date, transactionForm.description);
      }
      setTransactionModal(false);
      loadData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = (id: number) => {
    Alert.alert('Delete Transaction', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteTransaction(id, user!.id); loadData(); },
      },
    ]);
  };

  const formatCurrency = (amount: number) =>
    '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const totalGiven = transactions.filter(t => t.type === 'given').reduce((s, t) => s + t.amount, 0);
  const totalReceived = transactions.filter(t => t.type === 'received').reduce((s, t) => s + t.amount, 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

      {/* Tabs */}
      <View style={[
        styles.tabs,
        { backgroundColor: isDark ? '#334155' : '#e5e7eb' },
      ]}>
        {(['borrowers', 'transactions'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && [
                styles.activeTab,
                { backgroundColor: theme.colors.surface },
              ],
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              styles.tabText,
              { color: theme.colors.muted },
              activeTab === tab && { color: theme.colors.text, fontWeight: '600' },
            ]}>
              {tab === 'borrowers' ? '👥 Borrowers' : '💱 Transactions'}
            </Text>
          </TouchableOpacity>
        ))}
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
                <Text style={[styles.empty, { color: theme.colors.muted }]}>
                  No borrowers yet. Tap + to add one.
                </Text>
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
                      {/* Avatar */}
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

                      {/* Chevron */}
                      <View style={[
                        styles.chevron,
                        { backgroundColor: isDark ? '#334155' : '#f3f4f6' },
                      ]}>
                        <Text style={[styles.chevronText, { color: theme.colors.muted }]}>
                          ›
                        </Text>
                      </View>
                    </View>

                    {/* Balance Row */}
                    <View style={[
                      styles.balanceRow,
                      { borderTopColor: theme.colors.border },
                    ]}>
                      <Text style={[styles.balanceLabel, { color: theme.colors.muted }]}>
                        Balance:
                      </Text>
                      <Text style={[
                        styles.balanceAmount,
                        b.balance > 0 ? styles.positive
                          : b.balance < 0 ? styles.negative
                          : { color: theme.colors.muted },
                      ]}>
                        {b.balance > 0
                          ? `Owes ${formatCurrency(b.balance)}`
                          : b.balance < 0
                          ? `Owed ${formatCurrency(Math.abs(b.balance))}`
                          : 'Settled'}
                      </Text>
                    </View>

                    <Text style={[styles.tapHint, { color: theme.colors.primary }]}>
                      Tap to view details →
                    </Text>
                  </Card>
                </TouchableOpacity>
              ))
            )}
            <Button
              title="+ Add Borrower"
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
                  Given
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
                  Received
                </Text>
                <Text style={[styles.summaryValue, { color: '#059669' }]}>
                  {formatCurrency(totalReceived)}
                </Text>
              </Card>
            </View>

            {transactions.length === 0 ? (
              <Card>
                <Text style={[styles.empty, { color: theme.colors.muted }]}>
                  No transactions {startDate || endDate ? 'in this date range' : 'yet'}
                </Text>
              </Card>
            ) : (
              transactions.map((t) => (
                <Card key={t.id} style={styles.itemCard}>
                  <View style={styles.transactionHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.transactionName, { color: theme.colors.text }]}>
                        {t.borrower_name}
                      </Text>
                      <Text style={[styles.transactionType, { color: theme.colors.muted }]}>
                        {t.type === 'given' ? '💸 Money Given' : '💰 Money Received'}
                      </Text>
                      <Text style={[styles.transactionDate, { color: theme.colors.muted }]}>
                        📅 {t.date}
                      </Text>
                      {t.description && (
                        <Text style={[styles.transactionDesc, { color: theme.colors.muted }]}>
                          {t.description}
                        </Text>
                      )}
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[
                        styles.transactionAmount,
                        t.type === 'given' ? styles.negative : styles.positive,
                      ]}>
                        {t.type === 'given' ? '-' : '+'}{formatCurrency(t.amount)}
                      </Text>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          onPress={() => openTransactionModal(t)}
                          style={[
                            styles.editBtn,
                            { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' },
                          ]}
                        >
                          <Text style={styles.editBtnText}>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteTransaction(t.id)}>
                          <Text style={styles.deleteBtn}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Card>
              ))
            )}
            <Button
              title="+ Add Transaction"
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
                {editingBorrower ? 'Edit Borrower' : 'Add Borrower'}
              </Text>
              <Input label="Name *" value={borrowerForm.name} onChangeText={(t) => setBorrowerForm({ ...borrowerForm, name: t })} placeholder="Name" />
              <Input label="Phone" value={borrowerForm.phone} onChangeText={(t) => setBorrowerForm({ ...borrowerForm, phone: t })} placeholder="Phone" keyboardType="phone-pad" />
              <Input label="Email" value={borrowerForm.email} onChangeText={(t) => setBorrowerForm({ ...borrowerForm, email: t })} placeholder="Email" />
              <Input label="Address" value={borrowerForm.address} onChangeText={(t) => setBorrowerForm({ ...borrowerForm, address: t })} placeholder="Address" />
              <Input label="Notes" value={borrowerForm.notes} onChangeText={(t) => setBorrowerForm({ ...borrowerForm, notes: t })} placeholder="Notes" />
              <View style={styles.modalButtons}>
                <Button title="Cancel" variant="secondary" onPress={() => setBorrowerModal(false)} />
                <Button title="Save" onPress={handleSaveBorrower} loading={saving} />
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
              {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
            </Text>

            <Select
              label="Borrower"
              value={transactionForm.borrowerId}
              onChange={(v) => setTransactionForm({ ...transactionForm, borrowerId: v })}
              options={borrowers.map((b) => ({ value: b.id, label: b.name }))}
            />

            {/* Type Toggle */}
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  { backgroundColor: isDark ? '#334155' : '#e5e7eb' },
                  transactionForm.type === 'given' && styles.typeActive,
                ]}
                onPress={() => setTransactionForm({ ...transactionForm, type: 'given' })}
              >
                <Text style={[
                  styles.typeText,
                  { color: theme.colors.muted },
                  transactionForm.type === 'given' && styles.typeTextActive,
                ]}>
                  💸 Given
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  { backgroundColor: isDark ? '#334155' : '#e5e7eb' },
                  transactionForm.type === 'received' && styles.typeActive,
                ]}
                onPress={() => setTransactionForm({ ...transactionForm, type: 'received' })}
              >
                <Text style={[
                  styles.typeText,
                  { color: theme.colors.muted },
                  transactionForm.type === 'received' && styles.typeTextActive,
                ]}>
                  💰 Received
                </Text>
              </TouchableOpacity>
            </View>

            <Input
              label="Amount"
              value={transactionForm.amount}
              onChangeText={(t) => setTransactionForm({ ...transactionForm, amount: t })}
              placeholder="0"
              keyboardType="numeric"
            />
            <DatePicker
              label="Date"
              value={transactionForm.date}
              onChange={(d) => setTransactionForm({ ...transactionForm, date: d })}
            />
            <Input
              label="Description"
              value={transactionForm.description}
              onChangeText={(t) => setTransactionForm({ ...transactionForm, description: t })}
              placeholder="Optional description"
            />
            <View style={styles.modalButtons}>
              <Button title="Cancel" variant="secondary" onPress={() => setTransactionModal(false)} />
              <Button title="Save" onPress={handleSaveTransaction} loading={saving} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Tabs
  tabs: { flexDirection: 'row', margin: 16, borderRadius: 8, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  activeTab: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1 },
  tabText: { fontSize: 14 },

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
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
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
  transactionType: { fontSize: 13, marginTop: 2 },
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
  typeText: { fontSize: 14, fontWeight: '500' },
  typeTextActive: { color: '#fff' },
});